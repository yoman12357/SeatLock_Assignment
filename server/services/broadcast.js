const clients = new Map();

function addClient(res, userId) {
    clients.set(res, userId);
    res.on('close', () => clients.delete(res));
}

function writeEvent(client, eventName, data) {
    if (!client.destroyed) {
        client.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
    }
}

function broadcastAvailability(data) {
    for (const client of clients.keys()) writeEvent(client, 'availability', data);
}

function broadcastUserUpdate(userId, data) {
    for (const [client, clientUserId] of clients.entries()) {
        if (clientUserId === userId) {
            writeEvent(client, 'user_status', { user_id: userId, ...data });
        }
    }
}

function broadcastActivity() {
    for (const client of clients.keys()) writeEvent(client, 'activity', { changed: true });
}

function getClientCount() {
    return clients.size;
}

module.exports = {
    addClient,
    broadcastAvailability,
    broadcastUserUpdate,
    broadcastActivity,
    getClientCount
};
