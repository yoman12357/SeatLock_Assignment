const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/', (req, res) => {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const requestedOffset = Number.parseInt(req.query.offset, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 200)) : 50;
    const offset = Number.isFinite(requestedOffset) ? Math.max(0, requestedOffset) : 0;

    const logs = db.prepare(
        'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM activity_log').get().count;

    res.json({
        logs,
        total,
        limit,
        offset
    });
});

module.exports = router;
