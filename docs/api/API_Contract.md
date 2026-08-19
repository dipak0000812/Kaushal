# Kaushal — API Contract 

Base path: `/api/v1`. All protected routes require `Authorization: Bearer <JWT>`. All responses: `{ success, data, error }`. Errors: `{ success: false, error: { code, message, details? } }`. Standard HTTP codes: 400 validation, 401 unauth, 403 forbidden-role-or-scope, 404, 409 conflict/invalid-transition, 422 business-rule-violation.

This version incorporates a full lifecycle sanity pass — six defects found and fixed versus the earlier draft: a missing student-accept step (multi-offer withdrawal had no trigger), a mentor-assignment transition that skipped the faculty-accept step, an unreachable T&P override path, postings that could get stuck pending after their company was later verified, a lazy posting-closure check that ran on reads only, and a risk-flag design that assumed a background job we don't have budget for. All six are resolved below and reflected directly in the endpoints and state machines — this is not a patch list, it's the corrected contract.

---

## 1. API CONTRACT

### Auth & Onboarding

| Endpoint | Method | Role | Notes |
|---|---|---|---|
| `/auth/register/student` | POST | public | self-register. `{name, email, password, department, year}` |
| `/auth/register/company` | POST | public | requires `inviteToken`. Creates account with `status: pending`. `{companyName, email, password, inviteToken}` |
| `/auth/login` | POST | public | returns `{token, role, userId}` |
| `/tnp/invites` | POST | tnp | creates a company invite token. `{companyName, contactEmail}` → `{inviteToken, expiresAt}` |
| `/tnp/users` | POST | tnp | creates faculty/HOD account. `{name, email, role: faculty\|hod, department}`. Idempotent on email — 409 if email exists |
| `/tnp/companies/:id/verify` | PATCH | tnp | `pending → verified`, one-way. **Side effect (fix #4):** in the same transaction, auto-approves and publishes any of this company's postings still sitting in the pending-approval queue — a posting must never remain stuck after its company gets verified |

### Student

| Endpoint | Method | Role | Notes |
|---|---|---|---|
| `/student/profile` | GET/PATCH | student (self) | PATCH rejected with 409 once the student has any non-draft application on record |
| `/student/internships` | GET | student | list open internships + live-computed `eligibility.eligible` badge only (lightweight payload) |
| `/student/internships/:id` | GET | student | full per-criterion breakdown, live-computed, not stored |
| `/student/applications` | POST | student | body `{internshipId}`. Server re-checks posting is still open (lazy closure check runs here too — fix #5, see Section 2) before allowing insert; 404/409 if closed. Server computes and **snapshots** eligibility at this instant, honestly, **even if ineligible** (fix #3 — submission is not blocked server-side; only the UI disables the Apply button for ineligible students). 409 on duplicate (unique index on `studentId+internshipId` excluding terminal states) |
| `/student/applications` | GET | student | own applications, paginated, `?status=` filter |
| `/student/applications/:id/accept` | PATCH | student | **new endpoint (fix #1).** Valid only from `offered`. This is the actual trigger for multi-offer resolution: in the same transaction, all of this student's *other* applications currently in `offered` are transitioned to `withdrawn` |
| `/student/applications/:id/decline` | PATCH | student | valid only from `offered` (before accept) |
| `/student/applications/:id/progress-logs` | POST | student | only valid when `currentStatus === inProgress`. `{description, evidence: {type, value}}` |
| `/student/recommendations` | GET | student | should-have; deterministic skill-overlap ranking, explicitly labeled `method: "deterministic-skill-overlap"` in response |

### Company

| Endpoint | Method | Role | Notes |
|---|---|---|---|
| `/company/internships` | POST | company | auto-publishes (`status: open`) only if `company.status === verified`, read fresh from DB at write time; otherwise queued as `pendingApproval` |
| `/company/internships` | GET | company | own postings only, scope enforced server-side |
| `/company/internships/:id` | PATCH | company | editing `criteria` never touches existing applications' `eligibilitySnapshot` (immutable, per Section 4 invariants) |
| `/company/internships/:id/close` | PATCH | company | manual early close |
| `/company/internships/:id/applicants` | GET | company | server verifies `internship.companyId === req.user.id` before returning anything. Filtered to applications with **effective eligibility === true** (`override?.eligible ?? eligibilitySnapshot.eligible` — fix #3). Response shape tiered by pipeline stage: pre-shortlist → `{applicationId, eligible: true, matchedCriteriaCount}` only; post-shortlist → adds `{matchedSkills, resumeUrl}`. Raw CGPA/backlog count never returned at any stage |
| `/company/applications/:id/shortlist` | PATCH | company | valid only from `applied` |
| `/company/applications/:id/reject` | PATCH | company | valid from `applied` or `shortlisted` |
| `/company/applications/:id/offer` | PATCH | company | valid only from `shortlisted` |
| `/company/applications/:id/evaluate` | POST | company | valid only from `completed`. `{rating, ppoRecommended: bool}` |

### Faculty

| Endpoint | Method | Role | Notes |
|---|---|---|---|
| `/faculty/assignments` | GET | faculty | own `mentorPending` + `mentorAssigned` records |
| `/faculty/assignments/:id/accept` | PATCH | faculty | valid only from assignment status `pending`. Transitions the parent application `mentorPending → mentorAssigned` |
| `/faculty/assignments/:id/reject` | PATCH | faculty | `{reason}` required. Transitions the parent application back to `tnpVerified` (returns to T&P's unassigned queue — fix #2) |
| `/faculty/students` | GET | faculty | scoped to students with an `accepted` assignment to this faculty only |
| `/faculty/progress-logs/:id/verify` | PATCH | faculty | must own the parent assignment (`assignment.facultyId === req.user.id AND status === accepted`) |
| `/faculty/students/no-submission` | GET | faculty | "who hasn't submitted this week" filter |
| `/faculty/risk-flags/:applicationId/dismiss` | PATCH | faculty | `{note?}`. See risk model, Section 2 — persists a dismissal record, not a mutated flag |

### T&P

| Endpoint | Method | Role | Notes |
|---|---|---|---|
| `/tnp/internships/pending-approval` | GET | tnp | postings from unverified companies awaiting manual approval |
| `/tnp/internships/:id/approve` | PATCH | tnp | |
| `/tnp/applications/:id/verify-offer` | PATCH | tnp | valid only from `accepted` (student must accept before T&P verifies — fix #1). On success → `tnpVerified` |
| `/tnp/applications/:id/reject-offer` | PATCH | tnp | `{reason}`. Valid from `accepted`. Returns to `offered` — company revises/reissues, student must re-accept |
| `/tnp/applications/:id/override` | PATCH | tnp | `{eligible: bool, reason}` required. Writes a separate `override` object; original `eligibilitySnapshot.checks` preserved untouched for audit (fix #3) |
| `/tnp/assignments` | POST | tnp | `{applicationId, facultyId}`. Valid only when application `currentStatus === tnpVerified` and no active (`pending` or `accepted`) assignment exists for it. Creates assignment `status: pending`, transitions application to `mentorPending` (fix #2) |
| `/tnp/assignments/unassigned` | GET | tnp | applications in `tnpVerified` with no active assignment record — feeds the "unassigned mentor" alert |
| `/tnp/applications/:id/cancel` | PATCH | tnp | `{reason}`. Valid from any non-terminal state |
| `/tnp/alerts` | GET | tnp | zero-eligible-applicants, unassigned-mentor, pending-offer-verification counts — one aggregated call for the what's-next panel |
| `/tnp/analytics/dashboard` | GET | tnp | funnel, department stats, company stats, skill-gap report, PPO outcomes |

### HOD

| Endpoint | Method | Role | Notes |
|---|---|---|---|
| `/hod/dashboard` | GET | hod | department is derived from `req.user`, never accepted as a query param |
| `/hod/students/:id` | GET | hod | 403 if student's department ≠ hod's department |

---

## 2. STATE-TRANSITION DEFINITIONS

### Application lifecycle (corrected)

```
applied ──shortlist(company)──▶ shortlisted
applied ──reject(company)─────▶ rejected
shortlisted ──reject(company)─▶ rejected
shortlisted ──offer(company)──▶ offered

offered ──accept(student)─────▶ accepted        [side effect: withdraw student's other `offered` applications]
offered ──decline(student)────▶ withdrawn

accepted ──verify-offer(tnp)──▶ tnpVerified
accepted ──reject-offer(tnp)──▶ offered          [reason logged; student re-accepts after company reissues]

tnpVerified ──assign(tnp)─────▶ mentorPending    [creates MentorAssignment{status: pending}]
mentorPending ──accept(faculty)──▶ mentorAssigned
mentorPending ──reject(faculty)──▶ tnpVerified   [reason logged; assignment marked rejected; returns to unassigned queue]

mentorAssigned ──[first progress log]──▶ inProgress
inProgress ──complete(faculty/tnp)────▶ completed
completed ──evaluate(company)─▶ completed        [sets ppoOffered flag; not a separate terminal state]

[any non-terminal state] ──cancel(tnp/company, reason)──▶ cancelled
```

Terminal states: `rejected, withdrawn, cancelled, completed`. No transitions permitted out of a terminal state. Enforcement: a single `ALLOWED_TRANSITIONS[currentStatus] → [validNextStates]` lookup table checked before every mutation — no route handler special-cases a transition inline. Anything outside the table returns `409 invalid_transition`.

### Company account
`pending → verified` — one-way, T&P-only. Verification auto-publishes the company's queued pending postings (fix #4).

### Internship posting
`pendingApproval → open → closed`. Also `open → cancelled`. Closure is **not** a scheduled job — checked lazily both on reads (list/detail) and, critically, inside the application-creation write path itself (fix #5), so a student can never successfully apply to a posting that has already passed its `lastDate` or filled its `vacancies`, even if their client's cached view was stale. "Filled" = count of applications in `{offered, accepted, tnpVerified, mentorPending, mentorAssigned, inProgress, completed}` (i.e. every non-terminal-negative state) ≥ `vacancies`.

### Mentor assignment (corrected — separate sub-resource, not folded into the application's status alone)
```
pending ──accept(faculty)──▶ accepted
pending ──reject(faculty)──▶ rejected   [application returns to tnpVerified]
```
Uniqueness: only one assignment with status `pending` or `accepted` may exist per application at a time — enforced by a partial unique index, not just application-level logic, to prevent a race where T&P double-assigns before the first faculty response lands.

### Risk flag (corrected — fix #6, no background job)
Risk is **computed live** on every read of `/tnp/alerts`, `/tnp/analytics/dashboard`, and `/faculty/students` — never persisted as a standing score. Only **dismissals** are persisted:
```
Dismissal { applicationId, dismissedBy, dismissedAt, note }
```
A live-computed HIGH/MEDIUM risk result is suppressed from the UI if a `Dismissal` exists for that application **and** no `ProgressLog` has been submitted since `dismissedAt`. A new progress-log submission implicitly "un-suppresses" future risk computation — this is a comparison at read time, not a state transition, and needs no scheduler.

---

## 3. ROLE / PERMISSION MATRIX

| Resource / Action | Student | Company | Faculty | T&P | HOD |
|---|---|---|---|---|---|
| Own profile RW | ✓ (locked after first application) | — | — | — | — |
| Browse/apply to internships | ✓ | — | — | — | — |
| Accept/decline own offer | ✓ | — | — | — | — |
| Post/edit own internship | — | ✓ | — | view-all | view-all |
| View applicants to own posting | — | ✓ (tiered, effective-eligible only) | — | ✓ (full) | dept-scoped |
| Shortlist/reject/offer | — | ✓ (own postings) | — | — | — |
| Verify/reject offer | — | — | — | ✓ | — |
| Assign mentor | — | — | — | ✓ | — |
| Accept/reject own assignment | — | — | ✓ | — | — |
| Verify progress/evidence | — | — | ✓ (assigned only) | — | — |
| Dismiss risk flag | — | — | ✓ (assigned only) | — | — |
| Manual eligibility override | — | — | — | ✓ | — |
| Invite/verify company | — | — | — | ✓ | — |
| Create faculty/HOD account | — | — | — | ✓ | — |
| Cancel application/internship | — | ✓ (own) | — | ✓ (any) | — |
| Full analytics | — | own-posting only | assigned-only | ✓ | dept-scoped |
| Raw CGPA/backlog visibility | self | never | assigned students | ✓ | dept-scoped |

Enforcement is two-layer: route-level `roleGuard([...])` decides endpoint access; controller/service-level scoping (ownership filters, HOD department derived from `req.user`, never from request params) decides row-level access. Both layers required.

---

## 4. IMPLEMENTATION-CRITICAL INVARIANTS

1. **Eligibility is never short-circuited.** Every criterion in `internship.criteria` is evaluated and returned, pass or fail, on every call — no early return.
2. **Submission is never server-blocked by ineligibility** (corrected). The snapshot honestly records `eligible: false` when applicable; only the client UI disables the Apply action. This is what makes the T&P override path reachable at all.
3. **Eligibility snapshot is immutable once written.** Company criteria edits and student profile edits after application-submit never retroactively alter `eligibilitySnapshot`. A T&P `override` is a separate object layered on top — original checks are preserved for audit; effective eligibility = `override?.eligible ?? eligibilitySnapshot.eligible`.
4. **`timeline[]` is append-only.** No handler mutates or deletes a prior entry. `currentStatus` is a derived convenience field, always kept equal to the latest timeline entry's status, updated in the same write — never independently.
5. **All state transitions go through the single `ALLOWED_TRANSITIONS` table**, including the mentor-assignment sub-resource's own two-state table. A transition attempted outside the table is a 409, not a silent no-op.
6. **Company data access is tier-gated by the applicant's pipeline stage, computed server-side on every request** — never a client-supplied flag.
7. **HOD/company/faculty scoping is derived from `req.user`, never from request parameters.** A request with a mismatched `?department=` or `?companyId=` is ignored in favor of the authenticated identity — prevents parameter-tampering data leaks.
8. **Duplicate-application prevention is a database-level unique constraint** (`studentId + internshipId`, partial index excluding terminal states), not just an application-level check — prevents race conditions under concurrent requests.
9. **Multi-offer withdrawal and the accept transition are one atomic write.** They must not be two separate client calls or a race between two accepted offers becomes possible.
10. **Posting closure is checked at write time, not only read time** — the application-creation handler re-validates `lastDate` and `vacancies` fill before insert, so a stale client view can never produce a successful application to a closed posting.
11. **Mentor-assignment uniqueness is a database constraint**, not application-logic-only — only one `pending`/`accepted` assignment may exist per application at any time.
12. **Company `verify` and its auto-publish side effect happen in one transaction.** A posting must never be left `pendingApproval` after its company is already `verified`.
13. **Risk is computed live; only dismissals are persisted.** No scheduled job is required or assumed anywhere in this contract.
