import http from 'k6/http';
import exec from 'k6/execution';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const USERS = 120;

export const options = {
    scenarios: {
        reservation_rush: {
            executor: 'shared-iterations',
            vus: USERS,
            iterations: USERS,
            maxDuration: '30s'
        }
    },
    thresholds: { http_req_duration: ['p(95)<750'] }
};

function requestKey(prefix, index) {
    return `${prefix}-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`;
}

export function setup() {
    const accounts = [];
    for (let index = 0; index < USERS; index++) {
        const userId = `k6_user_${String(index).padStart(3, '0')}`;
        const response = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
            user_id: userId,
            passcode: 'k6-passcode'
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Idempotency-Key': requestKey('register', index)
            }
        });
        if (response.status === 201) {
            accounts.push({ userId, token: response.json('token') });
        }
    }
    if (accounts.length !== USERS) throw new Error(`Created ${accounts.length}/${USERS} load-test users`);
    return { accounts };
}

export default function (data) {
    const index = exec.scenario.iterationInTest;
    const account = data.accounts[index];
    const idempotencyKey = requestKey('hold', index);
    const params = {
        headers: {
            Authorization: `Bearer ${account.token}`,
            'Idempotency-Key': idempotencyKey
        },
        responseCallback: http.expectedStatuses(201, 422)
    };

    const hold = http.post(`${BASE_URL}/api/hold`, null, params);
    check(hold, { 'hold is granted or workshop is full': response => [201, 422].includes(response.status) });

    const retry = http.post(`${BASE_URL}/api/hold`, null, {
        headers: params.headers,
        responseCallback: http.expectedStatuses(201, 422)
    });
    check(retry, {
        'idempotent retry has the same status': response => response.status === hold.status,
        'idempotent retry has the same body': response => response.body === hold.body
    });

    if (hold.status === 201) {
        const confirm = http.post(`${BASE_URL}/api/confirm`, null, {
            headers: {
                Authorization: `Bearer ${account.token}`,
                'Idempotency-Key': requestKey('confirm', index)
            }
        });
        check(confirm, { 'winning hold confirms': response => response.status === 200 });
    }
}

export function teardown(data) {
    const verifier = data.accounts[0];
    const response = http.get(`${BASE_URL}/api/status`, {
        headers: { Authorization: `Bearer ${verifier.token}` }
    });
    const availability = response.json('availability');
    console.log(`Final state: ${availability.confirmed} confirmed, ${availability.held} held`);
    if (availability.confirmed > 20 || availability.held + availability.confirmed > 20) {
        throw new Error('Capacity was exceeded');
    }
}
