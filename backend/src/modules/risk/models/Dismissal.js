import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Dismissal — the only persisted artifact of the risk model.
 *
 * Data_Model.md:
 *   References Application, dismissedBy (faculty User),
 *   dismissedAt, note?.
 *   Risk itself is never stored — only Dismissal records are.
 *
 * Suppression rule (API Contract Section 2, fix #6):
 *   A live HIGH/MEDIUM risk result is suppressed if a Dismissal
 *   exists for the application AND no ProgressLog has been submitted
 *   since dismissedAt. This is a read-time timestamp comparison —
 *   no state machine, no scheduler, no extra field on Application.
 *
 * API Contract: PATCH /faculty/risk-flags/:applicationId/dismiss
 *   {note?} — faculty who owns the accepted assignment for this application.
 *
 * Architecture.md:
 *   "Risk is computed live; only dismissals are persisted."
 *   "No scheduled job is required or assumed."
 */
const dismissalSchema = new Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'Application',
      required: [true, 'Application reference is required'],
    },

    dismissedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Dismissing faculty user reference is required'],
    },

    dismissedAt: {
      type: Date,
      required: [true, 'Dismissal timestamp is required'],
      default: Date.now,
    },

    note: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'dismissals',
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────
// Data_Model.md: Dismissal indexed on applicationId
// Backs the suppression check: findOne({applicationId}).sort({dismissedAt:-1})
dismissalSchema.index({ applicationId: 1, dismissedAt: -1 });

export const Dismissal = mongoose.model('Dismissal', dismissalSchema);
