// FILE: src/modules/hod/hod.controller.js
import { getHodDepartmentDashboard } from '../analytics/analytics.service.js';

/**
 * GET /api/v1/hod/dashboard
 *
 * Department-scoped analytics for the HOD role.
 * department MUST come from req.user.department — never from query params or body.
 * (Architecture.md invariant #7)
 */
export async function getDashboard(req, res) {
  try {
    const department = req.user.department;
    if (!department) {
      return res.status(400).json({
        error: 'Department not set on your account. Contact T&P to update your profile.',
      });
    }

    const data = await getHodDepartmentDashboard(department);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.code === 'VALIDATION_ERROR' || err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
}
