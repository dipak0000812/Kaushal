import mongoose from 'mongoose';
import { EVIDENCE_TYPE } from '../../../utils/constants.js';

const { Schema } = mongoose;

/**
 * ProgressLog — weekly progress submission by a student.
 *
 * Data_Model.md:
 *   References Application.
 *   {weekLabel, description, evidence:{type,value},
 *    verified, verifiedBy?, verifiedAt?, createdAt}
 *   Only valid to create when parent application's currentStatus
 *   is 'inProgress' — enforced in the service layer at write time.
 *
 * API Contract:
 *   POST /student/applications/:id/progress-logs
 *   PATCH /faculty/progress-logs/:id/verify
 *
 * Risk engine reads these to compute:
 *   - submission frequency trend
 *   - evidence attachment rate
 *   - days-since-last-submission
 */

/**
 * Evidence subdocument — embedded, no independent identity.
 */
const evidenceSchema = new Schema(
  {
    type: {
      type: String,
      enum: {
        values: Object.values(EVIDENCE_TYPE),
        message: 'Evidence type must be one of: ' + Object.values(EVIDENCE_TYPE).join(', '),
      },
      required: [true, 'Evidence type is required'],
    },
    value: {
      type: String,
      required: [true, 'Evidence value is required'],
      trim: true,
    },
  },
  { _id: false },
);

const progressLogSchema = new Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required'],
    },

    weekLabel: {
      type: String,
      required: [true, 'Week label is required'],
      trim: true,
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },

    evidence: {
      type: evidenceSchema,
      default: null,
    },

    /**
     * verified: set by faculty via PATCH /faculty/progress-logs/:id/verify.
     * Faculty must own the parent MentorAssignment (status: accepted)
     * to verify — enforced in service layer.
     */
    verified: {
      type: Boolean,
      default: false,
    },

    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt used by risk engine for submission trend/timing
    collection: 'progresslogs',
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────
// Data_Model.md: ProgressLog{applicationId, createdAt}
// Backs risk engine: fetch recent logs in chronological order
progressLogSchema.index({ applicationId: 1, createdAt: 1 });

// Backs faculty "who hasn't submitted this week" filter
// GET /faculty/students/no-submission
progressLogSchema.index({ applicationId: 1, verified: 1 });

export const ProgressLog = mongoose.model('ProgressLog', progressLogSchema);
