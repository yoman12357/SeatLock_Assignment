const crypto = require('crypto');

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_.:-]{8,128}$/;

function requestContext(req, res, next) {
    const suppliedId = req.headers['x-request-id'];
    const requestId = typeof suppliedId === 'string' && REQUEST_ID_PATTERN.test(suppliedId)
        ? suppliedId
        : crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    if (req.path.startsWith('/api/')) {
        const startedAt = process.hrtime.bigint();
        let logged = false;
        const logCompletion = outcome => {
            if (logged) return;
            logged = true;
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
            console.log('[request]', JSON.stringify({
                request_id: requestId,
                method: req.method,
                path: req.originalUrl,
                status: res.statusCode,
                outcome,
                duration_ms: Number(durationMs.toFixed(2)),
                user_id: req.userId || null,
                idempotency_key: req.idempotencyKey || req.headers['idempotency-key'] || null
            }));
        };
        res.once('finish', () => logCompletion('finished'));
        res.once('close', () => logCompletion(res.writableEnded ? 'finished' : 'closed'));
    }

    next();
}

module.exports = requestContext;
