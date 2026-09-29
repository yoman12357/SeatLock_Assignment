const express = require('express');
const path = require('path');
const { db, migrate } = require('./db');
const identityMiddleware = require('./middleware/identity');
const requestContext = require('./middleware/request-context');
const { startExpiryJob, stopExpiryJob } = require('./services/expiry');

migrate();
console.log('[db] Migrations complete');

const app = express();
app.disable('x-powered-by');
app.use(requestContext);
app.use(express.json({ limit: '16kb' }));
const frontendPath = path.join(__dirname, '..', 'dist');
app.use(express.static(frontendPath));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api', identityMiddleware);
app.use('/api/status', require('./routes/status'));
app.use('/api/hold', require('./routes/hold'));
app.use('/api/confirm', require('./routes/confirm'));
app.use('/api/cancel', require('./routes/cancel'));
app.use('/api/waitlist', require('./routes/waitlist'));
app.use('/api/events', require('./routes/events'));
app.use('/api/activity', require('./routes/activity'));

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));
app.get('*splat', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(frontendPath, 'index.html'), error => {
        if (error) next(error);
    });
});
app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({ error: 'Request body must be valid JSON' });
    }
    console.error('[server] unhandled error:', error);
    return res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => {
    console.log(`[server] SeatLock running on http://localhost:${port}`);
});

startExpiryJob(Number(process.env.EXPIRY_INTERVAL_MS || 1000));

function shutdown() {
    stopExpiryJob();
    server.close(() => {
        db.close();
        process.exit(0);
    });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

module.exports = { app, server };
