import {
  submitOffCampusOpportunity,
  getStudentOffCampusOpportunities,
} from './services/offCampus.service.js';

/**
 * POST /api/v1/student/off-campus-opportunities
 * Role: student
 */
export async function submitOpportunity(req, res, next) {
  try {
    const data = await submitOffCampusOpportunity(req.user.id, req.body);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/student/off-campus-opportunities
 * Role: student
 */
export async function getMyOpportunities(req, res, next) {
  try {
    const data = await getStudentOffCampusOpportunities(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
