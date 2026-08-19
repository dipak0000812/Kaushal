# TrackIntern — Backend

Institutional internship lifecycle control system, built for the GHR
Inter-Track Hackathon (21 Aug 2026). This repository is backend + database
+ intelligence layer only. Frontend is developed separately by Nihar and
integrates against `docs/api/API_CONTRACT.md`.

## Stack
Node.js, Express, MongoDB (Mongoose), JWT auth. Modular monolith — see
`docs/decisions/ADR-0001-modular-monolith.md` for why.

## Project structure
```
src/
  config/        env loading, db connection
  constants/     roles, application status enum, error codes — shared contracts
  middleware/    auth, roleGuard, error handling
  models/        Mongoose schemas (barrel export) — implemented next step
  modules/       one folder per domain: auth, users, eligibility,
                 internships, evidence, risk, analytics,
                 recommendations, mentorship
  db/seed/       demo-data seeding
  utils/         shared response envelope, async handler
  app.js         Express app (importable by tests, no DB/port binding)
  server.js      process entrypoint (connects DB, starts listening)
tests/
  unit/          pure-logic tests (state machine, services)
  integration/   supertest-based route tests
docs/
  api/API_CONTRACT.md         source of truth for every endpoint
  architecture/ARCHITECTURE.md  system design rationale
  architecture/DATA_MODEL.md    schema reference
  decisions/                    ADRs
```

## Setup

### Option A — Docker (recommended, matches deployment environment)
```bash
cp .env.example .env
docker compose up --build
```
API on `http://localhost:5000`, MongoDB on `localhost:27017`.

### Option B — Local Node + local/Atlas MongoDB
```bash
cp .env.example .env
# edit .env: set MONGO_URI to a local mongod or an Atlas connection string
npm install
npm run dev
```

## Commands
```bash
npm run dev      # start with nodemon (auto-restart)
npm start        # start without nodemon (production-style)
npm test         # run all tests
npm run test:watch
npm run seed      # populate demo data — implemented in the next step
```

## Where to look first
- `docs/api/API_CONTRACT.md` — every endpoint, every state machine, every
  role permission. This is the contract; implementation must match it
  exactly, not the other way around.
- `src/modules/internships/stateMachine.js` — the one place transition
  validity is decided. Every application-status write must be checked
  against this table.
- `docs/architecture/DATA_MODEL.md` — schema shapes for the next
  implementation step.

## Current status
Repository bootstrap only. No business logic, no mounted routes, no
Mongoose schemas yet — module boundaries, shared contracts (roles, status
enum, state-transition table, response envelope), Docker setup, and
documentation are in place. See "Next implementation step" in the
handoff summary for what comes next.