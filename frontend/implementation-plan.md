# Kaushal — Frontend Implementation Plan (role-by-role)

Companion to `kaushal-frontend.md` (spec) and `kaushal-ui-role-plan.md` (page/component/API map). This file is the **execution order** — concrete steps, one role finished before the next starts, so at any point in the night you have a fully working role rather than five half-built ones.

Sequence: **Phase 0 (shared) → Student → T&P → Faculty → Company → HOD → Public.** This matches Section 7's build priority in the frontend doc. Don't start a role's phase until the previous one is checked off — the shared components and types get load-bearing reuse in every later phase, and Student's types/mocks are what T&P's screens read against.

Each step assumes mocks (`lib/api/mocks/`) exist before UI does — build the mock for a call before the component that uses it, not after.

---

## Phase 0 — Foundation (before any role)

1. `lib/types/index.ts` — port every shape from `API_CONTRACTS.md`: `ApplicationStatus` (12 states), `ALLOWED_TRANSITIONS` lookup table, `EligibilitySnapshot`, `Dismissal`, `MentorAssignment`, `Role` enum, response envelope `{success, data, error}`.
2. `lib/api/client.ts` — fetch wrapper, `USE_MOCKS` boolean, endpoint map keyed by the routes in `API_CONTRACTS.md` §1. Every later phase adds entries here, never a one-off `fetch()` in a component.
3. `middleware.ts` — role-based route guard reading the JWT's `role` claim, redirecting `/student/*` etc. to `/login` if role mismatches.
4. `<RoleShell>` — sidebar/topbar shell, nav items swapped by role. Every page in every later phase renders inside this.
5. `<StatusStepper>` — build against `ALLOWED_TRANSITIONS`, styled with the `stage-*` tokens from `kaushal-design-system.md`. Test it standalone with a hardcoded application object before any real page uses it.
6. `<RiskBadge>` — takes a live-computed risk result + optional `Dismissal`, styled with `risk-*` tokens. Test standalone with hardcoded HIGH/MEDIUM/dismissed props.
7. `<EligibilityBreakdown>`, `<AssignmentQueueCard>`, `<WhatsNextPanel>`, `<StatCard>`, `<EvidenceCard>`, `<ApprovalButtons>`, `<ChartWrapper>` — build all seven against mock props, no live data yet.
8. **Checkpoint:** every shared component renders in isolation (a `/dev/components` scratch page is fine) before Phase 1 starts. If a component only works once wired to real data, it'll block whichever role touches it first.

---

## Phase 1 — Student

Opens the demo — get this fully working end to end before touching T&P.

1. Mock `GET /student/internships` and `GET /student/internships/:id` in `lib/api/mocks/`, typed against `EligibilitySnapshot`.
2. Build `/student` — dashboard: internship list with eligibility badges (lightweight, `eligibility.eligible` only), `<WhatsNextPanel>` wired to student's own applications.
3. Build `/student/internships/[id]` — full breakdown via `<EligibilityBreakdown>`, Apply button. Wire the disabled-when-ineligible state but confirm the underlying `POST /student/applications` mock still accepts the submission — don't accidentally block it in the mock layer too.
4. Mock `POST /student/applications`, `GET /student/applications`.
5. Build `/student/applications` — list with `?status=` filter.
6. Build `/student/applications/[id]` — `<StatusStepper>` wired to real `currentStatus`. Add Accept/Decline buttons, gated to render only when `currentStatus === offered`.
7. Mock `PATCH /student/applications/:id/accept` — **implement the atomic side effect in the mock too**: accepting one application must flip every other `offered` application for that student to `withdrawn` in the same mock call, so the UI behavior is validated before the real backend exists. Mock `.../decline` similarly.
8. Build `/student/progress` — form gated on `currentStatus === inProgress`, wired to mock `POST .../progress-logs`.
9. Build `/student/documents` — `<EvidenceCard>` list. Evidence-upload mechanics are still an open question (frontend doc §9) — stub the upload action with a visible "pending backend decision" state rather than faking a working upload.
10. Build `/student/recommendations` — list view, `method: "deterministic-skill-overlap"` label always visible in the UI copy. Lowest priority in this phase — skip first if time is tight.
11. **Checkpoint:** apply → get offered (adjust mock status manually) → accept → confirm any other mocked `offered` application for the same student flips to `withdrawn` in the UI without a refresh. This is the first proof of the atomic-write behavior the whole app depends on.

---

## Phase 2 — T&P (flagship — the "killer moment" lives here)

1. Mock `GET /tnp/alerts`.
2. Build `/tp` — `<WhatsNextPanel>` wired to the alerts mock.
3. Mock `GET /tnp/internships/pending-approval`, `PATCH .../approve`.
4. Mock `PATCH /tnp/applications/:id/verify-offer`, `.../reject-offer` — valid only from `accepted`; reject returns to `offered`.
5. Mock `POST /tnp/assignments`, `GET /tnp/assignments/unassigned` — assignment created only when `currentStatus === tnpVerified` and no active assignment exists; enforce this in the mock so a bad UI state fails loudly now instead of against the real backend later.
6. Mock `PATCH /tnp/applications/:id/override` — writes a separate `override` object, leaves `eligibilitySnapshot` untouched.
7. Build `/tp/verification-queue` — pending-approval list, verify/reject-offer actions, `<AssignmentQueueCard>` for assign/reassign, override modal showing `<EligibilityBreakdown>` for the original snapshot alongside the override form.
8. Mock `GET /tnp/analytics/dashboard` — include a skill-gap breakdown that can be recomputed from the same mock application/rejection data used elsewhere, not a hardcoded static number.
9. Build `/tp/analytics` — funnel, skill-gap, at-risk cohort via `<ChartWrapper>` ×3.
10. **Wire the killer moment:** any mutation that rejects a student on a criterion (here or in Company's Applicants page once Phase 4 exists) must invalidate the `analytics/dashboard` React Query key on success. Test this now with a mocked rejection even before Company's lane is built — trigger the mock mutation directly and confirm Analytics updates without a manual refresh.
11. Mock `POST /tnp/invites`, `PATCH /tnp/companies/:id/verify` (with the auto-publish side effect — flipping a company to verified in the mock should also flip any of its `pendingApproval` postings to `open`).
12. Build `/tp/companies`.
13. Mock `POST /tnp/users` — 409 on duplicate email.
14. Build `/tp/users`.
15. Mock `PATCH /tnp/applications/:id/cancel`.
16. Build `/tp/applications/[id]` — reuses `<StatusStepper>`.
17. **Checkpoint:** reject an application on a criterion → confirm the skill-gap chart on `/tp/analytics` reflects it on the next render, no refresh. If this doesn't work now, it won't work live on Aug 21 either — don't move on until it does.

---

## Phase 3 — Faculty

1. Mock `GET /faculty/assignments`, `PATCH .../accept|reject`, `GET /faculty/students/no-submission`.
2. Build `/faculty` — `<AssignmentQueueCard>` for the pending queue, `<RiskBadge>` list for assigned students, no-submission filter.
3. Mock `PATCH /faculty/progress-logs/:id/verify`, `PATCH /faculty/risk-flags/:applicationId/dismiss`.
4. Build `/faculty/students/[id]` — `<EvidenceCard>` list with verify action, `<RiskBadge>` with dismiss-with-note.
5. **Wire the dismiss re-derivation:** in the mock, a `Dismissal` should suppress the risk badge only until a new `ProgressLog` is added for that application — confirm submitting a new progress log (via Phase 1's student form, same mock data) un-suppresses the badge on `/faculty/students/[id]` without any explicit "un-dismiss" action.
6. **Checkpoint:** reject a faculty assignment → confirm it reappears in T&P's `/tp/verification-queue` unassigned list (Phase 2) without a manual data reset. This proves the two lanes share mock state correctly.

---

## Phase 4 — Company

1. Mock `POST /company/internships` — auto-publish only if `company.status === verified`.
2. Build `/company/postings/new`.
3. Mock `GET /company/internships`, `PATCH /company/internships/:id`, `.../close`.
4. Mock `GET /company/internships/:id/applicants` — tiered response shape (pre-shortlist vs. post-shortlist fields), effective eligibility computed from `override?.eligible ?? eligibilitySnapshot.eligible`.
5. Mock `PATCH .../shortlist|reject|offer`, `POST .../evaluate`.
6. Build `/company/postings/[id]/applicants` — tiered table (don't render `matchedSkills`/`resumeUrl` columns for pre-shortlist rows), action buttons gated by `ALLOWED_TRANSITIONS`, evaluate+PPO form at `completed`.
7. Build `/company` dashboard — `<StatCard>` ×4, derived from the applicants/postings mocks already built, no new endpoint.
8. **Checkpoint:** reject an applicant here → confirm `/tp/analytics` skill-gap chart updates too (same invalidation wiring as Phase 2 step 10, now proven from a second entry point).

---

## Phase 5 — HOD

1. Mock `GET /hod/dashboard`, `GET /hod/students/:id`.
2. Build `/hod` — reuse `<StatCard>` and the skill-gap `<ChartWrapper>` instance from Phase 2, read-only.
3. Build `/hod/students/[id]` — read-only composition of Faculty's Student Review layout (Phase 3), no action buttons rendered at all (not just disabled).
4. **Checkpoint:** confirm no mutation-triggering component (verify, dismiss, evaluate, etc.) is reachable from any HOD route — this role has zero edit authority by design.

---

## Phase 6 — Public (cosmetic, do last)

1. Build `/` — landing page, problem statement, login CTA.
2. Build `/login` — single form, redirect by role on success.
3. Build `/register` — student self-register only.
4. **Checkpoint:** log in as each of the five roles from this page and confirm `middleware.ts` routes each to the correct dashboard.

---

## End-of-night integration checklist (Aug 21 morning, before rehearsal)

- [ ] Flip `USE_MOCKS` to real endpoints as Dipak's routes land — one boolean, verify no page needed a rewrite to handle it.
- [ ] Re-run both "killer moment" checkpoints (Phase 2 step 17, Phase 4 step 8) against real data, not mocks.
- [ ] Confirm the evidence-upload open question got resolved with backend before `/student/documents` and `/student/progress` go live — if not, that's the one page still allowed to ship stubbed.
- [ ] Full run-through in role order (Student → T&P → Faculty → Company → HOD) matching this plan's phase order, since that's also the most natural demo narrative.