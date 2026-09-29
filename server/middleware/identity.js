const { verifyToken } = require('../services/auth');

function readCookie(cookieHeader, name) {
    if (!cookieHeader) return null;
    for (const part of cookieHeader.split(';')) {
        const [key, ...value] = part.trim().split('=');
        if (key === name) return decodeURIComponent(value.join('='));
    }
    return null;
}

function identityMiddleware(req, res, next) {
    const authorization = req.headers.authorization || '';
    const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
    const cookieToken = readCookie(req.headers.cookie, 'seatlock_session');
    const userId = verifyToken(bearerToken || cookieToken);

    if (!userId) {
        return res.status(401).json({ error: 'A valid SeatLock session is required' });
    }
    req.userId = userId;

    if (req.method === 'POST') {
        const key = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
        if (!key || !/^[a-zA-Z0-9_.:-]{8,128}$/.test(key)) {
            return res.status(400).json({
                error: 'Idempotency-Key must be 8-128 letters, numbers, dots, colons, dashes, or underscores'
            });
        }
        req.idempotencyKey = key;
    }

    next();
}

module.exports = identityMiddleware;
