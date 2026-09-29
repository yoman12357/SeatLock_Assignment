const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const defaultDataDir = path.join(__dirname, '..', 'data');
const dbPath = path.resolve(process.env.DB_PATH || path.join(defaultDataDir, 'seatlock.db'));
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

function migrate() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL CHECK(status IN ('held', 'confirmed')),
            held_at TEXT NOT NULL,
            expires_at TEXT,
            confirmed_at TEXT,
            idempotency_key TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            CHECK(
                (status = 'held' AND expires_at IS NOT NULL AND confirmed_at IS NULL)
                OR
                (status = 'confirmed' AND expires_at IS NULL AND confirmed_at IS NOT NULL)
            )
        );

        CREATE TABLE IF NOT EXISTS waitlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL UNIQUE,
            joined_at TEXT NOT NULL,
            idempotency_key TEXT
        );

        CREATE TABLE IF NOT EXISTS activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reservation_id INTEGER,
            user_id TEXT NOT NULL,
            previous_state TEXT,
            new_state TEXT NOT NULL,
            reason TEXT NOT NULL,
            idempotency_key TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS idempotency_keys (
            key TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            response_status INTEGER NOT NULL,
            response_body TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
        CREATE INDEX IF NOT EXISTS idx_reservations_expires ON reservations(expires_at);
        CREATE INDEX IF NOT EXISTS idx_waitlist_joined ON waitlist(joined_at, id);
        CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);

        CREATE TRIGGER IF NOT EXISTS reservations_capacity_guard
        BEFORE INSERT ON reservations
        WHEN (SELECT COUNT(*) FROM reservations) >=
             CAST((SELECT value FROM config WHERE key = 'max_seats') AS INTEGER)
        BEGIN
            SELECT RAISE(ABORT, 'workshop_capacity_reached');
        END;

        CREATE TRIGGER IF NOT EXISTS reservations_state_insert_guard
        BEFORE INSERT ON reservations
        WHEN NOT (
            (NEW.status = 'held' AND NEW.expires_at IS NOT NULL AND NEW.confirmed_at IS NULL)
            OR
            (NEW.status = 'confirmed' AND NEW.expires_at IS NULL AND NEW.confirmed_at IS NOT NULL)
        )
        BEGIN
            SELECT RAISE(ABORT, 'invalid_reservation_state');
        END;

        CREATE TRIGGER IF NOT EXISTS reservations_state_update_guard
        BEFORE UPDATE OF status, expires_at, confirmed_at ON reservations
        WHEN NOT (
            (NEW.status = 'held' AND NEW.expires_at IS NOT NULL AND NEW.confirmed_at IS NULL)
            OR
            (NEW.status = 'confirmed' AND NEW.expires_at IS NULL AND NEW.confirmed_at IS NOT NULL)
        )
        BEGIN
            SELECT RAISE(ABORT, 'invalid_reservation_state');
        END;

        CREATE TRIGGER IF NOT EXISTS reservation_waitlist_guard
        BEFORE INSERT ON reservations
        WHEN EXISTS (SELECT 1 FROM waitlist WHERE user_id = NEW.user_id)
        BEGIN
            SELECT RAISE(ABORT, 'user_is_waitlisted');
        END;

        CREATE TRIGGER IF NOT EXISTS waitlist_reservation_guard
        BEFORE INSERT ON waitlist
        WHEN EXISTS (SELECT 1 FROM reservations WHERE user_id = NEW.user_id)
        BEGIN
            SELECT RAISE(ABORT, 'user_has_reservation');
        END;

        CREATE TRIGGER IF NOT EXISTS activity_log_no_update
        BEFORE UPDATE ON activity_log
        BEGIN
            SELECT RAISE(ABORT, 'activity_log_is_append_only');
        END;

        CREATE TRIGGER IF NOT EXISTS activity_log_no_delete
        BEFORE DELETE ON activity_log
        BEGIN
            SELECT RAISE(ABORT, 'activity_log_is_append_only');
        END;
    `);

    const activityColumns = db.prepare('PRAGMA table_info(activity_log)').all();
    if (!activityColumns.some(column => column.name === 'reservation_id')) {
        db.exec('ALTER TABLE activity_log ADD COLUMN reservation_id INTEGER');
    }

    const seed = db.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
    seed.run('max_seats', String(process.env.MAX_SEATS || 20));
    seed.run('hold_duration_seconds', String(process.env.HOLD_DURATION_SECONDS || 300));
    seed.run('auth_secret', process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex'));
}

function getConfig(key) {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    return row ? row.value : null;
}

module.exports = { db, dbPath, migrate, getConfig };
