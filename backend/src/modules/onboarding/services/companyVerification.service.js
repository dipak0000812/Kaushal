import mongoose from 'mongoose';
import { ROLES, USER_STATUS, INTERNSHIP_STATUS } from '../../../utils/constants.js';
import { User } from '../../auth/models/User.js';
import { CompanyProfile } from '../../company/models/CompanyProfile.js';
import { Internship } from '../../company/models/Internship.js';

function createError(message, code, status) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

/**
 * Verifies a company account (User.status: pending -> verified) and, in the
 * same transaction, auto-publishes every Internship posting belonging to
 * that company currently sitting in 'pendingApproval' status to 'open'.
 * See API contract invariant #12 — a posting must never be left stuck
 * pendingApproval after its company is already verified.
 *
 * @param {string} companyUserId - the User._id of the company account
 * @param {{id: string, role: string}} actor - must be tnp role, caller's responsibility to check role via roleGuard before calling this
 * @returns {Promise<{user: object, publishedCount: number}>}
 * @throws {Error} .code="NOT_FOUND" .status=404 - no such user, or user's role is not 'company'
 * @throws {Error} .code="CONFLICT" .status=409 - user is already verified (not currently pending)
 */
export async function verifyCompany(companyUserId, actor) {
  const session = await mongoose.startSession();

  let updatedUser;
  let publishedCount = 0;

  try {
    await session.withTransaction(async () => {
      publishedCount = 0;

      // ── Step 1 & 2: Fetch and validate user ─────────────────────────────
      const user = await User.findById(companyUserId, null, { session });

      if (!user || user.role !== ROLES.COMPANY) {
        throw createError('Company account not found', 'NOT_FOUND', 404);
      }

      // ── Step 3: Conflict check if already verified ──────────────────────
      if (user.status === USER_STATUS.VERIFIED) {
        throw createError('Company is already verified', 'CONFLICT', 409);
      }

      // ── Step 4: Update User.status to verified ──────────────────────────
      updatedUser = await User.findByIdAndUpdate(
        companyUserId,
        { $set: { status: USER_STATUS.VERIFIED } },
        { returnDocument: 'after', session },
      );

      // ── Step 5: Fetch CompanyProfile to get companyId for postings ──────
      const companyProfile = await CompanyProfile.findOne(
        { userId: companyUserId },
        '_id',
        { session },
      );

      // ── Step 6: Bulk update pendingApproval postings to open ───────────
      if (companyProfile) {
        const updateResult = await Internship.updateMany(
          {
            companyId: companyProfile._id,
            status: INTERNSHIP_STATUS.PENDING_APPROVAL,
          },
          { $set: { status: INTERNSHIP_STATUS.OPEN } },
          { session },
        );
        publishedCount = updateResult.modifiedCount ?? 0;
      }
    });
  } finally {
    await session.endSession();
  }

  return { user: updatedUser, publishedCount };
}
