# CivicLens v2

AI-assisted civic issue reporting and public accountability platform (IDEA//FORGE, Track 1).
Citizens report problems by photo, text or voice. AI classifies, scores and routes each report. Officers act on a priority queue. Everything is tracked publicly, in real time.

## How this was built
Built by me with the help of an AI coding assistant (Claude). I directed the design, tested it, chose the scoring policy, and collected the real local data. See `CODE_GUIDE.md` for a plain-language tour of the code.

## Run it (2 minutes)
Requires Node.js 18 or newer.
```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
# edit .env: add ANTHROPIC_API_KEY, set MAP_LAT / MAP_LNG for your town, change the passwords
npm start                 # open http://localhost:3000
npm test                  # unit + integration tests
```
Without an API key the app still runs using a clearly labelled offline keyword fallback. Real AI needs `ANTHROPIC_API_KEY`.

## Demo accounts (Account tab)
| Role | Email | Password |
|---|---|---|
| Officer | officer@civiclens.demo | Officer@123 |
| Administrator | admin@civiclens.demo | Admin@123 |
| Citizen | citizen@civiclens.demo | Citizen@123 |

Anyone can also register as a citizen, or report anonymously. **Change the staff passwords in `.env` before deploying.** (The defaults are created only on first run; delete `data/db.json` to recreate them.)

## Features
- **Report:** photo, text, voice dictation (Telugu, Hindi, English, Odia via the browser Web Speech API), GPS or map pin. UI in English, Telugu and Hindi.
- **AI triage:** type, language, English summary, confidence, rationale. 25 s timeout with one retry, then a labelled offline fallback. Citizen text is treated as untrusted data (prompt-injection safe handling, schema validation).
- **Transparent priority score (0-100):** damage 25, safety 30, near school/hospital 20, traffic 10, citizen reports 10, age 5. AI gives ratings; code does the arithmetic.
- **Duplicates:** same type within 40 m, plus **photo-reuse detection** (same image hash blocked).
- **Live updates:** every viewer's map, list and toasts update instantly (server-sent events).
- **Map filters + search, deep links** (`/#CL-2026-00101`), "Me too" support (one per person), complaint letter.
- **Officer/admin console:** priority queue, status workflow, assignee, category override (re-routes), notes on the public timeline, editable routing rules.
- **Accountability loop:** escalation agent (service targets by priority band; hourly job plus an admin demo button), AI before/after repair verification (only the reporter or an officer can trigger it), and citizen "Confirm fixed / Dispute" which reopens the issue.
- **Audit log** of privileged actions (admin).
- **Reliability and security:** scrypt password hashing, signed expiring tokens, role checks on every protected route, rate limiting, service-area validation, atomic data writes, health check (`/api/health`), security headers, 14 integration assertions in `npm test`.

## Demo script (about 3 minutes)
1. Open the app on two devices. Report a pothole photo on one, dictating in Telugu. Show the **other device update live**.
2. Show the score breakdown, routing and complaint letter.
3. Re-upload the same photo: show photo-reuse detection.
4. Sign in as officer: assign and move the status. Watch the public timeline update live.
5. Sign in as admin: run the escalation agent, show the escalation letter and audit log.
6. Upload an "after" photo as the reporter: show the AI verdict. Dispute or confirm the fix.
7. Analytics tab: backlog by department and most-ignored issues.

## Architecture
```
Browser (HTML/JS, Leaflet + OSM) <-- SSE live updates --> Express API (server.js)
  AI layer: Anthropic Messages API (vision), timeout + retry + offline fallback
  Scoring/routing/escalation: deterministic code, audited
  Storage: data/db.json (atomic writes) + data/uploads  (use Postgres in production)
```

## Customise
Set `MAP_LAT`/`MAP_LNG` and edit `data/landmarks.json` (a starter list of real Palasa schools and hospitals is included; verify and extend it) so the "near school or hospital" factor is meaningful. Delete `data/db.json` to reseed demo issues around the new centre.

## Deploy
- **Render:** push to GitHub, create a Blueprint from `render.yaml`, set `ANTHROPIC_API_KEY` and passwords.
- **Docker:** `docker build -t civiclens . && docker run -p 3000:3000 -v civic:/data --env-file .env civiclens`
- Always attach persistent storage for `DATA_DIR`.

## Honest limitations (say these in your submission)
- Complaint delivery to authorities is **simulated** (letters are generated; no real integration).
- Storage is a JSON file: fine for a prototype, replace with Postgres/Supabase for scale. SSE works on a single server instance.
- Reporter ownership for anonymous users relies on a device key stored in the browser.
- Photo fraud protection is basic (hash reuse + service area); real deployments need EXIF/location checks and moderation.
- Telugu and Hindi UI strings should be reviewed by a native speaker.
- AI is advisory: officials make the final decision.
- Credits: Leaflet, OpenStreetMap contributors, CARTO, Express, Google Gemini or Anthropic Claude (whichever provider you configure), and an AI coding assistant used to help write the code. An in-app About & credits page repeats this.
