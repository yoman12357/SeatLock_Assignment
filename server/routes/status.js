const express = require('express');
const router = express.Router();
const { getAvailability, getUserStatus } = require('../services/reservation');
const { sweepExpiredHolds } = require('../services/expiry');

router.get('/', (req, res) => {
    sweepExpiredHolds();
    const availability = getAvailability();
    const userStatus = getUserStatus(req.userId);

    res.json({
        availability,
        user: userStatus
    });
});

module.exports = router;
