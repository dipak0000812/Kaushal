import mongoose from 'mongoose';
import { MENTOR_ASSIGNMENT_STATUS } from '../../../utils/constants.js';

const { Schema } = mongoose;

/**
 * MentorAssignment — faculty mentor assignment for an internship.
 *
 * Data_Model.md:
 *   References Application and the faculty User.
 *   status: pending | accepted | rejected
 *   rejectReason: nullable
 *
 *   Separate collection (not folded into Application) because:
 *   1. Uniqueness must be enforced independently:
 *      applicationId + status IN {pending, accepted} unique
 *   2. An application can accumulate multiple rejected assignment records
 *      over time (repeated reject → reassign cycle) while only ever
 *      having at most one active one.
 *
 * CRITICAL INDEX (Architecture.md invariant #11):
 *   Partial unique on {applicationId} where status IN {pending, accepted}
 *   Prevents a race where T&P double-assigns before first faculty response.
 *
 * API Contract (fix #2):
 *   pending → accepted  (faculty accept → application: mentorPending → mentorAssigned)
 *   pending → rejected  (faculty reject with reason → application: back to tnpVerified)
 */
const mentorAssignmentSchema = new Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required'],
    },

    facultyId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Faculty user reference is required'],
    },

    status: {
      type: String,
      enum: {
        values: Object.values(MENTOR_ASSIGNMENT_STATUS),
        message: 'Status must be one of: ' + Object.values(MENTOR_ASSIGNMENT_STATUS).join(', '),
      },
      required: [true, 'Status is required'],
      default: MENTOR_ASSIGNMENT_STATUS.PENDING,
    },

    rejectReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt = assignment creation, updatedAt = status change
    collection: 'mentorassignments',
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────

/**
 * CRITICAL: Partial unique index on applicationId where status IN {pending, accepted}.
 *
 * Architecture.md invariant #11:
 * "Mentor-assignment uniqueness is a database constraint, not
 * application-logic-only — only one pending/accepted assignment may
 * exist per application at any time."
 *
 * Multiple rejected records are allowed (rejected assignments are
 * outside this partial filter, so they don't trigger the constraint).
 */
mentorAssignmentSchema.index(
  { applicationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [MENTOR_ASSIGNMENT_STATUS.PENDING, MENTOR_ASSIGNMENT_STATUS.ACCEPTED] },
    },
    name: 'unique_active_assignment_per_application',
  },
);

// Data_Model.md: MentorAssignment{facultyId, status}
// Backs GET /faculty/assignments and GET /faculty/students queries
mentorAssignmentSchema.index({ facultyId: 1, status: 1 });

// Backs T&P unassigned-mentor query (find applications with no active assignment)
mentorAssignmentSchema.index({ applicationId: 1, status: 1 });

export const MentorAssignment = mongoose.model('MentorAssignment', mentorAssignmentSchema);
