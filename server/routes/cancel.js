const express = require('express');
const router = express.Router();
const { cancelReservation } = require('../services/reservation');

router.post('/', (req, res) => {
    try {
        const result = cancelReservation(req.userId, req.idempotencyKey);
        res.status(result.status).json(result.body);
    } catch (err) {
        if (err.status) {
            return res.status(err.status).json(err.body);
        }
        console.error('[cancel] unexpected error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
