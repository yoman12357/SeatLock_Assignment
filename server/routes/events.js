const express = require('express');
const router = express.Router();
const { addClient } = require('../services/broadcast');
const { getAvailability } = require('../services/reservation');

router.get('/', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    const availability = getAvailability();
    res.write(`event: availability\ndata: ${JSON.stringify(availability)}\n\n`);

    const keepAlive = setInterval(() => {
        res.write(':ping\n\n');
    }, 30000);

    addClient(res, req.userId);

    req.on('close', () => {
        clearInterval(keepAlive);
    });
});

module.exports = router;
