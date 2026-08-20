import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * CompanyProfile — profile data for a company user.
 *
 * Data_Model.md:
 *   References User. Holds companyName, contact info.
 *   Verification state lives on the parent User.status
 *   (pending → verified), not duplicated here.
 *
 * Note: company verification (pending → verified) is on User.status.
 * This model stores only descriptive profile data.
 */
const companyProfileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true, // one profile per company user
    },

    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [300, 'Company name must be at most 300 characters'],
    },

    contactEmail: {
      type: String,
      required: [true, 'Contact email is required'],
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },

    website: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'companyprofiles',
  },
);

// userId unique already declared above

export const CompanyProfile = mongoose.model('CompanyProfile', companyProfileSchema);
