// FILE: src/modules/analytics/analytics.controller.js
import {
  getTnpDashboard as dashboardService,
  getTnpAlerts as alertsService,
  getHodDepartmentDashboard,
} from './analytics.service.js';

import { ValidationError } from '../../core/errors.js';

/**
 * GET /api/v1/analytics/dashboard
 * Role: tnp
 *
 * Returns full T&P analytics dashboard:
 * applicationFunnel, skillGapReport, departmentStats, ppoOutcomes, companyStats.
 */
export async function getTnpDashboard(req, res, next) {
  try {
    const data = await dashboardService();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/analytics/alerts
 * Role: tnp
 *
 * Returns alert counts: zeroEligibleApplicants, unassignedMentorCount,
 * pendingOfferVerification, atRiskCount.
 */
export async function getTnpAlerts(req, res, next) {
  try {
    const data = await alertsService();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/analytics/hod
 * Role: hod
 *
 * Department is sourced ONLY from req.user.department — never from query params
 * or body (Architecture.md invariant #7).
 */
export async function getHodDashboard(req, res, next) {
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
