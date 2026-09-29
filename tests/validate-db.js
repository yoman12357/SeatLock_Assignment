const { db, dbPath, migrate } = require('../server/db');

try {
    migrate();

    const triggers = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type = 'trigger'
        ORDER BY name
    `).all().map(row => row.name);
    const requiredTriggers = [
        'activity_log_no_delete',
        'activity_log_no_update',
        'reservation_waitlist_guard',
        'reservations_capacity_guard',
        'reservations_state_insert_guard',
        'reservations_state_update_guard',
        'waitlist_reservation_guard'
    ];

    const invalidStates = db.prepare(`
        SELECT COUNT(*) AS count
        FROM reservations
        WHERE NOT (
            (status = 'held' AND expires_at IS NOT NULL AND confirmed_at IS NULL)
            OR
            (status = 'confirmed' AND expires_at IS NULL AND confirmed_at IS NOT NULL)
        )
    `).get().count;
    const crossDuplicates = db.prepare(`
        SELECT COUNT(*) AS count
        FROM reservations INNER JOIN waitlist USING (user_id)
    `).get().count;
    const occupied = db.prepare('SELECT COUNT(*) AS count FROM reservations').get().count;
    const capacity = Number(db.prepare("SELECT value FROM config WHERE key = 'max_seats'").get().value);
    const missingTriggers = requiredTriggers.filter(name => !triggers.includes(name));
    const valid = invalidStates === 0
        && crossDuplicates === 0
        && occupied <= capacity
        && missingTriggers.length === 0;

    console.log(JSON.stringify({
        database: dbPath,
        occupied,
        capacity,
        invalid_reservation_states: invalidStates,
        reservation_waitlist_duplicates: crossDuplicates,
        missing_triggers: missingTriggers,
        valid
    }, null, 2));

    if (!valid) process.exitCode = 1;
} finally {
    db.close();
}
