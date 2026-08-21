import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * InviteToken — backs POST /tnp/invites.
 *
 * Data_Model.md:
 *   { companyName, contactEmail, token, expiresAt, usedAt }
 *   Consumed once at POST /auth/register/company.
 *   A used or expired token is rejected, not silently reused.
 *
 * API Contract: POST /tnp/invites → {companyName, contactEmail}
 *               returns {inviteToken, expiresAt}
 */
const inviteTokenSchema = new Schema(
  {
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },

    contactEmail: {
      type: String,
      required: [true, 'Contact email is required'],
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },

    token: {
      type: String,
      required: [true, 'Token is required'],
      unique: true, // Index: token unique — Data_Model.md indexing requirements
    },

    expiresAt: {
      type: Date,
      required: [true, 'Expiry date is required'],
    },

    /**
     * usedAt: null until the token is consumed at company registration.
     * Once set, the token is rejected on any further use.
     */
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt = when T&P issued the invite
    collection: 'invitetokens',
  },
);

// token unique index already declared above; add expiry lookup for TTL checks
inviteTokenSchema.index({ expiresAt: 1 }); // find expired tokens efficiently

export const InviteToken = mongoose.model('InviteToken', inviteTokenSchema);
