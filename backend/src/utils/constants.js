/**
 * Domain constants: enums, state machines, lookup tables.
 *
 * These live in utils/ per the architecture (Architecture.md:
 * "utils/ → ALLOWED_TRANSITIONS table, shared validators").
 *
 * All modules import from here. String literals for statuses are
 * never re-declared in individual model files.
 */

// ── Roles ──────────────────────────────────────────────────────────────────
export const ROLES = Object.freeze({
  STUDENT: 'student',
  COMPANY: 'company',
  FACULTY: 'faculty',
  HOD: 'hod',
  TNP: 'tnp',
});

// ── System Sentinel ────────────────────────────────────────────────────────
// Reserved sentinel ObjectId string and role for system-generated timeline
// and audit entries (e.g. auto-withdrawals, batch closures).
export const SYSTEM_ACTOR_ID = '000000000000000000000000';
export const SYSTEM_ROLE = 'system';

// ── User / Company account status ──────────────────────────────────────────
export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  PENDING: 'pending',
  VERIFIED: 'verified',
});

// ── Internship posting status ──────────────────────────────────────────────
export const INTERNSHIP_STATUS = Object.freeze({
  PENDING_APPROVAL: 'pendingApproval',
  OPEN: 'open',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
});

// ── Application lifecycle statuses ─────────────────────────────────────────
export const APPLICATION_STATUS = Object.freeze({
  APPLIED: 'applied',
  SHORTLISTED: 'shortlisted',
  OFFERED: 'offered',
  ACCEPTED: 'accepted',
  TNP_VERIFIED: 'tnpVerified',
  MENTOR_PENDING: 'mentorPending',
  MENTOR_ASSIGNED: 'mentorAssigned',
  IN_PROGRESS: 'inProgress',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  CANCELLED: 'cancelled',
});

// Terminal states: no transitions out of these (API Contract Section 2)
export const TERMINAL_STATUSES = Object.freeze([
  APPLICATION_STATUS.REJECTED,
  APPLICATION_STATUS.WITHDRAWN,
  APPLICATION_STATUS.CANCELLED,
  APPLICATION_STATUS.COMPLETED,
]);

// Active (non-terminal-negative) statuses — used for vacancy fill count
// (API Contract Section 2: "Filled" = applications in these states >= vacancies)
export const ACTIVE_STATUSES = Object.freeze([
  APPLICATION_STATUS.OFFERED,
  APPLICATION_STATUS.ACCEPTED,
  APPLICATION_STATUS.TNP_VERIFIED,
  APPLICATION_STATUS.MENTOR_PENDING,
  APPLICATION_STATUS.MENTOR_ASSIGNED,
  APPLICATION_STATUS.IN_PROGRESS,
  APPLICATION_STATUS.COMPLETED,
]);

/**
 * ALLOWED_TRANSITIONS — the single state-machine lookup table.
 *
 * Architecture.md: "transition checked against ALLOWED_TRANSITIONS before
 * any write" — no inline transition logic in any handler.
 * API Contract Section 2 state diagram is the authoritative source.
 *
 * Key: currentStatus. Value: array of valid next statuses.
 */
export const ALLOWED_TRANSITIONS = Object.freeze({
  [APPLICATION_STATUS.APPLIED]: [
    APPLICATION_STATUS.SHORTLISTED,
    APPLICATION_STATUS.REJECTED,
    APPLICATION_STATUS.CANCELLED,
  ],
  [APPLICATION_STATUS.SHORTLISTED]: [
    APPLICATION_STATUS.OFFERED,
    APPLICATION_STATUS.REJECTED,
    APPLICATION_STATUS.CANCELLED,
  ],
  [APPLICATION_STATUS.OFFERED]: [
    APPLICATION_STATUS.ACCEPTED,   // student accept
    APPLICATION_STATUS.WITHDRAWN,  // student decline
    APPLICATION_STATUS.CANCELLED,
  ],
  [APPLICATION_STATUS.ACCEPTED]: [
    APPLICATION_STATUS.TNP_VERIFIED,
    APPLICATION_STATUS.OFFERED,    // T&P reject-offer: reverts to offered
    APPLICATION_STATUS.CANCELLED,
  ],
  [APPLICATION_STATUS.TNP_VERIFIED]: [
    APPLICATION_STATUS.MENTOR_PENDING, // T&P assigns faculty
    APPLICATION_STATUS.CANCELLED,
  ],
  [APPLICATION_STATUS.MENTOR_PENDING]: [
    APPLICATION_STATUS.MENTOR_ASSIGNED, // faculty accepts
    APPLICATION_STATUS.TNP_VERIFIED,    // faculty rejects → back to queue
    APPLICATION_STATUS.CANCELLED,
  ],
  [APPLICATION_STATUS.MENTOR_ASSIGNED]: [
    APPLICATION_STATUS.IN_PROGRESS, // first progress log submitted
    APPLICATION_STATUS.CANCELLED,
  ],
  [APPLICATION_STATUS.IN_PROGRESS]: [
    APPLICATION_STATUS.COMPLETED,
    APPLICATION_STATUS.CANCELLED,
  ],
  // Terminal states — empty arrays enforce the no-exit rule
  [APPLICATION_STATUS.COMPLETED]: [],
  [APPLICATION_STATUS.REJECTED]: [],
  [APPLICATION_STATUS.WITHDRAWN]: [],
  [APPLICATION_STATUS.CANCELLED]: [],
});

// ── Mentor assignment status ───────────────────────────────────────────────
export const MENTOR_ASSIGNMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
});

// ── Progress log evidence types ────────────────────────────────────────────
export const EVIDENCE_TYPE = Object.freeze({
  LINK: 'link',
  FILE: 'file',
  TEXT: 'text',
});

// ── Internship delivery modes ──────────────────────────────────────────────
export const INTERNSHIP_MODE = Object.freeze({
  REMOTE: 'remote',
  ONSITE: 'onsite',
  HYBRID: 'hybrid',
});
