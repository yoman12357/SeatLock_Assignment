const crypto = require('crypto');
const { db, getConfig } = require('../db');
const { checkIdempotencyKey, storeIdempotencyKey } = require('./idempotency');

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function validateCredentials(userId, passcode) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(userId || '')) {
        return 'User ID must contain 1-64 letters, numbers, dashes, or underscores';
    }
    if (typeof passcode !== 'string' || passcode.length < 6 || passcode.length > 128) {
        return 'Passcode must be between 6 and 128 characters';
    }
    return null;
}

function hashPasscode(passcode, salt) {
    return crypto.scryptSync(passcode, salt, 32, { N: 8192 }).toString('hex');
}

function sign(value) {
    return crypto.createHmac('sha256', getConfig('auth_secret')).update(value).digest('base64url');
}

function createToken(userId) {
    const payload = Buffer.from(JSON.stringify({
        sub: userId,
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const expected = Buffer.from(sign(parts[0]));
    const supplied = Buffer.from(parts[1]);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;

    try {
        const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        if (!payload.sub || payload.exp <= Math.floor(Date.now() / 1000)) return null;
        const user = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(payload.sub);
        return user ? user.user_id : null;
    } catch {
        return null;
    }
}

function register(userId, passcode, idempotencyKey) {
    const validationError = validateCredentials(userId, passcode);
    if (validationError) return { status: 400, body: { error: validationError } };

    const transaction = db.transaction(() => {
        const cached = checkIdempotencyKey(idempotencyKey, userId, 'register');
        if (cached) return cached;

        const existing = db.prepare('SELECT user_id FROM users WHERE user_id = ?').get(userId);
        if (existing) {
            const response = { status: 409, body: { error: 'That user ID is already registered' } };
            storeIdempotencyKey(idempotencyKey, userId, 'register', response.status, response.body);
            return response;
        }

        const salt = crypto.randomBytes(16).toString('hex');
        db.prepare(
            'INSERT INTO users (user_id, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?)'
        ).run(userId, hashPasscode(passcode, salt), salt, new Date().toISOString());

        const response = {
            status: 201,
            body: { message: 'Account created', user_id: userId, token: createToken(userId) }
        };
        storeIdempotencyKey(idempotencyKey, userId, 'register', response.status, response.body);
        return response;
    });

    return transaction.immediate();
}

function login(userId, passcode) {
    const validationError = validateCredentials(userId, passcode);
    if (validationError) return { status: 400, body: { error: validationError } };

    const user = db.prepare(
        'SELECT user_id, password_hash, password_salt FROM users WHERE user_id = ?'
    ).get(userId);
    if (!user) return { status: 401, body: { error: 'Invalid user ID or passcode' } };

    const actual = Buffer.from(hashPasscode(passcode, user.password_salt), 'hex');
    const expected = Buffer.from(user.password_hash, 'hex');
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        return { status: 401, body: { error: 'Invalid user ID or passcode' } };
    }

    return {
        status: 200,
        body: { message: 'Signed in', user_id: userId, token: createToken(userId) }
    };
}

module.exports = { register, login, verifyToken };
