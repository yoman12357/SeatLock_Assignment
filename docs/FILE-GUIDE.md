# SeatLock file guide

This guide states what enters and leaves every project file. Generated folders such as `node_modules`, `dist`, and `data` are not source files and are excluded.

## Root files

| File | Input | Output or side effect | Responsibility |
| --- | --- | --- | --- |
| `.env.example` | Deployment choices | Documented environment names | Example configuration without secrets. |
| `.gitignore` | Git path matching | Excludes dependencies, builds, runtime databases, and secrets | Keeps generated and private files out of version control. |
| `package.json` | npm commands and dependency declarations | Reproducible scripts and Node version requirement | Defines how to build, run, test, and verify the application. |
| `package-lock.json` | Exact resolved npm packages | Deterministic installation graph | Must be changed through npm, not manually. |
| `vite.config.mjs` | Client source and `CLIENT_PORT` | Development proxy and production `dist` bundle | Connects React, Tailwind, and Vite. |
| `README.md` | Project behavior and commands | Primary setup and operating guide | Entry point for a developer or reviewer. |
| `docs/ARCHITECTURE.md` | Implemented system design | Architecture, request trace, state, and tradeoff diagrams | Explains why the system works. |
| `docs/FILE-GUIDE.md` | Project file inventory | Per-file input/output map | Explains where each responsibility lives. |
| `docs/REFERENCES.md` | Dependencies and consulted technical documentation | Source links and attribution | Separates upstream guidance from project implementation. |
| `docs/SUBMISSION.md` | Evaluation criteria and reviewer workflow | Demo script, evidence map, and final checklist | Explains how to review and present the project. |
| `.github/workflows/verify.yml` | Push or pull request | Build and backend correctness checks | Runs repeatable checks without private credentials. |
| `demo.mp4` | Author's screen recording | Submission demonstration | Shows holds, confirmations, and live availability; not generated code. |
| `docs/screenshots/concurrency-results.png` | Author's captured test output | Concurrency evidence | Supplements the recording; the tests remain reproducible with `npm test`. |

## Client entry and state

| File | Input | Output or side effect | Responsibility |
| --- | --- | --- | --- |
| `client/index.html` | Browser page load and saved theme | Root DOM node and early theme class | Prevents a theme flash before React starts. |
| `client/src/main.jsx` | Root DOM node and `App` | Mounted React tree | Small React entry point using `createRoot`. |
| `client/src/App.jsx` | Session responses, status JSON, activity JSON, SSE, and cross-tab session-change events | Page selection, identity-safe state, API commands, and toast messages | Refreshes shared-cookie identity, clears old account state, and ignores stale responses. |
| `client/src/styles.css` | Tailwind compiler and shared class names | Global theme, reusable component classes, and reduced-motion behavior | Holds styling that is shared across components. |
| `client/src/lib/api.js` | Path, method, body, headers, optional idempotency key and expected user ID | Parsed JSON or an error with status, request ID, code, and current user ID | Adds the identity consistency header without using it as authentication. |
| `client/src/hooks/useTheme.js` | System preference and `localStorage` | `dark` document class, theme color, and toggle function | Owns persistent theme state. |

## Client components

| File | Input | Output or side effect | Responsibility |
| --- | --- | --- | --- |
| `client/src/components/ActivityFeed.jsx` | Activity rows | Human-readable timeline | Maps domain reasons to labels, colors, and relative times. |
| `client/src/components/AuthScreen.jsx` | Theme, busy state, and authentication callback | Validated campus ID and passcode submission | Renders signup and login without owning server state. |
| `client/src/components/AvailabilityPanel.jsx` | Availability snapshot | Counts, capacity bar, and legend | Presents total, available, held, confirmed, and waitlisted counts. |
| `client/src/components/Brand.jsx` | Compact display option | SeatLock logo and label | Reuses the brand in auth and dashboard headers. |
| `client/src/components/Header.jsx` | User ID, connection status, theme actions, and logout action | Navigation header events | Shows identity and live connection state. |
| `client/src/components/Icons.jsx` | Size class names | Accessible decorative SVG elements | Keeps icons vector-based and avoids emoji characters. |
| `client/src/components/ReservationCard.jsx` | User status, availability, action state, and callbacks | State-specific actions and hold countdown | Renders none, held, confirmed, expired, and waitlisted states. |
| `client/src/components/ThemeToggle.jsx` | Current theme and toggle callback | Accessible light/dark button | Keeps theme control presentation separate from theme state. |
| `client/src/components/ToastRegion.jsx` | Toast list and dismiss callback | Temporary success and error notices | Provides non-blocking request feedback. |

## Server entry and middleware

| File | Input | Output or side effect | Responsibility |
| --- | --- | --- | --- |
| `server/index.js` | Environment, HTTP requests, and shutdown signals | Express server, routes, static client, expiry worker, and graceful shutdown | Defines middleware order and process lifecycle. |
| `server/db.js` | `DB_PATH`, initial configuration, and SQL statements | Open SQLite connection, schema, indexes, constraints, and triggers | Owns persistence setup and migration. |
| `server/middleware/request-context.js` | Optional `X-Request-Id` and request timing | Response request ID and structured completion log | Makes one HTTP attempt traceable without logging secrets. |
| `server/middleware/identity.js` | Session cookie or bearer token, optional expected user ID, and idempotency header | Authenticated `req.userId`, validated `req.idempotencyKey`, or a session-mismatch response | Rejects stale-tab identity before domain changes; ownership still comes from the verified token. |

Middleware order matters. Request context runs before JSON parsing so even malformed JSON responses carry a request ID. Authentication runs after public auth routes and before reservation routes.

## Server routes

| File | Input | Output or side effect | Responsibility |
| --- | --- | --- | --- |
| `server/routes/auth.js` | Registration, login, logout, and current-session HTTP requests | Session cookie and auth JSON responses | Converts auth service results into HTTP behavior. |
| `server/routes/status.js` | Authenticated user | Availability and that user's state | Sweeps expiry before returning the snapshot. |
| `server/routes/hold.js` | Authenticated user and idempotency key | Hold result | Thin HTTP adapter for `holdSeat`. |
| `server/routes/confirm.js` | Authenticated user and idempotency key | Confirmation result | Thin HTTP adapter for `confirmSeat`. |
| `server/routes/cancel.js` | Authenticated user and idempotency key | Reservation or waitlist cancellation result | Thin HTTP adapter for `cancelReservation`. |
| `server/routes/waitlist.js` | Authenticated user and idempotency key | Waitlist join result | Sweeps expiry, then delegates to the waitlist service. |
| `server/routes/events.js` | Authenticated long-lived GET request | SSE availability, user status, and keep-alive frames | Registers and cleans up live browser connections. |
| `server/routes/activity.js` | Authenticated pagination query | Bounded timeline page and total count | Reads the append-only activity log. |

Routes should stay thin. Domain decisions belong in services so HTTP details do not get mixed with transaction logic.

## Server services

| File | Input | Output or side effect | Responsibility |
| --- | --- | --- | --- |
| `server/services/auth.js` | Campus ID, passcode, registration key, or signed token | Password hashes, verified identity, and signed session token | Implements local account authentication. |
| `server/services/idempotency.js` | Key, user, action, status, and response body | Cached response lookup or insert | Keeps retry state inside the domain transaction. |
| `server/services/reservation.js` | Authenticated user and key | Hold, confirm, cancel, availability, activity, and broadcasts | Owns the main reservation state transitions. |
| `server/services/waitlist.js` | User, key, and available capacity | FIFO entry, position, or promoted hold | Owns waitlist rules and the promotion primitive. |
| `server/services/expiry.js` | Current time and optional excluded user | Removed expired holds and promoted users | Handles timer sweeps, request-time sweeps, and startup recovery. |
| `server/services/broadcast.js` | Committed availability or user status | SSE frames to eligible connected clients | Keeps network delivery outside database transactions. |

`promoteNext` is intentionally called only while its caller owns an immediate write transaction. Broadcasting is intentionally delayed until after commit so clients never observe rolled-back state.

## Tests

| File | Input | Output or side effect | Responsibility |
| --- | --- | --- | --- |
| `tests/concurrency.js` | Temporary database and random local port | 120 concurrent HTTP attempts and invariant assertions | Proves capacity, ownership, idempotency, expiry, FIFO, timeline, and restart behavior. |
| `tests/ui-smoke.js` | Production client build, temporary database, and local Edge or Chrome | Browser assertions and temporary screenshots | Proves signup, login, themes, responsive layout, cross-tab session changes, independent ownership, and live counts. |
| `tests/validate-db.js` | Configured `DB_PATH` | Migration and current database invariant report | Checks the real local database without starting HTTP. |
| `tests/k6-load-test.js` | Running disposable SeatLock server and k6 | Optional external load metrics and capacity assertion | Provides a separate load-tool scenario beyond the built-in correctness test. |

## Generated runtime directories

| Directory | Created by | Contents | Policy |
| --- | --- | --- | --- |
| `node_modules/` | `npm install` | Installed packages | Ignored; recreate from the lock file. |
| `dist/` | `npm run build` | Production browser assets | Ignored; never edit directly. |
| `data/` | Server startup | SQLite database, WAL, and shared-memory files | Ignored; preserve unless intentionally resetting local data. |

## How to answer code questions

For any snippet, identify these points in order:

1. Which layer owns it: component, API helper, middleware, route, service, or database.
2. What trusted and untrusted inputs enter it.
3. What value, response, database change, or event leaves it.
4. Which invariant it protects.
5. Which failure status or rollback behavior applies.
6. Which test proves the behavior.

This method is more useful than memorizing line counts because it connects each line to a system responsibility.
