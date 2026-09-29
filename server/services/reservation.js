const { db, getConfig } = require('../db');
const { checkIdempotencyKey, storeIdempotencyKey } = require('./idempotency');
const {
    broadcastActivity,
    broadcastAvailability,
    broadcastUserUpdate
} = require('./broadcast');
const { sweepExpiredHolds } = require('./expiry');
const waitlistService = require('./waitlist');

function getAvailability() {
    const total = Number(getConfig('max_seats'));
    const held = db.prepare("SELECT COUNT(*) AS count FROM reservations WHERE status = 'held'").get().count;
    const confirmed = db.prepare("SELECT COUNT(*) AS count FROM reservations WHERE status = 'confirmed'").get().count;
    const waitlistCount = db.prepare('SELECT COUNT(*) AS count FROM waitlist').get().count;
    return { total, available: total - held - confirmed, held, confirmed, waitlist_count: waitlistCount };
}

function getUserStatus(userId) {
    return waitlistService.getUserStatusDirect(userId);
}

function logActivity(userId, previousState, newState, reason, idempotencyKey = null, reservationId = null) {
    db.prepare(`
        INSERT INTO activity_log
            (reservation_id, user_id, previous_state, new_state, reason, idempotency_key, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(reservationId, userId, previousState, newState, reason, idempotencyKey, new Date().toISOString());
}

function holdSeat(userId, idempotencyKey) {
    sweepExpiredHolds();

    const transaction = db.transaction(() => {
        const cached = checkIdempotencyKey(idempotencyKey, userId, 'hold');
        if (cached) return cached;

        const existing = db.prepare('SELECT * FROM reservations WHERE user_id = ?').get(userId);
        if (existing) {
            const response = {
                status: 409,
                body: { error: 'You already have an active reservation', reservation: existing }
            };
            storeIdempotencyKey(idempotencyKey, userId, 'hold', response.status, response.body);
            return response;
        }

        if (db.prepare('SELECT 1 FROM waitlist WHERE user_id = ?').get(userId)) {
            const response = { status: 409, body: { error: 'Leave the waitlist before reserving directly' } };
            storeIdempotencyKey(idempotencyKey, userId, 'hold', response.status, response.body);
            return response;
        }

        const capacity = Number(getConfig('max_seats'));
        const occupied = db.prepare('SELECT COUNT(*) AS count FROM reservations').get().count;
        if (occupied >= capacity) {
            const response = { status: 422, body: { error: 'No seats available. You can join the waitlist.' } };
            storeIdempotencyKey(idempotencyKey, userId, 'hold', response.status, response.body);
            return response;
        }

        const heldAt = new Date().toISOString();
        const duration = Number(getConfig('hold_duration_seconds'));
        const expiresAt = new Date(Date.now() + duration * 1000).toISOString();
        const insert = db.prepare(`
            INSERT INTO reservations
                (user_id, status, held_at, expires_at, idempotency_key, created_at, updated_at)
            VALUES (?, 'held', ?, ?, ?, ?, ?)
        `).run(userId, heldAt, expiresAt, idempotencyKey, heldAt, heldAt);
        logActivity(userId, null, 'held', 'user_hold', idempotencyKey, Number(insert.lastInsertRowid));

        const response = {
            status: 201,
            body: {
                message: 'Seat held successfully',
                reservation: { user_id: userId, status: 'held', held_at: heldAt, expires_at: expiresAt }
            }
        };
        storeIdempotencyKey(idempotencyKey, userId, 'hold', response.status, response.body);
        return response;
    });

    const result = transaction.immediate();
    if (result.status === 201 && !result.cached) {
        broadcastAvailability(getAvailability());
        broadcastUserUpdate(userId, getUserStatus(userId));
        broadcastActivity();
    }
    return result;
}

function confirmSeat(userId, idempotencyKey) {
    // Leave this user's row in place so an expired confirmation returns 410, not 404.
    sweepExpiredHolds(userId);
    let promotedUser = null;

    const transaction = db.transaction(() => {
        const cached = checkIdempotencyKey(idempotencyKey, userId, 'confirm');
        if (cached) return cached;

        const reservation = db.prepare('SELECT * FROM reservations WHERE user_id = ?').get(userId);
        if (!reservation) {
            const response = { status: 404, body: { error: 'No active hold found' } };
            storeIdempotencyKey(idempotencyKey, userId, 'confirm', response.status, response.body);
            return response;
        }

        if (reservation.status === 'confirmed') {
            const response = { status: 200, body: { message: 'Already confirmed', reservation } };
            storeIdempotencyKey(idempotencyKey, userId, 'confirm', response.status, response.body);
            return response;
        }

        if (reservation.expires_at <= new Date().toISOString()) {
            db.prepare('DELETE FROM reservations WHERE id = ?').run(reservation.id);
            logActivity(userId, 'held', 'expired', 'hold_expired_on_confirm_attempt', idempotencyKey, reservation.id);
            promotedUser = waitlistService.promoteNext();
            const response = {
                status: 410,
                body: { error: 'Your hold expired and cannot be confirmed' }
            };
            storeIdempotencyKey(idempotencyKey, userId, 'confirm', response.status, response.body);
            return response;
        }

        const confirmedAt = new Date().toISOString();
        db.prepare(`
            UPDATE reservations
            SET status = 'confirmed', confirmed_at = ?, expires_at = NULL, updated_at = ?
            WHERE id = ?
        `).run(confirmedAt, confirmedAt, reservation.id);
        logActivity(userId, 'held', 'confirmed', 'user_confirm', idempotencyKey, reservation.id);

        const updated = db.prepare('SELECT * FROM reservations WHERE id = ?').get(reservation.id);
        const response = {
            status: 200,
            body: { message: 'Reservation confirmed', reservation: updated }
        };
        storeIdempotencyKey(idempotencyKey, userId, 'confirm', response.status, response.body);
        return response;
    });

    const result = transaction.immediate();
    if (!result.cached && (result.status === 200 || result.status === 410)) {
        broadcastAvailability(getAvailability());
        broadcastUserUpdate(userId, getUserStatus(userId));
        if (promotedUser) broadcastUserUpdate(promotedUser, getUserStatus(promotedUser));
        waitlistService.broadcastWaitlistPositions();
        broadcastActivity();
    }
    return result;
}

function cancelReservation(userId, idempotencyKey) {
    sweepExpiredHolds();
    let promotedUser = null;
    let waitlistChanged = false;

    const transaction = db.transaction(() => {
        const cached = checkIdempotencyKey(idempotencyKey, userId, 'cancel');
        if (cached) return cached;

        const reservation = db.prepare('SELECT * FROM reservations WHERE user_id = ?').get(userId);
        if (reservation) {
            db.prepare('DELETE FROM reservations WHERE id = ?').run(reservation.id);
            logActivity(userId, reservation.status, 'cancelled', 'user_cancel', idempotencyKey, reservation.id);
            promotedUser = waitlistService.promoteNext();
            waitlistChanged = Boolean(promotedUser);

            const response = {
                status: 200,
                body: { message: `Reservation (${reservation.status}) cancelled` }
            };
            storeIdempotencyKey(idempotencyKey, userId, 'cancel', response.status, response.body);
            return response;
        }

        const waitlistEntry = db.prepare('SELECT id FROM waitlist WHERE user_id = ?').get(userId);
        if (waitlistEntry) {
            db.prepare('DELETE FROM waitlist WHERE id = ?').run(waitlistEntry.id);
            logActivity(userId, 'waitlisted', 'cancelled', 'user_cancel_waitlist', idempotencyKey);
            waitlistChanged = true;
            const response = { status: 200, body: { message: 'Waitlist entry cancelled' } };
            storeIdempotencyKey(idempotencyKey, userId, 'cancel', response.status, response.body);
            return response;
        }

        const response = { status: 404, body: { error: 'No active reservation or waitlist entry found' } };
        storeIdempotencyKey(idempotencyKey, userId, 'cancel', response.status, response.body);
        return response;
    });

    const result = transaction.immediate();
    if (result.status === 200 && !result.cached) {
        broadcastAvailability(getAvailability());
        broadcastUserUpdate(userId, getUserStatus(userId));
        if (promotedUser) broadcastUserUpdate(promotedUser, getUserStatus(promotedUser));
        if (waitlistChanged) waitlistService.broadcastWaitlistPositions();
        broadcastActivity();
    }
    return result;
}

module.exports = {
    cancelReservation,
    confirmSeat,
    getAvailability,
    getUserStatus,
    holdSeat,
    logActivity
};
