const { db, getConfig } = require('../db');
const {
    broadcastActivity,
    broadcastAvailability,
    broadcastUserUpdate
} = require('./broadcast');
const waitlistService = require('./waitlist');

function logExpiry(userId, reservationId) {
    db.prepare(`
        INSERT INTO activity_log
            (reservation_id, user_id, previous_state, new_state, reason, idempotency_key, created_at)
        VALUES (?, ?, 'held', 'expired', 'hold_expired_auto', NULL, ?)
    `).run(reservationId, userId, new Date().toISOString());
}

function getAvailabilityDirect() {
    const total = Number(getConfig('max_seats'));
    const held = db.prepare("SELECT COUNT(*) AS count FROM reservations WHERE status = 'held'").get().count;
    const confirmed = db.prepare("SELECT COUNT(*) AS count FROM reservations WHERE status = 'confirmed'").get().count;
    const waitlistCount = db.prepare('SELECT COUNT(*) AS count FROM waitlist').get().count;
    return { total, available: total - held - confirmed, held, confirmed, waitlist_count: waitlistCount };
}

function sweepExpiredHolds(excludedUserId = null) {
    const affectedUsers = [];
    const promotedUsers = [];
    const now = new Date().toISOString();

    const transaction = db.transaction(() => {
        const expired = excludedUserId
            ? db.prepare(`
                SELECT id, user_id FROM reservations
                WHERE status = 'held' AND expires_at <= ? AND user_id <> ?
                ORDER BY expires_at, id
            `).all(now, excludedUserId)
            : db.prepare(`
                SELECT id, user_id FROM reservations
                WHERE status = 'held' AND expires_at <= ?
                ORDER BY expires_at, id
            `).all(now);

        for (const reservation of expired) {
            db.prepare('DELETE FROM reservations WHERE id = ?').run(reservation.id);
            logExpiry(reservation.user_id, reservation.id);
            affectedUsers.push(reservation.user_id);
            const promoted = waitlistService.promoteNext();
            if (promoted) promotedUsers.push(promoted);
        }
    });

    transaction.immediate();

    if (affectedUsers.length) {
        broadcastAvailability(getAvailabilityDirect());
        for (const userId of affectedUsers) broadcastUserUpdate(userId, { status: 'expired' });
        for (const userId of promotedUsers) {
            broadcastUserUpdate(userId, waitlistService.getUserStatusDirect(userId));
        }
        waitlistService.broadcastWaitlistPositions();
        broadcastActivity();
    }

    return { expired: affectedUsers, promoted: promotedUsers };
}

let expiryInterval = null;

function startExpiryJob(intervalMs = 1000) {
    const startupResult = sweepExpiredHolds();
    if (startupResult.expired.length) {
        console.log(`[startup] Released ${startupResult.expired.length} expired hold(s)`);
    }

    expiryInterval = setInterval(() => {
        const result = sweepExpiredHolds();
        if (result.expired.length) {
            console.log(`[expiry] Released ${result.expired.length} expired hold(s)`);
        }
    }, intervalMs);
    expiryInterval.unref();
}

function stopExpiryJob() {
    if (expiryInterval) clearInterval(expiryInterval);
    expiryInterval = null;
}

module.exports = { sweepExpiredHolds, startExpiryJob, stopExpiryJob };
