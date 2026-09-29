# SeatLock

SeatLock is a real-time reservation service for a 20-seat campus workshop. The interface is built with React, Vite, and Tailwind CSS; Express and SQLite handle authenticated reservation changes on the server. A seat starts as a temporary hold, can be confirmed by its owner, and returns to the pool when it is cancelled or expires. If the workshop is full, users can join a FIFO waitlist.

Detailed design references:

- [Architecture and request trace](docs/ARCHITECTURE.md)
- [File-by-file input and output guide](docs/FILE-GUIDE.md)

## Run locally

Requirements: Node.js 22.12 or newer.

```bash
npm install
npm start
```

`npm start` creates a production frontend build and starts the API at `http://localhost:3000`. Create an account there and reserve a seat. The SQLite database is created at `data/seatlock.db` and is ignored by Git.

For frontend and backend development with automatic reloads:

```bash
npm run dev
```

The Vite development site runs at `http://localhost:5174` and proxies `/api` to the Express server on port 3000. Vite uses a strict port so an existing process cannot silently move SeatLock to an unexpected address. Set `CLIENT_PORT` if you need a different frontend port.

## Frontend structure

```text
client/
├── index.html
└── src/
    ├── components/     React UI components
    ├── hooks/          persistent light/dark theme state
    ├── lib/            API and idempotency helpers
    ├── App.jsx         session, SSE, and reservation state
    ├── main.jsx        React entry point
    └── styles.css      Tailwind import and shared component styles
```

The theme toggle follows the operating-system preference for a first-time visitor, saves explicit changes in `localStorage`, and applies the theme before React loads to avoid a light/dark flash. All reservation data still comes from the server; React does not make capacity decisions locally.

## Project structure

```text
SeatLock/
├── client/              React and Tailwind frontend
├── server/
│   ├── middleware/      authenticated identity validation
│   ├── routes/          HTTP and SSE endpoints
│   ├── services/        reservation, expiry, waitlist, and auth logic
│   ├── db.js            schema, migrations, constraints, and triggers
│   └── index.js         Express application entry point
├── tests/
│   ├── concurrency.js   isolated 120-user correctness suite
│   ├── ui-smoke.js      signup, login, theme, and responsive browser checks
│   ├── validate-db.js   configured database invariant check
│   └── k6-load-test.js  optional external load-test scenario
├── .env.example
├── package.json
└── vite.config.mjs
```

Useful environment variables:

| Variable | Default | Purpose |
| --- | ---: | --- |
| `PORT` | `3000` | HTTP port |
| `DB_PATH` | `data/seatlock.db` | SQLite file path |
| `MAX_SEATS` | `20` | Initial capacity for a new database |
| `HOLD_DURATION_SECONDS` | `300` | Initial hold duration for a new database |
| `EXPIRY_INTERVAL_MS` | `1000` | Background expiry sweep interval |
| `AUTH_SECRET` | generated | Session signing key for a new database |

Configuration is seeded only when a database is first created. This prevents a restart with different environment variables from silently changing a live workshop.

## Reservation lifecycle

```text
none ──hold──> held ──confirm──> confirmed
                 │                   │
                 ├──expiry──> expired│
                 └──cancel───────────┴──> cancelled

none ──join when full──> waitlisted ──promotion──> held
                              │
                              └──cancel──> cancelled
```

`expired` and `cancelled` are terminal timeline states, not active rows. Active reservations contain only `held` or `confirmed`; their complete history remains in `activity_log`. Timeline rows retain the reservation ID even after the active row is removed, so repeated bookings by one user remain distinguishable.

## Correctness approach

All reservation writes run in SQLite **immediate transactions**. This acquires the database write lock before capacity is read, so two requests cannot both observe the same last seat. Node handles requests asynchronously, while `better-sqlite3` and SQLite serialize the short write transactions.

The database also provides a second line of defence:

- a trigger rejects inserts above the configured capacity;
- `reservations.user_id` and `waitlist.user_id` are unique;
- cross-table triggers prevent a user from being both reserved and waitlisted;
- state checks prevent invalid held/confirmed row shapes;
- triggers reject updates or deletes from the append-only activity timeline.

Before availability-sensitive actions, expired holds are released. The expiry worker runs on a timer and immediately at startup, so holds that expire during downtime are recovered. Each freed seat calls the FIFO promotion routine once, inside the same transaction. Promotion deletes the oldest waitlist row before creating its hold.

## Identity and ownership

Users register a campus ID and passcode. Passcodes are salted and hashed with Node's `scrypt`; they are never stored directly. A successful registration or login creates a signed, seven-day session token. The browser receives it in an `HttpOnly`, `SameSite=Strict` cookie. API clients can use the same token as `Authorization: Bearer <token>`.

Reservation routes derive the user ID only from the verified session. They never accept an owner ID from the request body, which prevents one user from confirming or cancelling another user's reservation. User-specific Server-Sent Events are also sent only to that authenticated user's connection.

This is appropriate local authentication for the project. A campus deployment would normally replace it with the institution's SSO while leaving the reservation ownership checks unchanged.

## Idempotency

Every reservation-changing request requires an `Idempotency-Key` header (the legacy `X-Idempotency-Key` spelling is also accepted). The key is stored in the same transaction as the state change, together with the HTTP status and JSON response.

- Reusing a key for the same user and action returns the stored response.
- Reusing it for another user or action returns `409`.
- A transaction rollback removes both the attempted state change and its key.

This makes retries safe for holds, confirmations, cancellations, waitlist joins, and account registration.

## API summary

| Method | Route | Authentication | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Create an account; requires an idempotency key |
| `POST` | `/api/auth/login` | No | Sign in |
| `POST` | `/api/auth/logout` | Cookie | Clear the browser session |
| `GET` | `/api/auth/me` | Cookie or bearer | Read the current identity |
| `GET` | `/api/status` | Yes | Availability and the current user's state |
| `POST` | `/api/hold` | Yes | Hold an available seat |
| `POST` | `/api/confirm` | Yes | Confirm the owner's unexpired hold |
| `POST` | `/api/cancel` | Yes | Cancel the owner's reservation or waitlist entry |
| `POST` | `/api/waitlist` | Yes | Join when the workshop is full |
| `GET` | `/api/events` | Yes | Live updates over SSE |
| `GET` | `/api/activity` | Yes | Paginated append-only timeline |

Example using a bearer token:

```bash
curl -X POST http://localhost:3000/api/hold \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Idempotency-Key: hold-7f303ca5-24ee-48ba-8651-f980720eb8ef"
```

## Tests

The main test starts a server on a random port with its own temporary database:

```bash
npm test
```

It sends 120 simultaneous hold attempts, confirms the 20 winners, checks database uniqueness, repeats an identical request, attempts to confirm a genuinely expired hold, verifies exactly-once FIFO promotion, and restarts the server to check downtime recovery. It also verifies that the activity log cannot be deleted.

The UI smoke test builds the production frontend, opens it in a locally installed Edge or Chrome browser, checks desktop and mobile overflow, creates an account, signs out and back in, creates a seat hold, and verifies theme persistence. Review screenshots are written to the operating system's temporary directory (`seatlock-ui-artifacts`) instead of the repository:

```bash
npm run test:ui
```

Run the production build, concurrency suite, and browser suite together with:

```bash
npm run verify
```

Validate migrations and invariants in the configured SQLite database without starting the web server:

```bash
npm run validate:db
```

An optional k6 scenario is included for interactive load testing against a fresh running server:

```bash
npm run test:k6
```

The k6 setup creates 120 test accounts, so use a disposable database when running it repeatedly.

## Troubleshooting

- Use `http://localhost:3000` after `npm start`; use `http://localhost:5174` only while `npm run dev` is active.
- New IDs must use **Create an account** once before they can use **Sign in**.
- If an old browser tab reports `Missing or empty X-User-Id header`, an obsolete SeatLock server is still running. Stop the old Node process or terminal, run `npm start` again, and hard-refresh `http://localhost:3000`.
- The production build directory and test screenshots are generated and intentionally excluded from the repository. `npm start` rebuilds the frontend automatically.
