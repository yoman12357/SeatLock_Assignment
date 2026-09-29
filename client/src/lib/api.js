export function createIdempotencyKey(prefix = 'web') {
    if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function apiRequest(path, options = {}) {
    const headers = { ...options.headers };
    headers['X-Request-Id'] ||= createIdempotencyKey('request');
    if (options.body) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

    const response = await fetch(path, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.error || 'Something went wrong');
        error.status = response.status;
        error.requestId = response.headers.get('X-Request-Id');
        throw error;
    }
    return data;
}
