import mongoose from 'mongoose';
import { INTERNSHIP_STATUS, INTERNSHIP_MODE } from '../../../utils/constants.js';

const { Schema } = mongoose;

/**
 * Internship — a job posting created by a company.
 *
 * Data_Model.md:
 *   References CompanyProfile.
 *   criteria: embedded object (minCgpa, maxBacklogs, department,
 *     year, requiredSkills[], requiredCerts[]) — embedded because
 *     criteria has no independent identity outside its posting.
 *   status: pendingApproval | open | closed | cancelled
 *   vacancies, lastDate
 *
 *   Closure is NOT a stored derived flag — "filled" is computed at
 *   read and write time from a count of non-terminal-negative
 *   applications (API contract Section 2).
 *
 * API Contract notes:
 *   - auto-publishes (status: open) if company.status === verified at POST time
 *   - otherwise queued as pendingApproval
 *   - criteria edits never cascade to existing eligibilitySnapshot (invariant #3)
 */

/**
 * Eligibility criteria — embedded subdocument.
 * All fields optional at the schema level so companies can define
 * partial criteria; the eligibility engine treats missing/null
 * criteria as "no restriction on this criterion".
 */
const criteriaSchema = new Schema(
  {
    minCgpa: {
      type: Number,
      min: [0, 'minCgpa must be >= 0'],
      max: [10, 'minCgpa must be <= 10'],
      default: null,
    },
    maxBacklogs: {
      type: Number,
      min: [0, 'maxBacklogs must be >= 0'],
      default: null,
    },
    departments: {
      type: [String],
      default: [],
    },
    passingYear: {
      type: Number,
      default: null,
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    requiredCerts: {
      type: [String],
      default: [],
    },
  },
  { _id: false }, // embedded — no independent identity
);

const internshipSchema = new Schema(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'CompanyProfile',
      required: [true, 'Company reference is required'],
    },

    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [300, 'Title must be at most 300 characters'],
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },

    duration: {
      type: String,
      required: [true, 'Duration is required'],
      trim: true,
    },

    mode: {
      type: String,
      enum: {
        values: Object.values(INTERNSHIP_MODE),
        message: 'Mode must be one of: ' + Object.values(INTERNSHIP_MODE).join(', '),
      },
      required: [true, 'Mode is required'],
    },

    stipend: {
      type: Number,
      min: [0, 'Stipend cannot be negative'],
      default: 0,
    },

    vacancies: {
      type: Number,
      required: [true, 'Vacancies is required'],
      min: [1, 'Vacancies must be at least 1'],
    },

    lastDate: {
      type: Date,
      required: [true, 'Last application date is required'],
    },

    status: {
      type: String,
      enum: {
        values: Object.values(INTERNSHIP_STATUS),
        message: 'Status must be one of: ' + Object.values(INTERNSHIP_STATUS).join(', '),
      },
      default: INTERNSHIP_STATUS.PENDING_APPROVAL,
    },

    /**
     * criteria — embedded, not referenced.
     * Data_Model.md: "embedded, not referenced, because criteria has
     * no independent identity or lifecycle outside its posting."
     */
    criteria: {
      type: criteriaSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    collection: 'internships',
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────
// Data_Model.md: Internship{companyId, status}
internshipSchema.index({ companyId: 1, status: 1 });
// Supports GET /tnp/internships/pending-approval filter
internshipSchema.index({ status: 1 });
// Student browse: open internships sorted by date
internshipSchema.index({ status: 1, lastDate: 1 });

export const Internship = mongoose.model('Internship', internshipSchema);
