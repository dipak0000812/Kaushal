import mongoose from 'mongoose';
import {
  INTERNSHIP_STATUS,
  INTERNSHIP_MODE,
  INTERNSHIP_SOURCE,
  OFF_CAMPUS_VERIFICATION_STATUS,
} from '../../../utils/constants.js';

const { Schema } = mongoose;

/**
 * Internship — a job posting created by a company or an externally registered opportunity.
 *
 * Data_Model.md:
 *   References CompanyProfile (for CAMPUS opportunities).
 *   criteria: embedded object (minCgpa, maxBacklogs, department,
 *     year, requiredSkills[], requiredCerts[]) — embedded because
 *     criteria has no independent identity outside its posting.
 *   status: pendingApproval | open | closed | cancelled
 *   source: campus | off_campus
 *   vacancies, lastDate
 *
 *   Closure is NOT a stored derived flag — "filled" is computed at
 *   read and write time from a count of non-terminal-negative
 *   applications (API contract Section 2).
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

/**
 * Off-campus verification — embedded subdocument for student-submitted opportunities.
 */
const offCampusVerificationSchema = new Schema(
  {
    status: {
      type: String,
      enum: {
        values: Object.values(OFF_CAMPUS_VERIFICATION_STATUS),
        message: 'Invalid off-campus verification status',
      },
      default: OFF_CAMPUS_VERIFICATION_STATUS.PENDING,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'StudentProfile',
      default: null,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    evidenceUrl: {
      type: String,
      trim: true,
      default: null,
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
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { _id: false },
);

const internshipSchema = new Schema(
  {
    source: {
      type: String,
      enum: {
        values: Object.values(INTERNSHIP_SOURCE),
        message: 'Source must be one of: ' + Object.values(INTERNSHIP_SOURCE).join(', '),
      },
      default: INTERNSHIP_SOURCE.CAMPUS,
      required: [true, 'Source is required'],
    },

    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'CompanyProfile',
      default: null,
    },

    externalCompanyName: {
      type: String,
      trim: true,
      maxlength: [300, 'Company name must be at most 300 characters'],
      default: null,
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

    criteria: {
      type: criteriaSchema,
      default: () => ({}),
    },

    offCampusVerification: {
      type: offCampusVerificationSchema,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'internships',
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────
internshipSchema.index({ companyId: 1, status: 1 });
internshipSchema.index({ status: 1 });
internshipSchema.index({ status: 1, lastDate: 1 });
internshipSchema.index({ source: 1 });
internshipSchema.index({ 'offCampusVerification.status': 1 });

export const Internship = mongoose.model('Internship', internshipSchema);
