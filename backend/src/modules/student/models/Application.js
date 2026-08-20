import mongoose from 'mongoose';
import { APPLICATION_STATUS, TERMINAL_STATUSES } from '../../../utils/constants.js';

const { Schema } = mongoose;

/**
 * Application — the central entity.
 *
 * Data_Model.md:
 *   References StudentProfile and Internship. Nearly every other
 *   collection either hangs off it or reads from it.
 *
 *   currentStatus: always equals timeline[timeline.length-1].status,
 *     updated in the same write that appends to timeline (invariant #4).
 *
 *   timeline[]: embedded, append-only array of status transitions.
 *     {fromStatus, toStatus, actorId, actorRole, reason?, at}
 *     Embedded because always read with parent, never queried across
 *     applications at scale.
 *
 *   eligibilitySnapshot: embedded, written once at POST /student/applications,
 *     never mutated (invariant #3).
 *     {eligible, checks[], computedAt}
 *
 *   override: embedded nullable, written only by T&P PATCH /tnp/applications/:id/override.
 *     {eligible, reason, byUserId, at}
 *     Effective eligibility: override?.eligible ?? eligibilitySnapshot.eligible
 *     (API Contract Section 1, fix #3)
 *
 *   ppoOffered: boolean flag set by company evaluate; completed remains
 *     the terminal status, this is just a flag on it.
 *
 * CRITICAL INDEXES (Data_Model.md + Architecture.md invariants #8 and #11):
 *   Application{studentId, internshipId}: unique partial, excludes terminal states
 *   Application{internshipId, currentStatus}: backs vacancy fill count
 *   Application{studentId, currentStatus}: student's own application queries
 */

/**
 * Individual eligibility check result — embedded in eligibilitySnapshot.
 * Matches the shape the eligibility engine returns (per master guide Section 5).
 */
const eligibilityCheckSchema = new Schema(
  {
    criterion: { type: String, required: true },
    required: { type: Schema.Types.Mixed, default: null }, // could be Number, String[], etc.
    actual: { type: Schema.Types.Mixed, default: null },
    pass: { type: Boolean, required: true },
    reason: { type: String, default: null },
  },
  { _id: false },
);

/**
 * Eligibility snapshot — written once at application submission.
 * Invariant #3: immutable after creation.
 */
const eligibilitySnapshotSchema = new Schema(
  {
    eligible: { type: Boolean, required: true },
    checks: { type: [eligibilityCheckSchema], default: [] },
    computedAt: { type: Date, required: true },
  },
  { _id: false },
);

/**
 * T&P manual override — nullable, layered on top of the snapshot.
 * Invariant #3: original eligibilitySnapshot.checks preserved for audit.
 */
const overrideSchema = new Schema(
  {
    eligible: { type: Boolean, required: true },
    reason: { type: String, required: true },
    byUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

/**
 * Timeline entry — append-only audit trail.
 * Invariant #4: timeline[] is append-only, no entry is mutated or deleted.
 */
const timelineEntrySchema = new Schema(
  {
    fromStatus: {
      type: String,
      default: null, // null for the initial 'applied' entry
    },
    toStatus: {
      type: String,
      required: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actorRole: {
      type: String,
      required: true,
    },
    reason: {
      type: String,
      default: null,
    },
    at: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false }, // embedded — no independent identity
);

const applicationSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: [true, 'Student reference is required'],
    },

    internshipId: {
      type: Schema.Types.ObjectId,
      ref: 'Internship',
      required: [true, 'Internship reference is required'],
    },

    currentStatus: {
      type: String,
      enum: {
        values: Object.values(APPLICATION_STATUS),
        message: 'Invalid application status',
      },
      required: [true, 'Current status is required'],
      default: APPLICATION_STATUS.APPLIED,
    },

    /**
     * timeline[] — append-only audit trail.
     * currentStatus is always kept in sync with
     * timeline[timeline.length - 1].toStatus in the same write (invariant #4).
     */
    timeline: {
      type: [timelineEntrySchema],
      default: [],
    },

    /**
     * eligibilitySnapshot — write-once at application creation.
     * Never mutated after that (invariant #3).
     * Required: the snapshot is always computed and stored, even if
     * eligible: false (API Contract fix #2 — submission never server-blocked).
     */
    eligibilitySnapshot: {
      type: eligibilitySnapshotSchema,
      required: [true, 'Eligibility snapshot is required'],
    },

    /**
     * override — nullable. Written only by T&P via PATCH /tnp/applications/:id/override.
     * Effective eligibility for consumers:
     *   override?.eligible ?? eligibilitySnapshot.eligible
     */
    override: {
      type: overrideSchema,
      default: null,
    },

    /**
     * ppoOffered — set by company POST /company/applications/:id/evaluate.
     * Not a separate terminal state — 'completed' is still the status.
     */
    ppoOffered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAt = submission time, updatedAt tracks last mutation
    collection: 'applications',
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────

/**
 * CRITICAL: Partial unique index on {studentId, internshipId} excluding terminal states.
 *
 * Data_Model.md + Architecture.md invariant #8:
 * "Duplicate-application prevention is a database-level unique constraint
 * (studentId + internshipId, partial index excluding terminal states),
 * not just an application-level check."
 *
 * A student can re-apply after a rejection/withdrawal/cancellation,
 * but cannot have two active applications to the same internship.
 */
applicationSchema.index(
  { studentId: 1, internshipId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      currentStatus: { $nin: TERMINAL_STATUSES },
    },
    name: 'unique_active_application_per_student_internship',
  },
);

/**
 * Backs the vacancy "filled" count query:
 * count of applications where internshipId=X AND currentStatus IN ACTIVE_STATUSES
 * Used in lazy closure check (API Contract fix #5).
 * Data_Model.md: Application{internshipId, currentStatus}
 */
applicationSchema.index({ internshipId: 1, currentStatus: 1 });

/**
 * Student's own application list queries.
 * Data_Model.md: Application{studentId, currentStatus}
 */
applicationSchema.index({ studentId: 1, currentStatus: 1 });

export const Application = mongoose.model('Application', applicationSchema);
