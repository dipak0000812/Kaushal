// FILE: src/modules/hod/hod.controller.js
import { getHodDepartmentDashboard } from '../analytics/analytics.service.js';

import { ValidationError } from '../../core/errors.js';

/**
 * GET /api/v1/hod/dashboard
 *
 * Department-scoped analytics for the HOD role.
 * department MUST come from req.user.department — never from query params or body.
 * (Architecture.md invariant #7)
 */
export async function getDashboard(req, res, next) {
  try {
    const department = req.user.department;
    if (!department) {
      throw new ValidationError('Department not set on your account. Contact T&P to update your profile.');
    }

    const data = await getHodDepartmentDashboard(department);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
