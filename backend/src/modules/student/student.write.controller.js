import { updateStudentProfile } from '../auth/auth.service.js';

/**
 * PATCH /api/v1/student/profile
 * Updates the authenticated student's own profile.
 */
export async function updateProfile(req, res, next) {
  try {
    const updatedProfile = await updateStudentProfile(req.user.userId || req.user.id, req.body);
    return res.status(200).json({ success: true, data: updatedProfile });
  } catch (err) {
    next(err);
  }
}
