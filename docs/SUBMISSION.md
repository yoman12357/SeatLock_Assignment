# Submission and demonstration

## Reviewer entry point

1. Clone the repository and install Node.js 22.12 or newer.
2. Run `npm ci` and `npm start`; see the README for the Windows installation fallback.
3. Open `http://localhost:3000`, create an account, and hold a seat.
4. Run `npm run verify` with Edge or Chrome installed. Backend tests use their own temporary database; they do not reset your workshop.
5. Read [ARCHITECTURE.md](ARCHITECTURE.md) for diagrams and [FILE-GUIDE.md](FILE-GUIDE.md) for each file's inputs and outputs.

## Evaluation evidence

| Criterion | Evidence | What still requires the author |
| --- | --- | --- |
| Effort and development practice | Real commit history, focused modules, automated checks | Explain actual work and tradeoffs; do not rewrite dates or manufacture history. |
| Documentation | README, architecture/request traces, file guide | Follow the setup once from a fresh clone. |
| External-source understanding | [REFERENCES.md](REFERENCES.md) | Explain the references and credit any additional sources actually used. |
| Features beyond the basic flow | Request IDs, append-only timeline, restart recovery, theme persistence | Demonstrate these without claiming they are novel inventions. |
| Working submission | Local setup and concurrency/UI tests | Record and add the required root `demo.mp4`. |
| Deployment | README explains the SQLite hosting constraint | Add a real deployment link if hosted; otherwise give local setup instructions. |

## Suggested recording: 4-6 minutes

Save the recording as `demo.mp4` in the project root.

1. Show signup, login, the available/held/confirmed counts, and light/dark themes.
2. Open a second authenticated session and show live availability changing without refreshing.
3. Hold a seat, point out its server-provided expiry, and confirm it. Show the timeline.
4. Run `npm test` and show the 120 simultaneous attempts for 20 seats and final assertions. Explain the expired-hold, idempotency, FIFO, and restart tests rather than filling the real workshop with test users.
5. Trace one hold request through the API helper, identity middleware, route, immediate transaction, constraints, and committed SSE update using the architecture diagram.
6. Explain why SQLite requires durable storage, what would change for multiple backend instances, and what is intentionally out of scope.

Do not display passcodes, bearer tokens, session cookies, or signing secrets. The video is not complete until you record it and check that it plays.

## Explain these without reading code aloud

- Why is a temporary hold different from a confirmed reservation?
- Why must the write lock be acquired before checking capacity?
- How do a unique constraint and an idempotency key solve different problems?
- Why does promotion delete the FIFO entry and create a hold inside one transaction?
- Why are SSE broadcasts sent after commit, not before it?
- What happens when a hold expires while the server is offline?
- Which data comes from a verified identity, and which request fields remain untrusted?

## Final handoff

- Add `demo.mp4` and verify the README link works on GitHub.
- Keep an ordinary GitHub video upload under 100 MB; for a larger recording, use a hosted video link or Git LFS and document it.
- Check that no `.env`, database, dependencies, generated builds, or logs are staged.
- Share the repository, local setup, recording, and any real deployed URL.
