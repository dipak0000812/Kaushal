import { Application } from '../student/models/Application.js';
import { StudentProfile } from '../student/models/StudentProfile.js';
import { Internship } from '../company/models/Internship.js';
import { MentorAssignment } from '../faculty/models/MentorAssignment.js';
import {
  APPLICATION_STATUS,
  ACTIVE_STATUSES,
  MENTOR_ASSIGNMENT_STATUS,
} from '../../utils/constants.js';
import { getLiveRiskForApplications } from '../risk/services/risk.service.js';

/**
 * Safe percentage helper — never returns NaN or Infinity.
 * @param {number} numerator
 * @param {number} denominator
 * @returns {number} percentage 0-100, 0 when denominator is 0
 */
function safePercent(numerator, denominator) {
  if (!denominator || denominator === 0) return 0;
  return Math.round((numerator / denominator) * 100 * 100) / 100;
}

/**
 * Computes application funnel metrics across all statuses.
 *
 * Returns counts for every APPLICATION_STATUS, total submitted, and
 * stage-over-stage conversion percentages.
 * Never returns NaN or Infinity — see safePercent().
 *
 * @returns {Promise<{
 *   total: number,
 *   byStatus: Record<string, number>,
 *   funnelStages: Array<{ stage: string, count: number, conversionFromTotal: number }>
 * }>}
 */
export async function getApplicationFunnel() {
  const pipeline = [
    {
      $group: {
        _id: '$currentStatus',
        count: { $sum: 1 },
      },
    },
  ];

  const results = await Application.aggregate(pipeline);

  const byStatus = {};
  let total = 0;
  for (const { _id, count } of results) {
    byStatus[_id] = count;
    total += count;
  }

  // Ensure all statuses appear in output (even with 0)
  for (const status of Object.values(APPLICATION_STATUS)) {
    if (!(status in byStatus)) byStatus[status] = 0;
  }

  // Ordered funnel stages from the API contract lifecycle
  const funnelOrder = [
    APPLICATION_STATUS.APPLIED,
    APPLICATION_STATUS.SHORTLISTED,
    APPLICATION_STATUS.OFFERED,
    APPLICATION_STATUS.ACCEPTED,
    APPLICATION_STATUS.TNP_VERIFIED,
    APPLICATION_STATUS.MENTOR_PENDING,
    APPLICATION_STATUS.MENTOR_ASSIGNED,
    APPLICATION_STATUS.IN_PROGRESS,
    APPLICATION_STATUS.COMPLETED,
  ];

  const funnelStages = funnelOrder.map((stage) => ({
    stage,
    count: byStatus[stage] ?? 0,
    conversionFromTotal: safePercent(byStatus[stage] ?? 0, total),
  }));

  return { total, byStatus, funnelStages };
}

/**
 * Aggregates skill-gap data from eligibility snapshots stored in Applications.
 *
 * A "skill gap" is any skill listed in a DEPARTMENT check's `required` array
 * for a ProgressLog application that the student's profile was missing at snapshot time.
 * We read from the stored eligibilitySnapshot.checks rather than re-running
 * the engine, because the snapshot is the authoritative record at submission time.
 *
 * Uses the SKILLS criterion failures in stored eligibilitySnapshot.checks
 * to count how frequently each missing skill appears across all applications.
 * Results are sorted by frequency (descending), then alphabetically for determinism.
 *
 * @returns {Promise<Array<{ skill: string, missingCount: number }>>}
 */
export async function getSkillGapReport() {
  const pipeline = [
    // Unwind the checks array to get one document per eligibility check
    { $unwind: '$eligibilitySnapshot.checks' },
    // Only look at SKILLS checks that failed
    {
      $match: {
        'eligibilitySnapshot.checks.criterion': 'SKILLS',
        'eligibilitySnapshot.checks.pass': false,
      },
    },
    // Project the required skills array (the missing ones are needed — we need to
    // compute required minus actual; but the stored reason is "Missing: X, Y").
    // The most reliable source is: required - actual from the stored snapshot.
    {
      $project: {
        required: '$eligibilitySnapshot.checks.required',
        actual: '$eligibilitySnapshot.checks.actual',
      },
    },
    // Compute missing = required skills NOT in actual
    {
      $project: {
        missingSkills: {
          $filter: {
            input: '$required',
            as: 'skill',
            cond: { $not: { $in: ['$$skill', { $ifNull: ['$actual', []] }] } },
          },
        },
      },
    },
    { $unwind: '$missingSkills' },
    {
      $group: {
        _id: '$missingSkills',
        missingCount: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        skill: '$_id',
        missingCount: 1,
      },
    },
    // Deterministic ordering: by frequency desc, then alpha for ties
    {
      $sort: { missingCount: -1, skill: 1 },
    },
  ];

  return Application.aggregate(pipeline);
}

/**
 * Returns department-level analytics.
 *
 * For each department that has any student with at least one application:
 * - total applications
 * - count by status
 * - number of distinct students who applied
 * - completed / inProgress counts
 * - PPO count (applications that are completed AND ppoOffered: true)
 *
 * Uses a join between Application → StudentProfile for department attribution.
 *
 * @returns {Promise<Array<{
 *   department: string,
 *   totalApplications: number,
 *   distinctStudents: number,
 *   completed: number,
 *   inProgress: number,
 *   ppoCount: number,
 * }>>}
 */
export async function getDepartmentAnalytics() {
  const pipeline = [
    // Join StudentProfile to get department
    {
      $lookup: {
        from: 'studentprofiles',
        localField: 'studentId',
        foreignField: '_id',
        as: 'profile',
      },
    },
    { $unwind: { path: '$profile', preserveNullAndEmptyArrays: false } },
    {
      $group: {
        _id: '$profile.department',
        totalApplications: { $sum: 1 },
        distinctStudents: { $addToSet: '$studentId' },
        completed: {
          $sum: { $cond: [{ $eq: ['$currentStatus', APPLICATION_STATUS.COMPLETED] }, 1, 0] },
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$currentStatus', APPLICATION_STATUS.IN_PROGRESS] }, 1, 0] },
        },
        ppoCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$currentStatus', APPLICATION_STATUS.COMPLETED] },
                  { $eq: ['$ppoOffered', true] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        department: '$_id',
        totalApplications: 1,
        distinctStudents: { $size: '$distinctStudents' },
        completed: 1,
        inProgress: 1,
        ppoCount: 1,
      },
    },
    { $sort: { department: 1 } },
  ];

  return Application.aggregate(pipeline);
}

/**
 * Returns PPO (Pre-Placement Offer) outcome analytics.
 *
 * @returns {Promise<{
 *   totalCompleted: number,
 *   ppoOffered: number,
 *   ppoRate: number
 * }>}
 */
export async function getPpoOutcomes() {
  const pipeline = [
    {
      $match: { currentStatus: APPLICATION_STATUS.COMPLETED },
    },
    {
      $group: {
        _id: null,
        totalCompleted: { $sum: 1 },
        ppoOffered: { $sum: { $cond: ['$ppoOffered', 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        totalCompleted: 1,
        ppoOffered: 1,
      },
    },
  ];

  const [result] = await Application.aggregate(pipeline);
  if (!result) {
    return { totalCompleted: 0, ppoOffered: 0, ppoRate: 0 };
  }
  return {
    ...result,
    ppoRate: safePercent(result.ppoOffered, result.totalCompleted),
  };
}

/**
 * Returns the alerts payload required by GET /tnp/alerts.
 *
 * Three counts from the API contract:
 * 1. zeroEligibleApplicants — open postings where NO application has effective eligibility === true
 * 2. unassignedMentorCount — applications in `tnpVerified` with no active (pending|accepted) assignment
 * 3. pendingOfferVerification — applications in `accepted` status
 * 4. atRiskCount — applications currently inProgress with riskLevel high|medium (not suppressed)
 *
 * @returns {Promise<{
 *   zeroEligibleApplicants: number,
 *   unassignedMentorCount: number,
 *   pendingOfferVerification: number,
 *   atRiskCount: number
 * }>}
 */
export async function getTnpAlerts() {
  const [
    zeroEligibleResult,
    unassignedResult,
    pendingOfferCount,
    atRiskResult,
  ] = await Promise.all([
    // 1. Postings with no effectively-eligible application
    _getZeroEligiblePostingsCount(),
    // 2. tnpVerified applications with no active mentor assignment
    _getUnassignedMentorCount(),
    // 3. Count applications in 'accepted' waiting for T&P verify
    Application.countDocuments({ currentStatus: APPLICATION_STATUS.ACCEPTED }),
    // 4. at-risk count via risk service on inProgress applications
    _getAtRiskCount(),
  ]);

  return {
    zeroEligibleApplicants: zeroEligibleResult,
    unassignedMentorCount: unassignedResult,
    pendingOfferVerification: pendingOfferCount,
    atRiskCount: atRiskResult,
  };
}

async function _getZeroEligiblePostingsCount() {
  // Find open internships where no application has effective eligibility
  const openInternships = await Internship.find(
    { status: 'open' },
    { _id: 1 },
  ).lean();

  if (openInternships.length === 0) return 0;

  const internshipIds = openInternships.map((i) => i._id);

  // For each posting, check if any application with active status has eligible=true
  // Effective eligibility: override?.eligible ?? eligibilitySnapshot.eligible
  const pipeline = [
    {
      $match: {
        internshipId: { $in: internshipIds },
        currentStatus: { $in: ACTIVE_STATUSES },
      },
    },
    {
      $project: {
        internshipId: 1,
        effectiveEligible: {
          $ifNull: ['$override.eligible', '$eligibilitySnapshot.eligible'],
        },
      },
    },
    {
      $match: { effectiveEligible: true },
    },
    {
      $group: { _id: '$internshipId' },
    },
  ];

  const postingsWithEligibleApplicants = await Application.aggregate(pipeline);
  const postingsWithEligibleIds = new Set(
    postingsWithEligibleApplicants.map((r) => r._id.toString()),
  );

  const zeroEligibleCount = openInternships.filter(
    (i) => !postingsWithEligibleIds.has(i._id.toString()),
  ).length;

  return zeroEligibleCount;
}

async function _getUnassignedMentorCount() {
  // Find applications in tnpVerified
  const tnpVerifiedApps = await Application.find(
    { currentStatus: APPLICATION_STATUS.TNP_VERIFIED },
    { _id: 1 },
  ).lean();

  if (tnpVerifiedApps.length === 0) return 0;

  const appIds = tnpVerifiedApps.map((a) => a._id);

  // Find which of those have an active assignment
  const assignedAppIds = await MentorAssignment.distinct('applicationId', {
    applicationId: { $in: appIds },
    status: { $in: [MENTOR_ASSIGNMENT_STATUS.PENDING, MENTOR_ASSIGNMENT_STATUS.ACCEPTED] },
  });

  const assignedSet = new Set(assignedAppIds.map((id) => id.toString()));

  return tnpVerifiedApps.filter((a) => !assignedSet.has(a._id.toString())).length;
}

async function _getAtRiskCount() {
  const inProgressApps = await Application.find(
    { currentStatus: APPLICATION_STATUS.IN_PROGRESS },
    { _id: 1 },
  ).lean();

  if (inProgressApps.length === 0) return 0;

  const riskResults = await getLiveRiskForApplications(
    inProgressApps.map((a) => a._id),
  );

  return riskResults.filter(
    (r) => !r.suppressed && (r.riskLevel === 'high' || r.riskLevel === 'medium'),
  ).length;
}

/**
 * Returns the full dashboard payload for GET /tnp/analytics/dashboard.
 *
 * Computes and returns all dashboard analytics in one call:
 * - applicationFunnel
 * - skillGapReport
 * - departmentStats
 * - ppoOutcomes
 * - companyStats (open posting counts by company)
 *
 * @returns {Promise<{
 *   applicationFunnel: object,
 *   skillGapReport: Array,
 *   departmentStats: Array,
 *   ppoOutcomes: object,
 *   companyStats: Array
 * }>}
 */
export async function getTnpDashboard() {
  const [applicationFunnel, skillGapReport, departmentStats, ppoOutcomes, companyStats] =
    await Promise.all([
      getApplicationFunnel(),
      getSkillGapReport(),
      getDepartmentAnalytics(),
      getPpoOutcomes(),
      getCompanyStats(),
    ]);

  return {
    applicationFunnel,
    skillGapReport,
    departmentStats,
    ppoOutcomes,
    companyStats,
  };
}

/**
 * Returns company-level posting and application statistics.
 *
 * For each company with at least one internship:
 * - total postings
 * - open / closed / pendingApproval counts
 * - total applications across their postings
 *
 * @returns {Promise<Array<{
 *   companyId: string,
 *   companyName: string,
 *   totalPostings: number,
 *   open: number,
 *   closed: number,
 *   pendingApproval: number,
 *   totalApplications: number
 * }>>}
 */
export async function getCompanyStats() {
  const pipeline = [
    {
      $group: {
        _id: '$companyId',
        totalPostings: { $sum: 1 },
        open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
        closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
        pendingApproval: { $sum: { $cond: [{ $eq: ['$status', 'pendingApproval'] }, 1, 0] } },
        internshipIds: { $push: '$_id' },
      },
    },
    {
      $lookup: {
        from: 'companyprofiles',
        localField: '_id',
        foreignField: '_id',
        as: 'company',
      },
    },
    { $unwind: { path: '$company', preserveNullAndEmptyArrays: false } },
    // Count applications across these postings
    {
      $lookup: {
        from: 'applications',
        let: { ids: '$internshipIds' },
        pipeline: [
          { $match: { $expr: { $in: ['$internshipId', '$$ids'] } } },
          { $count: 'total' },
        ],
        as: 'appCount',
      },
    },
    {
      $project: {
        _id: 0,
        companyId: '$_id',
        companyName: '$company.companyName',
        totalPostings: 1,
        open: 1,
        closed: 1,
        pendingApproval: 1,
        totalApplications: { $ifNull: [{ $arrayElemAt: ['$appCount.total', 0] }, 0] },
      },
    },
    { $sort: { companyName: 1 } },
  ];

  return Internship.aggregate(pipeline);
}

/**
 * Returns HOD department-scoped analytics.
 *
 * Scoped to one department (derived from req.user in the controller — never
 * accepted as a user-controlled param, per Architecture.md invariant #7).
 *
 * @param {string} department - the HOD's department (from req.user)
 * @returns {Promise<{
 *   department: string,
 *   totalStudents: number,
 *   activeApplications: number,
 *   completed: number,
 *   inProgress: number,
 *   atRiskCount: number,
 *   ppoCount: number
 * }>}
 */
export async function getHodDepartmentDashboard(department) {
  if (!department) {
    throw Object.assign(new Error('Department is required'), { code: 'VALIDATION_ERROR', status: 400 });
  }

  // All student profiles in this department
  const profiles = await StudentProfile.find({ department }, { _id: 1 }).lean();
  const profileIds = profiles.map((p) => p._id);
  const totalStudents = profileIds.length;

  if (totalStudents === 0) {
    return {
      department,
      totalStudents: 0,
      activeApplications: 0,
      completed: 0,
      inProgress: 0,
      atRiskCount: 0,
      ppoCount: 0,
    };
  }

  const pipeline = [
    { $match: { studentId: { $in: profileIds } } },
    {
      $group: {
        _id: null,
        activeApplications: { $sum: { $cond: [{ $in: ['$currentStatus', ACTIVE_STATUSES] }, 1, 0] } },
        completed: {
          $sum: { $cond: [{ $eq: ['$currentStatus', APPLICATION_STATUS.COMPLETED] }, 1, 0] },
        },
        inProgress: {
          $sum: { $cond: [{ $eq: ['$currentStatus', APPLICATION_STATUS.IN_PROGRESS] }, 1, 0] },
        },
        ppoCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ['$currentStatus', APPLICATION_STATUS.COMPLETED] }, { $eq: ['$ppoOffered', true] }] },
              1,
              0,
            ],
          },
        },
      },
    },
  ];

  const [stats] = await Application.aggregate(pipeline);

  // Compute at-risk count for inProgress apps in this dept
  const inProgressApps = await Application.find(
    { studentId: { $in: profileIds }, currentStatus: APPLICATION_STATUS.IN_PROGRESS },
    { _id: 1 },
  ).lean();

  let atRiskCount = 0;
  if (inProgressApps.length > 0) {
    const riskResults = await getLiveRiskForApplications(inProgressApps.map((a) => a._id));
    atRiskCount = riskResults.filter(
      (r) => !r.suppressed && (r.riskLevel === 'high' || r.riskLevel === 'medium'),
    ).length;
  }

  return {
    department,
    totalStudents,
    activeApplications: stats?.activeApplications ?? 0,
    completed: stats?.completed ?? 0,
    inProgress: stats?.inProgress ?? 0,
    atRiskCount,
    ppoCount: stats?.ppoCount ?? 0,
  };
}
