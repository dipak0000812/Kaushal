# Kaushal — Frontend Build Doc (v2 — updated against API_CONTRACTS.md)

Team ZerothLayer | GHR Inter-Track Hackathon | 21 Aug 2026
Frontend owners: Nihar, Aakanksha | Backend owners: Dipak, Purva

Repo: `dipak0000812/Kaushal` — frontend lives entirely under `frontend/`, backend under `backend/`, API contract lives in `docs/api/API_CONTRACTS.md` (read-only for frontend).

> **v2 changes vs. original:** page list updated (added `/student/recommendations`, close/evaluate actions), open-questions section resolved against the contract where possible, and a pointer to the corrected design system (`kaushal-design-system.md` — the old `design.md` assumed Supabase and 3 roles; both are wrong for this repo). Per-role build breakdown moved out to `kaushal-ui-role-plan.md`.

---

## 1. Stack

Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui

| Need | Library |
|---|---|
| UI primitives | shadcn/ui — Table, Badge, Tabs, Dialog, Card |
| Forms | react-hook-form + zod |
| Data fetching / cache | @tanstack/react-query |
| Charts | recharts |
| Icons | lucide-react |
| Dates | date-fns |
| Auth | hardcoded roles + cookie/JWT, `middleware.ts` — no NextAuth, too heavy for the timeline |

No state management library, no animation library beyond Tailwind transitions.

Backend is **custom Node/Express/MongoDB** — not Supabase. There is no client SDK; all data access goes through `lib/api/client.ts` hitting `/api/v1/*` with a Bearer JWT.

---

## 2. Route structure

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/            # student self-register only
│   ├── student/
│   │   ├── page.tsx              # dashboard + eligibility badges
│   │   ├── internships/[id]/     # criterion breakdown
│   │   ├── applications/         # list + [id] detail (accept/decline)
│   │   ├── recommendations/      # skill-overlap suggestions (should-have)
│   │   ├── progress/             # weekly submission + evidence
│   │   └── documents/
│   ├── company/
│   │   ├── page.tsx               # mini-analytics
│   │   ├── postings/new/
│   │   └── postings/[id]/applicants/
│   ├── faculty/
│   │   ├── page.tsx                # assigned students, at-risk flags, assignment queue
│   │   └── students/[id]/
│   ├── tp/                         # T&P — flagship
│   │   ├── page.tsx                 # what's-next panel
│   │   ├── verification-queue/
│   │   ├── analytics/               # funnel, skill-gap, at-risk list
│   │   └── companies/               # onboarding/verify
│   ├── hod/
│   │   └── page.tsx                 # dept-scoped read-only
│   └── layout.tsx                   # role-based shell
├── components/
│   └── shared/                      # see section 3
├── lib/
│   ├── api/                         # fetch client + mock data
│   └── types/                       # shared TS types matching API_CONTRACTS.md
└── middleware.ts                    # role-based route guard
```

---

## 3. Page list (by role) — updated

### Public

| Page | Route | Purpose |
|---|---|---|
| Landing | `/` | Problem statement + "Login" CTA — first thing judges see |
| Login | `/login` | Single login form, redirects by role after auth |

*(Skip signup for company/faculty/HOD — T&P-provisioned. Only student self-registers.)*

### Student

| Page | Route | Contents | API |
|---|---|---|---|
| Dashboard | `/student` | Eligibility badges (lightweight list), "what's next" panel | `GET /student/internships`, `GET /student/applications` |
| Internship Detail | `/student/internships/[id]` | Full per-criterion breakdown, live-computed, Apply CTA (disabled client-side if ineligible, not server-blocked) | `GET /student/internships/:id`, `POST /student/applications` |
| Applications | `/student/applications` | List, `?status=` filter | `GET /student/applications` |
| Application Detail | `/student/applications/[id]` | Status stepper (12-state) + **Accept/Decline buttons when `offered`** — the real trigger for multi-offer withdrawal | `PATCH /student/applications/:id/accept\|decline` |
| **Recommendations** *(new — should-have)* | `/student/recommendations` | Deterministic skill-overlap suggestions, explicitly labeled `method: "deterministic-skill-overlap"` — copy must say "suggested," never "matched"/"AI-recommended" | `GET /student/recommendations` |
| Progress & Evidence | `/student/progress` | Weekly submission form + evidence attachment — only enabled once `currentStatus === inProgress` | `POST /student/applications/:id/progress-logs` |
| Documents | `/student/documents` | Upload center, T&P verification status | — (see open question on evidence upload below) |

### Company

| Page | Route | Contents | API |
|---|---|---|---|
| Dashboard | `/company` | Mini-analytics: applicant count, eligible %, shortlist %, completion rate | — |
| Post Internship | `/company/postings/new` | Structured criteria form. Auto-publishes only if company is `verified`; otherwise queues `pendingApproval` | `POST /company/internships` |
| Postings list / detail | `/company/postings/[id]` | Edit criteria, **manual early close** *(action added — was missing from v1 list)* | `PATCH /company/internships/:id`, `PATCH /company/internships/:id/close` |
| Applicants | `/company/postings/[id]/applicants` | Tiered by stage: pre-shortlist `{eligible, matchedCriteriaCount}` only; post-shortlist adds `{matchedSkills, resumeUrl}`. Raw CGPA/backlogs never shown. Shortlist/reject/offer actions here. **Evaluate + PPO flag** at `completed` *(action added)* | `PATCH .../shortlist\|reject\|offer`, `POST .../evaluate` |

### Faculty Mentor

| Page | Route | Contents | API |
|---|---|---|---|
| Dashboard | `/faculty` | Assigned students, "who hasn't submitted this week" filter, **pending assignment queue with Accept/Reject-with-reason** | `GET /faculty/assignments`, `PATCH .../accept\|reject`, `GET /faculty/students/no-submission` |
| Student Review | `/faculty/students/[id]` | Progress logs + evidence, verify action, live-computed at-risk breakdown, dismiss-with-note (creates a `Dismissal`, doesn't mutate a stored score) | `PATCH /faculty/progress-logs/:id/verify`, `PATCH /faculty/risk-flags/:applicationId/dismiss` |

### T&P Cell

| Page | Route | Contents | API |
|---|---|---|---|
| Dashboard | `/tp` | What's-next panel built from `/tnp/alerts`: pending verifications, at-risk count, zero-eligible + unassigned-mentor alerts | `GET /tnp/alerts` |
| Verification Queue | `/tp/verification-queue` | Pending internship approvals (unverified companies), offer verify/reject-with-reason, mentor assign/reassign, **manual eligibility override modal** | `GET /tnp/internships/pending-approval`, `PATCH .../approve`, `PATCH /tnp/applications/:id/verify-offer\|reject-offer`, `POST /tnp/assignments`, `GET /tnp/assignments/unassigned`, `PATCH /tnp/applications/:id/override` |
| Companies | `/tp/companies` | Invite (generates token), verify (one-way, auto-publishes queued postings) | `POST /tnp/invites`, `PATCH /tnp/companies/:id/verify` |
| Users | `/tp/users` | Create faculty/HOD accounts | `POST /tnp/users` |
| Applications | `/tp/applications/[id]` | Cancel with reason (any non-terminal state) | `PATCH /tnp/applications/:id/cancel` |
| Analytics | `/tp/analytics` | Funnel, dept/company stats, skill-gap report, at-risk cohort list (all live-computed) | `GET /tnp/analytics/dashboard` |

### HOD

| Page | Route | Contents | API |
|---|---|---|---|
| Dashboard | `/hod` | Dept-scoped active/completed/PPO counts, skill-gap report (read-only) | `GET /hod/dashboard` |
| Student Drill-in | `/hod/students/[id]` | Read-only student view within department | `GET /hod/students/:id` |

**Total: ~17 pages** (was 16 — recommendations page added; close/evaluate are actions on existing pages, not new routes).

---

## 4. Shared components (build these first — they ARE the architecture)

| Component | Used in |
|---|---|
| `<RoleShell>` | Every page — sidebar/topbar, swaps by role |
| `<StatusStepper>` | Student flow, T&P verification queue — 12-state lifecycle, driven by `ALLOWED_TRANSITIONS` |
| `<EligibilityBreakdown>` | Student detail, T&P override screen |
| `<RiskBadge>` | Faculty dashboard, T&P at-risk list — **always live-computed, never a stored score. "Dismiss" creates a `Dismissal` record, doesn't mutate the badge. Uses a separate color treatment from `<StatusStepper>` — see design system.** |
| `<AssignmentQueueCard>` | Faculty dashboard (accept/reject-with-reason), T&P verification queue (assign/reassign) |
| `<WhatsNextPanel>` | Every role's home screen, 5 content variants — T&P's is built from live `/tnp/alerts` counts, not hardcoded copy |
| `<StatCard>` | Small metric box — eligible %, pending count, applicant count |
| `<EvidenceCard>` | One evidence/milestone entry + status badge (pending/verified/flagged) |
| `<ApprovalButtons>` | Verify/flag actions — faculty and T&P only |
| `<ChartWrapper>` | Reused Recharts wrapper — funnel, at-risk trend, skill-gap bar chart |

Every dashboard is a window into the same lifecycle chain, not a separate feature — these components carry that architecture. Build once, reuse everywhere, don't duplicate logic per role.

---

## 5. App flow by role

**Student flow:**
Register → complete profile → browse internships with live eligibility badges → click one → see per-criterion breakdown → apply (submission never server-blocked, even if ineligible) → status stepper → **if offered, must explicitly Accept — this triggers auto-withdrawal of all other pending offers in one atomic write** → T&P verifies offer → mentor assigned → submit weekly progress + evidence once `inProgress` → mentor verifies → track via "what's next" panel.

**Company flow:**
Receive T&P invite → register → status `pending` → T&P verifies (auto-publishes any queued postings) → post internship with structured criteria → system pre-filters eligible applicants (tiered by pipeline stage) → shortlist → offer → student must accept → T&P verifies → rate + mark PPO at completion.

**Faculty Mentor flow:**
Account created by T&P → assignment appears in queue as `pending` → **accept or reject-with-reason (reject returns the application to T&P's unassigned queue, doesn't force-assign)** → review weekly progress + evidence → verify each entry → see live-computed at-risk flags with contributing signals → dismiss-with-note (persists a `Dismissal`, doesn't touch the underlying computation) → final evaluation at completion.

**T&P flow (touches nearly every stage):**
Invite + verify companies (auto-publish side effect) → approve postings from unverified companies → monitor verification queue → verify/reject offers (reject returns to `offered`, company reissues) → assign mentor once `tnpVerified` → confirm via faculty's accept, or reassign if faculty rejects → monitor at-risk cohort + zero-eligible + unassigned-mentor alerts (all live-computed, one aggregated `/tnp/alerts` call) → manual eligibility override when needed, reason logged, original snapshot preserved → view full analytics.

**HOD flow:**
Log in → view dept-scoped dashboard → drill into any student (read-only) → see dept skill-gap report. No edit authority anywhere — thinnest journey by design.

---

## 6. Data strategy

- `docs/api/API_CONTRACTS.md` is confirmed — no more guessing shapes. `lib/types/index.ts` mirrors it exactly, including `ALLOWED_TRANSITIONS` for the 12-state application lifecycle.
- Build against **mock data** in `lib/api/mocks/` (already scaffolded, typed against the real contract) until backend endpoints are live.
- `lib/api/client.ts` has a `USE_MOCKS` flag and a full endpoint map — flip one boolean when Dipak's routes are up, no per-page rewrites.
- Base path confirmed: `/api/v1`, `Authorization: Bearer <JWT>`, standard envelope `{ success, data, error }`.
- **Risk is computed live, never stored** — don't build any UI that treats a risk level as an editable/persisted field. Only the dismiss action writes anything (a `Dismissal`).
- Use React Query for all reads so the "killer moment" (reject on criterion → skill-gap stat updates live) works via cache invalidation, not manual refresh logic.

---

## 7. Build priority (if time runs short)

1. **Shared components** (RoleShell, StatusStepper, EligibilityBreakdown, RiskBadge, WhatsNextPanel) — against mocks. Everything else assembles from these.
2. **Student flow** — dashboard → internship detail → apply → stepper → progress submission. Opens the demo.
3. **T&P Analytics + Verification Queue** — the flagship screen and the "killer moment" (rejection → skill-gap stat update).
4. **Faculty flow** — at-risk dismiss/acknowledge, evidence verify. Proves the system is advisory, not automated judgment.
5. **Company flow** — post internship, pre-filtered applicant list.
6. **HOD flow** — reuses T&P analytics components, do last since it's read-only and lowest-effort.
7. **Landing page** — cosmetic, do last.
8. **Recommendations page** — should-have, cut first if time is short; it's the only page with no downstream dependency on it.

Aug 21 (hackathon day) is integration + deploy + rehearsal only — no new features get built that day. If something isn't done tonight, it's cut, not rushed.

For the full per-role build breakdown (pages, components, API calls, and order), see `kaushal-ui-role-plan.md`.
For the corrected design tokens (roles, backend, and the two-track status/risk color language), see `kaushal-design-system.md`.

---

## 8. Git workflow — conflict prevention

```bash
git checkout -b frontend-dev
cd frontend
git pull --rebase origin main     # before every push
git add frontend/
git commit -m "feat(frontend): ..."
git push origin frontend-dev
```

- Only ever `git add frontend/` — never touch `backend/`, `docs/api/API_CONTRACTS.md`, root `docker-compose.yml`, or root `.gitignore`.
- If frontend needs its own ignore rules, add `frontend/.gitignore`.
- Rebase, not merge, when pulling — keeps history linear against backend commits.
- Open a PR and merge `frontend-dev` → `main` every few hours, not once at the end of the day.
- If the API contract needs a change, that's a message to Dipak — not a frontend commit.

---

## 9. Open questions for team review — updated

**Resolved by the API contract (docs/api/API_CONTRACTS.md):**
- ~~API_PREFIX / PORT~~ → `/api/v1`
- ~~Eligibility response shape~~ → `EligibilitySnapshot { eligible, checks[], computedAt }`, every criterion always returned
- ~~Risk-score response shape~~ → **not a stored score at all** — computed live, only `Dismissal` records persist
- ~~Auth token format~~ → Bearer JWT in `Authorization` header
- ~~Eligibility "actual" value for list-view badges~~ → **resolved:** `GET /student/internships` computes `eligibility.eligible` live, server-side, on every request. No frontend fallback/local check needed — just render whatever the field says, and treat it as authoritative even though it's lightweight.

**Still open — need a decision, not just a doc read:**
- [ ] **Evidence upload mechanics.** The contract's `progress-logs` endpoint takes `evidence: {type, value}` but doesn't define how `value` is produced for `type: file` — is there a separate upload endpoint not yet in the contract, or does the frontend need a direct-to-storage upload (e.g. presigned URL) before calling `progress-logs`? This blocks the Progress & Evidence page and the Documents page. **→ needs a message to Dipak, same as any other contract gap (see Section 8).**
- [ ] **`USE_MOCKS` toggle scope.** Manual code toggle in `client.ts` is fine for tonight given the timeline, but confirm nobody is relying on per-environment (`.env`) behavior for the demo — a manual toggle left in the wrong state mid-demo is an easy way to lose the "killer moment."

**Resolved by this update, not the contract:**
- ~~Color scheme~~ → the old `design.md` doesn't fit this project (Supabase-based, 3 roles, 4-state verification only). See `kaushal-design-system.md` for the corrected version: same purple/orange brand tokens, but with a status-stepper track for the 12-state lifecycle and a visually distinct risk-badge track, kept separate per the earlier decision not to let risk and status share one color language.

### New pages required — not in the original page list (carried over, still accurate)

| Page | Route | Why |
|---|---|---|
| Offer response | `/student/applications/[id]` | Accept/Decline buttons — `POST /student/applications/:id/accept` is the actual trigger for multi-offer withdrawal (contract fix #1). Not optional. |
| Mentor assignment queue | section within `/faculty` | Accept/reject-with-reason for new assignments — `PATCH /faculty/assignments/:id/accept\|reject`. A rejected assignment returns to T&P's queue; this is a real workflow step, not just a dashboard list. |
| Company invite | `/tp/companies/invite` | `POST /tnp/invites` — T&P's actual entry point for onboarding a company |
| Manual eligibility override | modal/panel within `/tp/verification-queue` | `PATCH /tnp/applications/:id/override` — writes a separate override object, original snapshot stays untouched for audit |
| **Recommendations** *(new in v2)* | `/student/recommendations` | `GET /student/recommendations` — should-have, deterministic skill-overlap, wasn't in the v1 page list at all |

### Behavior corrections vs. the original mock plan

- **Risk dismiss is an insert, not a mutation.** Faculty's "dismiss" action creates a `Dismissal` record — it does not change a stored risk level, because none is stored.
- **Student submission is never blocked by ineligibility server-side.** The Apply button is disabled in the UI for ineligible students, but that's a client-side convenience only — the snapshot always honestly records `eligible: false`, which is what makes T&P's override path reachable at all.
- **`ALLOWED_TRANSITIONS`** (now in `lib/types/index.ts`) should gate which action buttons render per role/state — don't hand-roll per-page transition checks.
- **Company account is 2-state (`pending`/`verified`), not the 4-state verification badge used elsewhere.** Don't force it into `<StatusBadge verified|pending|review|flagged>` — it only ever needs the verified/pending pair.