# References and credits

## Libraries used

The lock file records exact versions; these links identify their upstream projects and maintainers.

| Project and maintainers | Used for |
| --- | --- |
| [React, Meta and React contributors](https://github.com/facebook/react) | Component rendering and frontend state. |
| [Tailwind CSS, Tailwind Labs](https://github.com/tailwindlabs/tailwindcss) | Utility styling and theme presentation. |
| [Vite contributors](https://github.com/vitejs/vite) | Frontend development server and production build. |
| [Express contributors](https://github.com/expressjs/express) | HTTP routing, middleware, and static files. |
| [better-sqlite3, Joshua Wise and contributors](https://github.com/WiseLibs/better-sqlite3) | SQLite access and short synchronous transactions. |
| [SQLite developers](https://www.sqlite.org/) | Persistent database, constraints, indexes, and triggers. |
| [Playwright, Microsoft](https://github.com/microsoft/playwright) | Real-browser UI smoke checks through `playwright-core`. |
| [concurrently, Open CLI Tools contributors](https://github.com/open-cli-tools/concurrently) | Running frontend and backend development processes together. |

## Design and testing references

- [SQLite transactions, SQLite developers](https://www.sqlite.org/lang_transaction.html): `BEGIN IMMEDIATE` acquires the write transaction before the service reads capacity. Used in the reservation, waitlist, and expiry services.
- [SQLite CREATE TRIGGER, SQLite developers](https://www.sqlite.org/lang_createtrigger.html): database-enforced capacity, cross-table uniqueness, and append-only timeline rules in `server/db.js`.
- [Using server-sent events, MDN contributors](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events): event-stream framing and connection lifecycle in `server/routes/events.js` and `server/services/broadcast.js`.
- [Node.js crypto documentation, Node.js contributors](https://nodejs.org/api/crypto.html): salted `scrypt` password hashing and signed sessions in `server/services/auth.js`.
- [k6 documentation, Grafana Labs](https://grafana.com/docs/k6/latest/): the optional external load scenario in `tests/k6-load-test.js`.
- [Recruitment task repository, WebClub NITK](https://github.com/WebClub-NITK/GDGxIris-Recruitments-2026/tree/main/Standalone%20Tasks): the SeatLock requirements and acceptance criteria.

The assignment also suggests PostgreSQL locking references. This implementation uses SQLite instead; PostgreSQL is not a dependency and PostgreSQL row-locking semantics do not describe this database.

When adding an external snippet or adapting another implementation, record the source URL, developer, affected file, and license here. Do not claim a repository was consulted or starred unless it actually was. Star repositories you personally referred to from your own GitHub account.
