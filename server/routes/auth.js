const express = require('express');
const { register, login, verifyToken } = require('../services/auth');

const router = express.Router();
const COOKIE_OPTIONS = 'HttpOnly; SameSite=Strict; Path=/; Max-Age=604800';

function setSessionCookie(res, token) {
    res.setHeader('Set-Cookie', `seatlock_session=${encodeURIComponent(token)}; ${COOKIE_OPTIONS}`);
}

router.post('/register', (req, res) => {
    const key = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    if (!key || !/^[a-zA-Z0-9_.:-]{8,128}$/.test(key)) {
        return res.status(400).json({ error: 'A valid Idempotency-Key header is required' });
    }
    try {
        const result = register(req.body?.user_id, req.body?.passcode, key);
        if (result.body.token) setSessionCookie(res, result.body.token);
        return res.status(result.status).json(result.body);
    } catch (error) {
        if (error.status) return res.status(error.status).json(error.body);
        console.error('[auth/register] unexpected error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', (req, res) => {
    const result = login(req.body?.user_id, req.body?.passcode);
    if (result.body.token) setSessionCookie(res, result.body.token);
    res.status(result.status).json(result.body);
});

router.post('/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'seatlock_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    res.json({ message: 'Signed out' });
});

router.get('/me', (req, res) => {
    const authorization = req.headers.authorization || '';
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
    const cookie = (req.headers.cookie || '').split(';').map(value => value.trim())
        .find(value => value.startsWith('seatlock_session='));
    const token = bearer || (cookie ? decodeURIComponent(cookie.slice('seatlock_session='.length)) : null);
    const userId = verifyToken(token);
    if (!userId) return res.status(401).json({ error: 'Not signed in' });
    return res.json({ user_id: userId });
});

module.exports = router;
