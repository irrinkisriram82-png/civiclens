# CivicLens code guide

Read this before the judging round. It explains where everything lives so you can walk a judge through the code in your own words. Run `npx prettier --write .` any time to keep formatting tidy.

## Project map
| File | What it does |
|---|---|
| `server.js` | The whole backend. Sections are marked with `// ----------` comments: storage, helpers, accounts, AI layer, letters and escalation, seed data, API routes. |
| `public/index.html` | Page structure: tabs, forms, the About and credits page. |
| `public/app.js` | Everything the browser does: maps, photo resize, voice, report flow, filters, officer console, live updates, languages. |
| `public/style.css` | Look and feel, dark mode, mobile layout. |
| `data/landmarks.json` | Real schools and hospitals used by the severity score. Verify and extend it. |
| `data/db.json` | The data store (created on first run). Delete it to reset to demo data. |
| `test.js` | Automated tests (`npm test`). |

## What happens when a citizen reports a problem
1. **Browser** shrinks the photo (`shrink` in `app.js`) and sends photo, text and pin to `POST /api/triage`.
2. **Server** checks the pin is inside the service area, then calls the AI (`triage` in `server.js`). The AI answers in strict JSON: issue type, size 1-5, safety 1-5, road type, language, summary, rationale. If the AI fails, `heuristic` gives a labelled offline guess.
3. **Server** computes the priority score with `score()` (plain arithmetic, see below) and checks for duplicates: same photo hash, or same type within 40 m.
4. **Citizen** reviews the result, can correct the category, and submits (`POST /api/reports`). The report is saved, routed with the routing table, and broadcast to every open screen through server-sent events.
5. **Officers** update status and assignee (`PATCH /api/issues/:id/status`). Each change is written to the public timeline and to the audit log.
6. **Escalation** (`escalate`) runs hourly and flags issues older than their service target (Critical 2 days, High 7, Medium 14, Low 30).
7. **Verification** (`POST /api/issues/:id/verify`): the reporter or an officer uploads an "after" photo, the AI compares it with the "before" photo, and a "fixed" verdict resolves the issue while "not fixed" reopens it.

## The part that is NOT AI: the priority score
Look at `WEIGHTS` and `score()` in `server.js`. The AI only gives ratings. The code turns them into points:
damage extent 25, safety risk 30, nearness to schools or hospitals 20, road traffic 10, number of citizen reports 10, days unresolved 5. You can change `WEIGHTS` and explain why. The "Explore the score" sliders on the report screen call `POST /api/score-preview` so a judge can see the maths move.

## Security choices you can explain
- Passwords are hashed with scrypt; login tokens are signed and expire (`hashPw`, `sign`, `unsign`).
- Every staff route checks the role (`need('officer')`, `need('admin')`).
- Only the reporter (device key or account) or staff can verify or confirm a repair (`isOwner`).
- Rate limits, service-area check, photo-reuse hash, one "Me too" per person, audit log of privileged actions.
- Citizen text is passed to the AI as quoted data, and the AI reply is validated before use (`triage`).

## Questions judges may ask (prepare your own answers)
1. Why is the score computed in code rather than by the AI? (Reproducible, explainable, auditable.)
2. What happens if the AI is down or wrong? (Offline fallback, human override, audit trail.)
3. How do you stop fake or repeated reports? (Photo hash, service area, rate limits, one support per person.)
4. How would this reach real authorities? (Adapter for email or the municipality's system; delivery is simulated today.)
5. What would you change to scale it? (Database instead of a JSON file, background job queue, multiple server instances.)

## Be honest about how it was built
This project was built with the help of an AI coding assistant, and the About page and README say so. What matters is that you understand it, made real decisions, and did real work. Keep a log of yours below and edit it truthfully before you submit.

### My contribution log (fill in)
- Chose the problem, track and the idea: ...
- Collected and reported real photos from my town (how many, where, when): ...
- Verified and added local schools and hospitals in `data/landmarks.json`: ...
- Decided the score weights and why (changes I made to `WEIGHTS`): ...
- Tested every feature and reported these bugs: ...
- Got the Telugu and Hindi text reviewed by: ...
- Deployed the app and handled these problems: ...
