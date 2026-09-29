const { db } = require('../db');

// Call these functions only from the immediate transaction that owns the state change.
function checkIdempotencyKey(key, userId, action) {
    const existing = db.prepare(
        'SELECT user_id, action, response_status, response_body FROM idempotency_keys WHERE key = ?'
    ).get(key);

    if (!existing) return null;

    if (existing.user_id !== userId || existing.action !== action) {
        throw {
            status: 409,
            body: { error: 'Idempotency key already used for a different user or action' }
        };
    }

    return {
        status: existing.response_status,
        body: JSON.parse(existing.response_body),
        cached: true
    };
}

function storeIdempotencyKey(key, userId, action, responseStatus, responseBody) {
    db.prepare(
        'INSERT INTO idempotency_keys (key, user_id, action, response_status, response_body, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(key, userId, action, responseStatus, JSON.stringify(responseBody), new Date().toISOString());
}

module.exports = { checkIdempotencyKey, storeIdempotencyKey };
