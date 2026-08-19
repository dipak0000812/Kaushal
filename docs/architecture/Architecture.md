# Architecture

Modular monolith. One Node/Express service, one MongoDB database, code
split into feature modules under `src/modules`. No microservices, no
message queue, no background job scheduler — the corrected API
contract deliberately removes every design that assumed one (risk
scoring, posting closure, company auto-publish are all computed
inline, at request time).

## Module boundaries

```
src/modules/
  auth/            login, registration, JWT issuance
  onboarding/       tnp invites, tnp-created faculty/hod accounts, company verify
  student/         profile, browse/apply, accept/decline, progress logs, recommendations
  company/         internships CRUD, applicant view, shortlist/reject/offer, evaluate
  faculty/         assignment accept/reject, progress verification, risk-flag dismissal
  tnp/             company verify, offer verify/reject, override, mentor assignment, alerts, analytics
  hod/             department-scoped dashboard, read-only student view
  eligibility/      criteria-evaluation engine (used by student + company + tnp modules)
  risk/            live risk computation + dismissal persistence (used by faculty + tnp modules)
```

`eligibility` and `risk` are not user-facing modules — they're shared
services called by the modules above. Neither owns a route.

A module never imports another module's Mongoose model directly. It
calls that module's exported service function. `eligibility` and
`risk` are the two services every other module is allowed to depend
on freely, since they're stateless computation, not owned resources.

## Backend layers

```
routes/       → maps HTTP verb+path to a controller, applies roleGuard
controllers/  → parses/validates request, calls a service, shapes the response
services/     → business logic, transaction boundaries, calls models
models/       → Mongoose schemas, one file per collection
middleware/   → roleGuard, auth (JWT verify), errorHandler
utils/        → ALLOWED_TRANSITIONS table, shared validators
```

Controllers never talk to Mongoose directly. Services never read
`req` — they take plain arguments, which is what makes them reusable
across modules and directly unit-testable against the state-machine
tests.

## Request flow

```
Client
  → Express route
  → auth middleware (verifies JWT, attaches req.user{id, role, department?})
  → roleGuard([...allowedRoles]) (401/403 short-circuit)
  → controller (validates body/params, no business logic)
  → service (ownership/scope checks derived from req.user — never from
     request params; transaction if the operation spans invariants
     9 or 12; transition checked against ALLOWED_TRANSITIONS before
     any write)
  → model (Mongoose write/read)
  → controller shapes { success, data } or { success: false, error }
  → response
```

Row-level scoping (a company only sees its own postings, an HOD only
its own department, a faculty only its assigned students) happens in
the service layer, reading `req.user`, never a client-supplied
`?companyId=` or `?department=` — this is invariant #7 in the API
contract and it is enforced here, not just documented there.

## MongoDB interaction

Single database, accessed through Mongoose. Two operations require a
multi-document transaction, per the API contract's invariants:

- **Accept offer** (invariant #9): withdrawing the student's other
  `offered` applications and transitioning the accepted one must be
  one atomic write, or a race lets two offers end up accepted.
- **Company verify** (invariant #12): flipping `pending → verified`
  and auto-publishing that company's queued postings must be one
  atomic write, or a posting can be left stranded in
  `pendingApproval` after its company is already verified.

Everywhere else, a single-document write plus the append to
`Application.timeline[]` in the same call is sufficient — `timeline`
lives embedded on `Application`, so updating status and appending the
audit entry is already one write, not two.

Two constraints are enforced at the database level, not just in
service code, because concurrent requests can otherwise race past an
application-level check:
- unique partial index on `Application{studentId, internshipId}`
  excluding terminal states (invariant #8)
- unique partial index on `MentorAssignment{applicationId}` where
  `status` is `pending` or `accepted` (invariant #11)

## Intelligence / rule-engine placement

Both the eligibility engine and the risk engine are pure, stateless
service functions — no persisted score, no scheduled job.

- **Eligibility** (`modules/eligibility`): takes a student profile and
  an internship's `criteria`, returns every criterion evaluated,
  pass or fail, never short-circuited. Called live on browse
  (`GET /student/internships*`), and called again and snapshotted at
  the instant of `POST /student/applications`. The snapshot is the
  only place an eligibility result is ever persisted.
- **Risk** (`modules/risk`): takes an application's progress-log
  history and assignment data, returns a level + signals, computed on
  every read of `/tnp/alerts`, `/tnp/analytics/dashboard`, and
  `/faculty/students`. Nothing about risk is stored except
  `Dismissal` records — see database doc for the suppression rule.

Neither engine calls the other; neither engine writes anything except
the two explicit write paths above (eligibility snapshot on apply,
dismissal on faculty action).

## Authentication flow

JWT bearer token, issued at `/auth/login` or on successful
registration. Token payload carries `{userId, role}` only —
`department` (for faculty/hod scoping) is read from the user's stored
record on each request, not trusted from the token, so a department
change by T&P takes effect immediately without requiring re-login.

Enforcement is two-layer, matching API contract Section 3:
1. **Route-level** — `roleGuard([...])` rejects a role that has no
   business calling this endpoint at all (401/403).
2. **Service-level** — ownership/scope filtering using `req.user`,
   deciding *which rows* within an allowed endpoint this specific
   user may see or touch (e.g. a company can call
   `GET /company/internships/:id/applicants` but only for postings it
   owns).

Both layers are required on every protected route — route-level alone
is not sufficient for any endpoint that returns or mutates
role-scoped data.

## Major integration boundaries

- **Frontend ↔ backend**: the only contract is `docs/api/API_CONTRACTS.md`.
  No endpoint, field, or status value should exist in code that isn't
  in that document, and vice versa — if implementation needs to
  deviate, the contract doc changes first.
- **Module ↔ module**: through exported service functions only, never
  HTTP calls to itself, never direct model imports across module
  boundaries.
- **No external services**: no email/SMS provider, no file-storage
  service beyond a URL field, no background worker, no cache layer.
  Everything the API contract specifies is achievable inline within a
  single request/response cycle.