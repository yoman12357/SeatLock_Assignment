const { db, getConfig } = require('../db');
const { checkIdempotencyKey, storeIdempotencyKey } = require('./idempotency');
const {
    broadcastActivity,
    broadcastAvailability,
    broadcastUserUpdate
} = require('./broadcast');

function logActivity(userId, previousState, newState, reason, idempotencyKey = null, reservationId = null) {
    db.prepare(`
        INSERT INTO activity_log
            (reservation_id, user_id, previous_state, new_state, reason, idempotency_key, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(reservationId, userId, previousState, newState, reason, idempotencyKey, new Date().toISOString());
}

function getAvailabilityDirect() {
    const total = Number(getConfig('max_seats'));
    const held = db.prepare("SELECT COUNT(*) AS count FROM reservations WHERE status = 'held'").get().count;
    const confirmed = db.prepare("SELECT COUNT(*) AS count FROM reservations WHERE status = 'confirmed'").get().count;
    const waitlistCount = db.prepare('SELECT COUNT(*) AS count FROM waitlist').get().count;
    return { total, available: total - held - confirmed, held, confirmed, waitlist_count: waitlistCount };
}

function getWaitlistPosition(userId) {
    const entry = db.prepare('SELECT id FROM waitlist WHERE user_id = ?').get(userId);
    if (!entry) return null;
    return db.prepare('SELECT COUNT(*) AS position FROM waitlist WHERE id <= ?').get(entry.id).position;
}

function getUserStatusDirect(userId) {
    const reservation = db.prepare('SELECT * FROM reservations WHERE user_id = ?').get(userId);
    if (reservation) {
        return {
            status: reservation.status,
            held_at: reservation.held_at,
            expires_at: reservation.expires_at,
            confirmed_at: reservation.confirmed_at,
            waitlist_position: null
        };
    }
    const waitlistEntry = db.prepare('SELECT joined_at FROM waitlist WHERE user_id = ?').get(userId);
    if (!waitlistEntry) return { status: 'none' };
    return {
        status: 'waitlisted',
        joined_at: waitlistEntry.joined_at,
        waitlist_position: getWaitlistPosition(userId)
    };
}

function broadcastWaitlistPositions() {
    const users = db.prepare('SELECT user_id FROM waitlist ORDER BY id').all();
    for (const { user_id: userId } of users) {
        broadcastUserUpdate(userId, getUserStatusDirect(userId));
    }
}

function joinWaitlist(userId, idempotencyKey) {
    const transaction = db.transaction(() => {
        const cached = checkIdempotencyKey(idempotencyKey, userId, 'waitlist');
        if (cached) return cached;

        if (db.prepare('SELECT 1 FROM reservations WHERE user_id = ?').get(userId)) {
            const response = { status: 409, body: { error: 'You already have an active reservation' } };
            storeIdempotencyKey(idempotencyKey, userId, 'waitlist', response.status, response.body);
            return response;
        }

        if (db.prepare('SELECT 1 FROM waitlist WHERE user_id = ?').get(userId)) {
            const response = {
                status: 200,
                body: { message: 'Already on the waitlist', position: getWaitlistPosition(userId) }
            };
            storeIdempotencyKey(idempotencyKey, userId, 'waitlist', response.status, response.body);
            return response;
        }

        const capacity = Number(getConfig('max_seats'));
        const occupied = db.prepare('SELECT COUNT(*) AS count FROM reservations').get().count;
        if (occupied < capacity) {
            const response = {
                status: 422,
                body: { error: 'Seats are available. Reserve one instead of joining the waitlist.' }
            };
            storeIdempotencyKey(idempotencyKey, userId, 'waitlist', response.status, response.body);
            return response;
        }

        const joinedAt = new Date().toISOString();
        db.prepare(
            'INSERT INTO waitlist (user_id, joined_at, idempotency_key) VALUES (?, ?, ?)'
        ).run(userId, joinedAt, idempotencyKey);
        logActivity(userId, null, 'waitlisted', 'user_join_waitlist', idempotencyKey);

        const response = {
            status: 201,
            body: {
                message: 'Added to waitlist',
                position: getWaitlistPosition(userId),
                joined_at: joinedAt
            }
        };
        storeIdempotencyKey(idempotencyKey, userId, 'waitlist', response.status, response.body);
        return response;
    });

    const result = transaction.immediate();
    if (result.status === 201 && !result.cached) {
        broadcastAvailability(getAvailabilityDirect());
        broadcastUserUpdate(userId, getUserStatusDirect(userId));
        broadcastActivity();
    }
    return result;
}

// The caller must already hold an immediate write transaction.
function promoteNext() {
    const capacity = Number(getConfig('max_seats'));
    const occupied = db.prepare('SELECT COUNT(*) AS count FROM reservations').get().count;
    if (occupied >= capacity) return null;

    const next = db.prepare('SELECT * FROM waitlist ORDER BY id ASC LIMIT 1').get();
    if (!next) return null;

    db.prepare('DELETE FROM waitlist WHERE id = ?').run(next.id);
    const heldAt = new Date().toISOString();
    const duration = Number(getConfig('hold_duration_seconds'));
    const expiresAt = new Date(Date.now() + duration * 1000).toISOString();
    const insert = db.prepare(`
        INSERT INTO reservations (user_id, status, held_at, expires_at, created_at, updated_at)
        VALUES (?, 'held', ?, ?, ?, ?)
    `).run(next.user_id, heldAt, expiresAt, heldAt, heldAt);
    logActivity(next.user_id, 'waitlisted', 'held', 'waitlist_promotion', null, Number(insert.lastInsertRowid));
    return next.user_id;
}

module.exports = {
    broadcastWaitlistPositions,
    getUserStatusDirect,
    joinWaitlist,
    promoteNext
};
