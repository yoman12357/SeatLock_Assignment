const express = require('express');
const router = express.Router();
const { joinWaitlist } = require('../services/waitlist');
const { sweepExpiredHolds } = require('../services/expiry');

router.post('/', (req, res) => {
    try {
        sweepExpiredHolds();
        const result = joinWaitlist(req.userId, req.idempotencyKey);
        res.status(result.status).json(result.body);
    } catch (err) {
        if (err.status) {
            return res.status(err.status).json(err.body);
        }
        console.error('[waitlist] unexpected error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
