# Kaushal — UI Build Plan by Role

Companion to `kaushal-frontend.md`. Split so Nihar and Aakanksha (or however work gets divided) can each own a lane without stepping on the same files. Build order follows Section 7 of the frontend doc: shared components first, then Student, then T&P, then Faculty, then Company, then HOD, then Landing.

Every page below assumes `<RoleShell>` is already wrapping it and `ALLOWED_TRANSITIONS` already gates action buttons — don't re-derive either per page.

---

## 0. Shared components — build before any role lane starts

| Component | Depends on (types) | Notes |
|---|---|---|
| `<RoleShell>` | `Role` enum | Sidebar/topbar, swaps nav items by role |
| `<StatusStepper>` | `ApplicationStatus`, `ALLOWED_TRANSITIONS` | 12-state, used by Student + T&P |
| `<EligibilityBreakdown>` | `EligibilitySnapshot` | Renders every criterion, pass/fail, never short-circuits |
| `<RiskBadge>` | live risk computation result (HIGH/MEDIUM/none), `Dismissal` | Never accepts a persisted score as a prop — always computed by the caller from live data |
| `<AssignmentQueueCard>` | `MentorAssignment` | Accept/reject-with-reason, reused faculty + T&P |
| `<WhatsNextPanel>` | role-specific alert shape | 5 variants — T&P's reads `/tnp/alerts`, others are simpler counts |
| `<StatCard>` | — | Generic metric box |
| `<EvidenceCard>` | `ProgressLog.evidence` | pending/verified/flagged badge |
| `<ApprovalButtons>` | — | Faculty + T&P only |
| `<ChartWrapper>` | recharts | Funnel, at-risk trend, skill-gap bar |

---

## 1. Student lane

**Build order:** Dashboard → Internship Detail → Applications list/detail (accept/decline) → Progress & Evidence → Documents → Recommendations (cut first if short on time).

| Page | Route | Components | API calls |
|---|---|---|---|
| Dashboard | `/student` | `<StatCard>`, `<WhatsNextPanel>` | `GET /student/internships`, `GET /student/applications` |
| Internship Detail | `/student/internships/[id]` | `<EligibilityBreakdown>`, Apply button (client-disabled if ineligible) | `GET /student/internships/:id`, `POST /student/applications` |
| Applications list | `/student/applications` | table, `?status=` filter | `GET /student/applications` |
| Application Detail | `/student/applications/[id]` | `<StatusStepper>`, Accept/Decline (only when `offered`) | `PATCH .../accept`, `PATCH .../decline` |
| Progress & Evidence | `/student/progress` | form (react-hook-form + zod), `<EvidenceCard>` | `POST .../progress-logs` — **gate the form on `currentStatus === inProgress`**, don't just hide it, since a stale client could otherwise submit |
| Documents | `/student/documents` | `<EvidenceCard>` list | blocked on the evidence-upload open question — see frontend doc §9 |
| Recommendations | `/student/recommendations` | list of internship cards, `method` label always shown | `GET /student/recommendations` — copy must say "suggested," never "matched" |

**State to watch:** Accept/Decline must only render from `offered`; everything else follows `ALLOWED_TRANSITIONS` directly off `currentStatus`, no per-page special-casing.

---

## 2. T&P lane (flagship — build second, right after Student)

**Build order:** Dashboard (`/tnp/alerts`) → Verification Queue (verify/reject offers, assign mentor, override) → Analytics (the "killer moment" screen) → Companies → Users → Applications (cancel).

| Page | Route | Components | API calls |
|---|---|---|---|
| Dashboard | `/tp` | `<WhatsNextPanel>` | `GET /tnp/alerts` |
| Verification Queue | `/tp/verification-queue` | `<AssignmentQueueCard>`, override modal with `<EligibilityBreakdown>` (shows original snapshot + override side by side) | `GET /tnp/internships/pending-approval`, `PATCH .../approve`, `PATCH /tnp/applications/:id/verify-offer\|reject-offer`, `POST /tnp/assignments`, `GET /tnp/assignments/unassigned`, `PATCH /tnp/applications/:id/override` |
| Analytics | `/tp/analytics` | `<ChartWrapper>` ×3 (funnel, skill-gap, at-risk trend), `<RiskBadge>` list | `GET /tnp/analytics/dashboard` |
| Companies | `/tp/companies` | invite form, verify action | `POST /tnp/invites`, `PATCH /tnp/companies/:id/verify` |
| Users | `/tp/users` | create-account form | `POST /tnp/users` — idempotent on email, surface the 409 as "already exists" not a generic error |
| Applications | `/tp/applications/[id]` | `<StatusStepper>`, cancel-with-reason | `PATCH /tnp/applications/:id/cancel` |

**The demo moment:** rejecting a student on a criterion on this lane's Verification Queue (or a company rejecting on Company lane) must show up on Analytics' skill-gap chart on next read with no manual refresh — this is why React Query cache invalidation matters more here than anywhere else. Wire the mutation's `onSuccess` to invalidate the `analytics/dashboard` query key even if the two pages feel unrelated.

---

## 3. Faculty lane

**Build order:** Dashboard (assignment queue + no-submission filter) → Student Review (verify + dismiss).

| Page | Route | Components | API calls |
|---|---|---|---|
| Dashboard | `/faculty` | `<AssignmentQueueCard>`, `<RiskBadge>` list, no-submission filter | `GET /faculty/assignments`, `PATCH .../accept\|reject`, `GET /faculty/students/no-submission` |
| Student Review | `/faculty/students/[id]` | `<EvidenceCard>` list, `<ApprovalButtons>`, `<RiskBadge>` with dismiss-with-note | `PATCH /faculty/progress-logs/:id/verify`, `PATCH /faculty/risk-flags/:applicationId/dismiss` |

**State to watch:** dismiss writes a `Dismissal`, it never touches the risk computation itself — the badge on next read should re-derive live and only re-suppress if no new `ProgressLog` has landed since `dismissedAt`. Don't cache "dismissed" as a boolean on the application object client-side; treat it as re-derivable every read.

---

## 4. Company lane

**Build order:** Post Internship → Postings/Applicants → Dashboard (do last within this lane — it's just aggregate stats over the other two pages).

| Page | Route | Components | API calls |
|---|---|---|---|
| Post Internship | `/company/postings/new` | criteria form (zod) | `POST /company/internships` |
| Postings / Applicants | `/company/postings/[id]/applicants` | tiered applicant table (pre/post-shortlist shape differs — don't render `matchedSkills`/`resumeUrl` columns until the row has them), shortlist/reject/offer buttons, close action, evaluate+PPO form at `completed` | `PATCH .../shortlist\|reject\|offer\|close`, `POST .../evaluate` |
| Dashboard | `/company` | `<StatCard>` ×4 | derived from postings/applicants reads, no dedicated endpoint |

**State to watch:** never render raw CGPA/backlog count anywhere in this lane — the contract guarantees the API won't send it, but don't add a client-side field for it either, so there's no accidental leak if the backend shape ever changes.

---

## 5. HOD lane (last — read-only, reuses T&P's chart components)

| Page | Route | Components | API calls |
|---|---|---|---|
| Dashboard | `/hod` | `<StatCard>`, `<ChartWrapper>` (skill-gap, reused from T&P lane) | `GET /hod/dashboard` |
| Student Drill-in | `/hod/students/[id]` | read-only version of Faculty's Student Review layout, no action buttons | `GET /hod/students/:id` |

Nothing here needs new components — it's composition of what Student/Faculty/T&P lanes already built. Don't start this lane until at least one of those three is done.

---

## 6. Public lane (do last, cosmetic)

| Page | Route |
|---|---|
| Landing | `/` |
| Login | `/login` |

---

## Cross-lane dependency notes

- **Student's Application Detail** and **T&P's Verification Queue** both render `<StatusStepper>` off the same `currentStatus` — build the component once against the shared type, don't let either lane fork it.
- **Faculty's Dashboard** and **T&P's Analytics** both render `<RiskBadge>` — same rule.
- **T&P's Verification Queue → assign mentor** and **Faculty's Dashboard → assignment queue** are two ends of the same `MentorAssignment` sub-resource. If one lane changes the assignment type shape, the other breaks — flag any edit to `MentorAssignment` in `lib/types/index.ts` to whoever owns the other lane before merging.
- **Company's Applicants page** and **T&P's Verification Queue override** both read `effective eligibility = override?.eligible ?? eligibilitySnapshot.eligible` — compute this once in a shared selector, don't inline the fallback in two components.