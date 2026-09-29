const express = require('express');
const router = express.Router();
const { confirmSeat } = require('../services/reservation');

router.post('/', (req, res) => {
    try {
        const result = confirmSeat(req.userId, req.idempotencyKey);
        res.status(result.status).json(result.body);
    } catch (err) {
        if (err.status) {
            return res.status(err.status).json(err.body);
        }
        console.error('[confirm] unexpected error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
