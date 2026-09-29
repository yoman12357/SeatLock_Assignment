const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const projectRoot = path.join(__dirname, '..');
const port = 3200 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const testDb = path.join(projectRoot, 'data', `seatlock-test-${process.pid}.db`);
const passcode = 'test-passcode';
const totalUsers = 120;
const capacity = 20;

let serverProcess;
let serverOutput = '';
let passed = 0;
let failed = 0;
const tokens = new Map();

function key(prefix = 'test') {
    return `${prefix}-${crypto.randomUUID()}`;
}

function check(condition, message) {
    if (condition) {
        passed++;
        console.log(`  PASS  ${message}`);
    } else {
        failed++;
        console.error(`  FAIL  ${message}`);
    }
}

async function api(endpoint, userId, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (userId) headers.Authorization = `Bearer ${tokens.get(userId)}`;
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    if (options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${baseUrl}${endpoint}`, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    let body;
    try { body = await response.json(); } catch { body = null; }
    return {
        status: response.status,
        body,
        requestId: response.headers.get('x-request-id')
    };
}

async function waitForServer() {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${baseUrl}/api/health`);
            if (response.ok) return;
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Server did not start.\n${serverOutput}`);
}

async function startServer() {
    serverOutput = '';
    serverProcess = spawn(process.execPath, ['server/index.js'], {
        cwd: projectRoot,
        env: {
            ...process.env,
            PORT: String(port),
            DB_PATH: testDb,
            MAX_SEATS: String(capacity),
            HOLD_DURATION_SECONDS: '1',
            EXPIRY_INTERVAL_MS: '60000',
            AUTH_SECRET: 'seatlock-concurrency-test-secret'
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    serverProcess.stdout.on('data', chunk => { serverOutput += chunk; });
    serverProcess.stderr.on('data', chunk => { serverOutput += chunk; });
    await waitForServer();
}

async function stopServer() {
    if (!serverProcess || serverProcess.exitCode !== null) return;
    const exited = new Promise(resolve => serverProcess.once('exit', resolve));
    serverProcess.kill('SIGTERM');
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))]);
}

async function registerUsers(userIds) {
    const results = await Promise.all(userIds.map(userId => api('/api/auth/register', null, {
        method: 'POST',
        idempotencyKey: key('register'),
        body: { user_id: userId, passcode }
    }).then(result => ({ userId, result }))));
    for (const { userId, result } of results) {
        if (result.body?.token) tokens.set(userId, result.body.token);
    }
    check(results.every(item => item.result.status === 201), `registered ${userIds.length} test identities`);
}

function queryDatabase(sql, ...params) {
    const database = new Database(testDb, { readonly: true });
    try { return database.prepare(sql).all(...params); }
    finally { database.close(); }
}

async function runTests() {
    const racers = Array.from({ length: totalUsers }, (_, index) => `race_${String(index).padStart(3, '0')}`);
    const helpers = ['verifier', 'idem_user', 'expired_user', 'filler_user', 'wait_1', 'wait_2', 'wait_3'];
    await registerUsers([...racers, ...helpers]);

    console.log('\n120 simultaneous attempts for 20 seats');
    const holdResults = await Promise.all(racers.map(userId => api('/api/hold', userId, {
        method: 'POST', idempotencyKey: key('hold')
    }).then(result => ({ userId, result }))));
    const winners = holdResults.filter(item => item.result.status === 201).map(item => item.userId);
    check(winners.length === capacity, `exactly ${capacity} holds were granted (received ${winners.length})`);
    check(holdResults.filter(item => item.result.status === 422).length === totalUsers - capacity,
        `the other ${totalUsers - capacity} attempts were rejected as full`);

    const confirmResults = await Promise.all(winners.map(userId => api('/api/confirm', userId, {
        method: 'POST', idempotencyKey: key('confirm')
    })));
    check(confirmResults.every(result => result.status === 200), 'all 20 winning holds were confirmed');

    const availability = await api('/api/status', 'verifier');
    check(availability.body.availability.confirmed === capacity, 'confirmed count is exactly 20');
    check(availability.body.availability.available === 0, 'availability never became negative');
    const suppliedRequestId = 'trace-check-request-0001';
    const tracedResponse = await api('/api/status', 'verifier', {
        headers: { 'X-Request-Id': suppliedRequestId }
    });
    check(tracedResponse.requestId === suppliedRequestId,
        'request IDs are returned for end-to-end tracing');

    const duplicate = await api('/api/hold', winners[0], {
        method: 'POST', idempotencyKey: key('duplicate')
    });
    check(duplicate.status === 409, 'one user cannot create a second active reservation');
    const duplicateRows = queryDatabase(`
        SELECT user_id, COUNT(*) AS count
        FROM reservations GROUP BY user_id HAVING COUNT(*) > 1
    `);
    check(duplicateRows.length === 0, 'database contains no duplicate active reservations');

    const unauthorizedConfirm = await api('/api/confirm', 'verifier', {
        method: 'POST', idempotencyKey: key('ownership-confirm')
    });
    const unauthorizedCancel = await api('/api/cancel', 'verifier', {
        method: 'POST', idempotencyKey: key('ownership-cancel')
    });
    const ownerStatus = await api('/api/status', winners[0]);
    check(
        unauthorizedConfirm.status === 404 && unauthorizedCancel.status === 404 && ownerStatus.body.user.status === 'confirmed',
        'one identity cannot confirm or cancel another user\'s reservation'
    );

    console.log('\nIdempotent retry');
    await api('/api/cancel', winners[0], { method: 'POST', idempotencyKey: key('cancel') });
    const retryKey = key('same-request');
    const [firstRetry, secondRetry] = await Promise.all([
        api('/api/hold', 'idem_user', { method: 'POST', idempotencyKey: retryKey }),
        api('/api/hold', 'idem_user', { method: 'POST', idempotencyKey: retryKey })
    ]);
    check(firstRetry.status === 201 && secondRetry.status === 201, 'both retry responses return the original 201');
    check(JSON.stringify(firstRetry.body) === JSON.stringify(secondRetry.body), 'retry response bodies are identical');
    const conflictingRetry = await api('/api/hold', 'expired_user', {
        method: 'POST', idempotencyKey: retryKey
    });
    check(conflictingRetry.status === 409, 'an idempotency key cannot be reused by another user');
    const idempotentEffects = queryDatabase(`
        SELECT id FROM activity_log WHERE user_id = 'idem_user' AND reason = 'user_hold'
    `);
    check(idempotentEffects.length === 1, 'the repeated request produced one activity and one hold');
    await api('/api/confirm', 'idem_user', { method: 'POST', idempotencyKey: key('confirm') });

    console.log('\nExpired hold');
    await api('/api/cancel', winners[1], { method: 'POST', idempotencyKey: key('cancel') });
    const expiringHold = await api('/api/hold', 'expired_user', {
        method: 'POST', idempotencyKey: key('expiry-hold')
    });
    check(expiringHold.status === 201, 'short test hold was created');
    await new Promise(resolve => setTimeout(resolve, 1150));
    const expiredConfirm = await api('/api/confirm', 'expired_user', {
        method: 'POST', idempotencyKey: key('expired-confirm')
    });
    check(expiredConfirm.status === 410, 'an expired hold cannot be confirmed');
    check(queryDatabase("SELECT id FROM reservations WHERE user_id = 'expired_user'").length === 0,
        'expired hold was removed from active reservations');

    await api('/api/hold', 'filler_user', { method: 'POST', idempotencyKey: key('fill') });
    await api('/api/confirm', 'filler_user', { method: 'POST', idempotencyKey: key('fill-confirm') });

    console.log('\nFIFO waitlist and exactly-once promotion');
    for (const userId of ['wait_1', 'wait_2', 'wait_3']) {
        const result = await api('/api/waitlist', userId, {
            method: 'POST', idempotencyKey: key('waitlist')
        });
        check(result.status === 201, `${userId} joined the waitlist`);
    }
    const duplicateWaitlist = await api('/api/waitlist', 'wait_1', {
        method: 'POST', idempotencyKey: key('duplicate-waitlist')
    });
    const waitlistRows = queryDatabase("SELECT id FROM waitlist WHERE user_id = 'wait_1'");
    check(duplicateWaitlist.status === 200 && waitlistRows.length === 1,
        'joining the waitlist twice does not create a duplicate entry');
    const crossTableDuplicates = queryDatabase(`
        SELECT reservations.user_id
        FROM reservations INNER JOIN waitlist USING (user_id)
    `);
    check(crossTableDuplicates.length === 0,
        'no user can be both reserved and waitlisted');

    const cancelKey = key('cancel-once');
    const [cancelOne, cancelRetry] = await Promise.all([
        api('/api/cancel', winners[2], { method: 'POST', idempotencyKey: cancelKey }),
        api('/api/cancel', winners[2], { method: 'POST', idempotencyKey: cancelKey })
    ]);
    check(cancelOne.status === 200 && cancelRetry.status === 200, 'cancellation retry returns the stored response');

    const waitOne = await api('/api/status', 'wait_1');
    const waitTwo = await api('/api/status', 'wait_2');
    const waitThree = await api('/api/status', 'wait_3');
    check(waitOne.body.user.status === 'held', 'first waitlisted user received the freed seat');
    check(waitTwo.body.user.status === 'waitlisted' && waitTwo.body.user.waitlist_position === 1,
        'second user remains first in line');
    check(waitThree.body.user.status === 'waitlisted' && waitThree.body.user.waitlist_position === 2,
        'third user remains second in line');
    check(queryDatabase(`
        SELECT id FROM activity_log WHERE user_id = 'wait_1' AND reason = 'waitlist_promotion'
    `).length === 1, 'cancellation promoted exactly one user exactly once');

    const finalState = await api('/api/status', 'verifier');
    const occupied = finalState.body.availability.held + finalState.body.availability.confirmed;
    check(occupied <= capacity, `active reservations remain within capacity (${occupied}/${capacity})`);

    console.log('\nRestart recovery');
    await stopServer();
    await new Promise(resolve => setTimeout(resolve, 1150));
    await startServer();
    const recoveredSecond = await api('/api/status', 'wait_2');
    const recoveredThird = await api('/api/status', 'wait_3');
    check(recoveredSecond.body.user.status === 'held', 'startup sweep promoted the next user after downtime');
    check(recoveredThird.body.user.status === 'waitlisted' && recoveredThird.body.user.waitlist_position === 1,
        'restart promotion happened once and preserved FIFO order');

    const appendOnly = (() => {
        const database = new Database(testDb);
        try {
            database.prepare('DELETE FROM activity_log WHERE id = 1').run();
            return false;
        } catch (error) {
            return error.message.includes('activity_log_is_append_only');
        } finally { database.close(); }
    })();
    check(appendOnly, 'activity timeline is protected as append-only');

    const incompleteTimelineRows = queryDatabase(`
        SELECT id FROM activity_log
        WHERE new_state IS NULL OR new_state = ''
           OR reason IS NULL OR reason = ''
           OR created_at IS NULL OR created_at = ''
    `);
    check(incompleteTimelineRows.length === 0,
        'every activity row includes new state, reason, and timestamp');

    const unlinkedReservationRows = queryDatabase(`
        SELECT id FROM activity_log
        WHERE reason IN (
            'user_hold', 'user_confirm', 'user_cancel',
            'hold_expired_auto', 'hold_expired_on_confirm_attempt', 'waitlist_promotion'
        ) AND reservation_id IS NULL
    `);
    check(unlinkedReservationRows.length === 0,
        'every reservation transition retains its reservation ID');
}

async function main() {
    console.log(`SeatLock concurrency suite (${baseUrl})`);
    for (const suffix of ['', '-wal', '-shm']) {
        if (fs.existsSync(`${testDb}${suffix}`)) fs.unlinkSync(`${testDb}${suffix}`);
    }
    try {
        await startServer();
        await runTests();
    } catch (error) {
        failed++;
        console.error('\nTest suite crashed:', error);
        if (serverOutput) console.error('\nServer output:\n' + serverOutput);
    } finally {
        await stopServer();
        for (const suffix of ['', '-wal', '-shm']) {
            if (fs.existsSync(`${testDb}${suffix}`)) fs.unlinkSync(`${testDb}${suffix}`);
        }
    }
    console.log(`\nResult: ${passed} passed, ${failed} failed`);
    process.exitCode = failed ? 1 : 0;
}

main();
