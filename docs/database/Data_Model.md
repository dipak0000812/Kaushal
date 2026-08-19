# Database

MongoDB via Mongoose. One database, collections split by owning
module. This document defines entities, relationships, and invariants
only — schema files (validators, exact types) are implementation, not
documentation, and should be written directly off this doc plus
`docs/api/API_CONTRACTS.md`.

## Collections / entities

### User
Root identity for every role.
- `role`: `student | company | faculty | hod | tnp` — set at creation, never client-chosen after
- `status`: `active | pending` (company accounts only start `pending`)
- `department`: present for `faculty`/`hod`, set by T&P at creation, never editable by the account holder
- `email` unique

Company and student accounts each reference a profile document below;
faculty/hod/tnp need no separate profile collection.

### StudentProfile
References `User`. Holds `department`, `year`, `cgpa`, backlog count,
`skills[]`, `certifications[]`, resume reference.
- Writable by the owning student until they have any non-draft
  application on record, then read-only at the service layer
  (matches `PATCH /student/profile` returning 409 — see API contract).

### CompanyProfile
References `User`. Holds `companyName`, contact info.
- Verification state lives on the parent `User.status`
  (`pending → verified`), not duplicated here.

### InviteToken
Backs `POST /tnp/invites`. `{companyName, contactEmail, token, expiresAt, usedAt}`.
Consumed once at `POST /auth/register/company` — a used or expired
token is rejected, not silently reused.

### Internship
References `CompanyProfile`.
- `criteria`: embedded object (`minCgpa`, `maxBacklogs`, `department`,
  `year`, `requiredSkills[]`, `requiredCerts[]`) — embedded, not
  referenced, because criteria has no independent identity or
  lifecycle outside its posting.
- `status`: `pendingApproval | open | closed | cancelled`
- `vacancies`, `lastDate`

Closure is not a stored derived flag — "filled" is computed at read
and write time from a count of non-terminal-negative applications
against this posting (API contract Section 2). No `filledAt` field
needed.

### Application
References `StudentProfile` and `Internship`. This is the central
entity — nearly every other collection either hangs off it or reads
from it.

- `currentStatus`: one of the states in the API contract's lifecycle
  table. Always equal to `timeline[timeline.length-1].status`,
  updated in the same write that appends to `timeline` — never
  independently (invariant #4).
- `timeline[]`: embedded, append-only array of
  `{fromStatus, toStatus, actorId, actorRole, reason?, at}`. Embedded
  rather than a separate collection because it's always read together
  with its parent application and never queried across applications
  at scale in this contract — a separate `StatusEvent` collection
  would add a join for no read pattern that needs it.
- `eligibilitySnapshot`: embedded object `{eligible, checks[], computedAt}`,
  written once at `POST /student/applications`, never mutated again
  (invariant #3).
- `override`: embedded, nullable object `{eligible, reason, byUserId, at}`,
  written only by `PATCH /tnp/applications/:id/override`. Effective
  eligibility for any consumer (e.g. the company applicant-list
  filter) is `override?.eligible ?? eligibilitySnapshot.eligible` —
  computed at read time, never flattened into a third field.
- `ppoOffered`: boolean, set by the company evaluate call; `completed`
  stays the terminal status, this is a flag on it, not a separate
  state (per the lifecycle table).

### MentorAssignment
References `Application` and the faculty `User`.
- `status`: `pending | accepted | rejected`
- `rejectReason`: nullable
- Separate collection, not folded into `Application`, because
  uniqueness has to be enforced independently
  (`applicationId` + status in `{pending, accepted}` unique) and
  because an application can accumulate more than one *rejected*
  assignment record over time (repeated reject → reassign) while only
  ever having at most one active one.

### ProgressLog
References `Application`. `{weekLabel, description, evidence:{type,value}, verified, verifiedBy?, verifiedAt?, createdAt}`.
Only valid to create when the parent application's `currentStatus`
is `inProgress`, enforced in the service layer at write time.

### Dismissal
References `Application`, `dismissedBy` (faculty `User`), `dismissedAt`, `note?`.
The only persisted artifact of the risk model (API contract Section
2 — risk itself is never stored). A live HIGH/MEDIUM result is
suppressed in the UI if a `Dismissal` exists for the application and
no `ProgressLog` has been created since `dismissedAt` — this is a
comparison done at read time between two timestamps, not a state
machine, and needs no additional field on `Application`.

## Relationships

```
User 1─1 StudentProfile      (role = student)
User 1─1 CompanyProfile      (role = company)
CompanyProfile 1─N Internship
StudentProfile 1─N Application
Internship 1─N Application
Application 1─N ProgressLog
Application 1─1 MentorAssignment (active: pending|accepted, at most one)
Application 1─N MentorAssignment (historical, includes rejected)
Application 1─N Dismissal
User(faculty) 1─N MentorAssignment
```

All references above are Mongoose `ObjectId` refs, not embeds, except
`Internship.criteria`, `Application.timeline[]`, and
`Application.eligibilitySnapshot`/`override`, which are embedded for
the reasons stated under each entity — they have no independent
identity, are always read with their parent, and are never queried
across parents.

## Ownership of data

Matches the API contract's permission matrix exactly — this is a
pointer, not a restatement:
- A student owns their `StudentProfile` and their own `Application`
  rows.
- A company owns its `Internship` postings; it never owns or writes
  `Application.eligibilitySnapshot` or `override`.
- T&P is the only writer of `override` and the only party who can
  verify a `CompanyProfile`.
- Faculty writes only `MentorAssignment` responses (their own),
  `ProgressLog.verified`, and `Dismissal`.
- HOD writes nothing — read-only, department-scoped.

## Indexing requirements

```
User.email                                    unique
Application{studentId, internshipId}          unique, partial:
  status NOT IN (rejected, withdrawn, cancelled)
  — enforces invariant #8 (duplicate-application prevention) at the DB level
MentorAssignment{applicationId}                unique, partial:
  status IN (pending, accepted)
  — enforces invariant #11 (assignment uniqueness) at the DB level
Internship{companyId, status}
Application{internshipId, currentStatus}       — backs the "filled" count check
Application{studentId, currentStatus}
ProgressLog{applicationId, createdAt}
MentorAssignment{facultyId, status}
InviteToken.token                              unique
```

The two partial-unique indexes are not optional hardening — they are
the actual enforcement mechanism for invariants #8 and #11.
Application-layer duplicate checks alone are insufficient under
concurrent requests, per the API contract.

## Invariants (database-level restatement of API contract Section 4)

1. `Application.eligibilitySnapshot` is write-once. No service or
   route may issue an update to this field after creation.
2. `Application.timeline[]` is append-only; `currentStatus` is derived
   and updated only alongside an append, in the same write.
3. `Internship.criteria` edits never cascade to existing
   `Application.eligibilitySnapshot` documents — there is no
   reference from criteria back to snapshots to cascade through.
4. Company-verify and posting auto-publish (API contract fix #4) is
   one transaction touching `CompanyProfile`/`User.status` and every
   affected `Internship.status` in `pendingApproval` for that company.
5. Accept-offer and multi-offer withdrawal (fix #1) is one transaction
   touching the accepted `Application` and every other `offered`
   `Application` for that `studentId`.
6. Risk is never persisted; only `Dismissal` is. There is no
   `riskLevel` or `riskScore` field anywhere in this schema.