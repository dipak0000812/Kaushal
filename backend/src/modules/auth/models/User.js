import mongoose from 'mongoose';
import { ROLES, USER_STATUS } from '../../../utils/constants.js';

const { Schema } = mongoose;

/**
 * User — root identity for every role.
 *
 * Data_Model.md:
 *   - role: set at creation, never client-chosen after
 *   - status: active | pending | verified; company accounts start pending;
 *             faculty/hod/tnp/student are always active
 *   - department: present for faculty/hod/student; set by T&P at creation
 *                 (faculty/hod), self-reported (student)
 *   - email: unique
 *   - passwordHash: select:false — never returned in normal queries
 *   - createdBy: ref User (T&P-provisioned accounts)
 */
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [200, 'Name must be at most 200 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },

    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // never returned in queries unless explicitly projected
    },

    role: {
      type: String,
      enum: {
        values: Object.values(ROLES),
        message: 'Role must be one of: ' + Object.values(ROLES).join(', '),
      },
      required: [true, 'Role is required'],
      immutable: true, // set at creation, never changed — Data_Model.md invariant
    },

    /**
     * status:
     *   - company accounts start 'pending' until T&P verifies → 'verified'
     *   - all other roles: 'active' (default)
     * Verified is one-way (pending → verified) per API Contract Section 2.
     */
    status: {
      type: String,
      enum: {
        values: Object.values(USER_STATUS),
        message: 'Status must be one of: ' + Object.values(USER_STATUS).join(', '),
      },
      default: USER_STATUS.ACTIVE,
    },

    /**
     * department:
     *   - required for faculty, hod
     *   - populated for student (self-reported at registration)
     *   - absent for company, tnp
     */
    department: {
      type: String,
      trim: true,
    },

    /**
     * createdBy: ref to the T&P User who provisioned this account.
     * Null for self-registered students and company accounts.
     */
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt managed by Mongoose
    collection: 'users',
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────
// email uniqueness is already declared above via unique:true (creates index)
// Additional lookup patterns:
userSchema.index({ role: 1 }); // roleGuard + T&P user management queries
userSchema.index({ role: 1, department: 1 }); // HOD dept-scoped queries

export const User = mongoose.model('User', userSchema);
