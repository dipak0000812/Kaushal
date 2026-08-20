import mongoose from 'mongoose';
import { APPLICATION_STATUS, SYSTEM_ACTOR_ID, SYSTEM_ROLE } from '../../../utils/constants.js';
import { Application } from '../models/Application.js';
import { applyTransition } from './applicationTransition.service.js';

/**
 * Accepts one offer and, in the same transaction, withdraws every OTHER
 * application by the same student currently sitting in 'offered' status.
 * This is the actual trigger for multi-offer resolution — see API contract
 * invariant #9: accept and withdrawal must be one atomic operation.
 *
 * @param {string} applicationId - the application being accepted
 * @param {{id: string, role: string}} actor - must be the student themself
 * @returns {Promise<{accepted: object, withdrawnCount: number}>}
 * @throws propagates NOT_FOUND/INVALID_TRANSITION/TRANSITION_CONFLICT from applyTransition
 */
export async function acceptOffer(applicationId, actor) {
  const session = await mongoose.startSession();

  // accepted and withdrawnCount are set inside the withTransaction callback.
  // They are declared outside so the return statement can read them after commit.
  // withTransaction may retry on transient MongoDB errors — variables are
  // reset at the top of the callback so each attempt starts from a clean slate.
  let accepted;
  let withdrawnCount;

  try {
    await session.withTransaction(async () => {
      withdrawnCount = 0; // reset on every retry attempt

      // ── Step 1: Fetch target to obtain studentId ───────────────────────
      // We need studentId before we can query siblings. The status check is
      // deliberately left to applyTransition — do not duplicate it here.
      const target = await Application.findById(applicationId, 'studentId currentStatus', { session });

      if (!target) {
        const err = new Error(`Application '${applicationId}' not found`);
        err.code = 'NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const { studentId } = target;

      // ── Step 2: Accept the target ─────────────────────────────────────
      // applyTransition validates that currentStatus is 'offered' (via
      // ALLOWED_TRANSITIONS) and performs a compare-and-swap write. Any
      // validation or concurrency error propagates out of withTransaction,
      // causing the entire transaction to abort.
      accepted = await applyTransition(
        applicationId,
        APPLICATION_STATUS.ACCEPTED,
        actor,
        undefined,
        session,
      );

      // ── Step 3: Find sibling offered applications for the same student ─
      const siblings = await Application.find(
        {
          studentId,
          currentStatus: APPLICATION_STATUS.OFFERED,
          _id: { $ne: applicationId },
        },
        '_id',
        { session },
      );

      // ── Step 4: Withdraw each sibling sequentially ────────────────────
      // Sequential (not Promise.all) — concurrent writes on the same
      // session within a single transaction must not overlap.
      for (const sibling of siblings) {
        await applyTransition(
          sibling._id.toString(),
          APPLICATION_STATUS.WITHDRAWN,
          { id: SYSTEM_ACTOR_ID, role: SYSTEM_ROLE },
          'Auto-withdrawn: another offer accepted',
          session,
        );
        withdrawnCount++;
      }
    });
  } finally {
    // Always release the session — whether the transaction committed,
    // aborted, or threw a non-retriable error.
    await session.endSession();
  }

  return { accepted, withdrawnCount };
}
