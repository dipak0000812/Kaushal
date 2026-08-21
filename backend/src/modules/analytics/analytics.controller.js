// FILE: src/modules/analytics/analytics.controller.js
import {
  getTnpDashboard as dashboardService,
  getTnpAlerts as alertsService,
  getHodDepartmentDashboard,
} from './analytics.service.js';

/**
 * GET /api/v1/analytics/dashboard
 * Role: tnp
 *
 * Returns full T&P analytics dashboard:
 * applicationFunnel, skillGapReport, departmentStats, ppoOutcomes, companyStats.
 */
export async function getTnpDashboard(req, res) {
  try {
    const data = await dashboardService();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/analytics/alerts
 * Role: tnp
 *
 * Returns alert counts: zeroEligibleApplicants, unassignedMentorCount,
 * pendingOfferVerification, atRiskCount.
 */
export async function getTnpAlerts(req, res) {
  try {
    const data = await alertsService();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/analytics/hod
 * Role: hod
 *
 * Department is sourced ONLY from req.user.department — never from query params
 * or body (Architecture.md invariant #7).
 */
export async function getHodDashboard(req, res) {
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
