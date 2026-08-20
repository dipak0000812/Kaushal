import { ALLOWED_TRANSITIONS } from '../../../utils/constants.js';
import { Application } from '../models/Application.js';

function createError(message, code, status) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

/**
 * Validates and applies a single state transition on an Application,
 * appending an audit entry to timeline in the same write.
 *
 * Uses a compare-and-swap write (filter includes currentStatus) so that a
 * concurrent call that changes the document between our read and our write
 * causes the write to match nothing, surfacing as TRANSITION_CONFLICT/409
 * rather than silently corrupting state.
 *
 * @param {string} applicationId
 * @param {string} toStatus - must be a value from APPLICATION_STATUS
 * @param {{id: string, role: string}} actor - who is performing this transition
 * @param {string} [reason] - required by convention for tnp/faculty rejection actions, optional otherwise
 * @param {import('mongoose').ClientSession} [session] - optional, pass through if caller is already inside a transaction
 * @returns {Promise<object>} the updated Application document
 * @throws {Error} .code="NOT_FOUND"          .status=404 — application does not exist
 * @throws {Error} .code="INVALID_TRANSITION"  .status=409 — transition not in ALLOWED_TRANSITIONS
 * @throws {Error} .code="TRANSITION_CONFLICT" .status=409 — concurrent write changed status before this write landed
 */
export async function applyTransition(applicationId, toStatus, actor, reason, session) {
  const queryOpts = {};
  if (session != null) queryOpts.session = session;

  // ── Step 1: Read current document ────────────────────────────────────────
  // Required to (a) detect NOT_FOUND vs invalid transition and (b) supply
  // the fromStatus value needed for ALLOWED_TRANSITIONS lookup and the
  // compare-and-swap filter below.
  const app = await Application.findById(applicationId, null, queryOpts);

  if (!app) {
    throw createError(
      `Application '${applicationId}' not found`,
      'NOT_FOUND',
      404,
    );
  }

  const fromStatus = app.currentStatus;

  // ── Step 2: Validate transition — no write on failure ────────────────────
  const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw createError(
      `Cannot transition from '${fromStatus}' to '${toStatus}'`,
      'INVALID_TRANSITION',
      409,
    );
  }

  // ── Step 3: Compare-and-swap write ───────────────────────────────────────
  // Filter includes currentStatus: fromStatus so that if a concurrent call
  // already changed currentStatus between our read (step 1) and this write,
  // the filter will not match and findOneAndUpdate returns null.
  // $set and $push are still one atomic operation — currentStatus and
  // timeline remain in sync even under concurrency.
  const updated = await Application.findOneAndUpdate(
    { _id: applicationId, currentStatus: fromStatus },
    {
      $set: { currentStatus: toStatus },
      $push: {
        timeline: {
          fromStatus,
          toStatus,
          actorId: actor.id,
          actorRole: actor.role,
          reason: reason ?? null,
          at: new Date(),
        },
      },
    },
    { returnDocument: 'after', ...queryOpts },
  );

  // ── Step 4: Null means someone else changed currentStatus first ───────────
  // Do NOT retry — surface the conflict so the caller can decide (re-fetch,
  // re-validate, and retry with the current state if still appropriate).
  if (!updated) {
    throw createError(
      'Application status changed concurrently, retry the operation',
      'TRANSITION_CONFLICT',
      409,
    );
  }

  return updated;
}
