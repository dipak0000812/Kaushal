import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * StudentProfile — profile data for a student user.
 *
 * Data_Model.md:
 *   References User. Holds department, year, cgpa, backlog count,
 *   skills[], certifications[], resume reference.
 *   Writable by the owning student until they have any non-draft
 *   application on record (PATCH /student/profile returns 409 after
 *   that point — enforced in the service layer, not here).
 *
 * Note: this constraint (write-lock after first application) is
 * service-layer logic, not schema-level validation, because it
 * requires a cross-collection query. The model itself places no
 * such restriction — the service does.
 */
const studentProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true, // one profile per student user
    },

    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },

    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [1, 'Year must be at least 1'],
      max: [6, 'Year must be at most 6'],
    },

    cgpa: {
      type: Number,
      required: [true, 'CGPA is required'],
      min: [0, 'CGPA must be at least 0'],
      max: [10, 'CGPA must be at most 10'],
    },

    activeBacklogs: {
      type: Number,
      required: [true, 'Active backlogs count is required'],
      min: [0, 'Active backlogs cannot be negative'],
      default: 0,
    },

    skills: {
      type: [String],
      default: [],
    },

    certifications: {
      type: [String],
      default: [],
    },

    resumeUrl: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'studentprofiles',
  },
);

// userId unique index already declared above via unique:true
// Department index supports HOD department-scoped queries
studentProfileSchema.index({ department: 1 });

export const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
