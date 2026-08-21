import {
  getOffCampusVerificationQueue,
  verifyOffCampusOpportunity,
  rejectOffCampusOpportunity,
} from '../student/services/offCampus.service.js';

/**
 * GET /api/v1/tnp/off-campus/verification-queue
 * Role: tnp
 */
export async function getVerificationQueue(req, res, next) {
  try {
    const data = await getOffCampusVerificationQueue();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/tnp/off-campus-opportunities/:id/verify
 * Role: tnp
 */
export async function verifyOpportunity(req, res, next) {
  try {
    const actor = { id: req.user.id, role: req.user.role };
    const data = await verifyOffCampusOpportunity(req.params.id, actor);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/tnp/off-campus-opportunities/:id/reject
 * Role: tnp
 */
export async function rejectOpportunity(req, res, next) {
  try {
    const actor = { id: req.user.id, role: req.user.role };
    const data = await rejectOffCampusOpportunity(req.params.id, actor, req.body?.reason);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
