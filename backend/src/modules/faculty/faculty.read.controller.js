// FILE: src/modules/faculty/faculty.read.controller.js
import { MentorAssignment } from './models/MentorAssignment.js';
import { Application } from '../student/models/Application.js';
import { StudentProfile } from '../student/models/StudentProfile.js';
import { ProgressLog } from '../student/models/ProgressLog.js';
import { Internship } from '../company/models/Internship.js';
import { CompanyProfile } from '../company/models/CompanyProfile.js';
import { User } from '../auth/models/User.js';
import { getLiveRiskForApplications } from '../risk/services/risk.service.js';
import { MENTOR_ASSIGNMENT_STATUS, APPLICATION_STATUS } from '../../utils/constants.js';

/**
 * GET /api/v1/faculty/assigned-students
 *
 * Returns all students assigned to this faculty mentor with live risk.
 * MentorAssignment.facultyId holds the faculty User._id.
 */
export async function getAssignedStudents(req, res) {
  try {
    const assignments = await MentorAssignment.find({
      facultyId: req.user.userId,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
    }).lean();

    if (assignments.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const applicationIds = assignments.map((a) => a.applicationId);

    // Batch-fetch related data
    const [applications, riskResults] = await Promise.all([
      Application.find({ _id: { $in: applicationIds } }).lean(),
      getLiveRiskForApplications(applicationIds),
    ]);

    const appMap = new Map(applications.map((a) => [a._id.toString(), a]));
    const riskMap = new Map(riskResults.map((r) => [r.applicationId.toString(), r]));

    // Fetch student profiles and internships in one pass each
    const studentIds = applications.map((a) => a.studentId);
    const internshipIds = applications.map((a) => a.internshipId);

    const [profiles, internships] = await Promise.all([
      StudentProfile.find({ _id: { $in: studentIds } }).lean(),
      Internship.find({ _id: { $in: internshipIds } }).lean(),
    ]);

    const profileMap = new Map(profiles.map((p) => [p._id.toString(), p]));
    const internshipMap = new Map(internships.map((i) => [i._id.toString(), i]));

    // Get company names
    const companyProfileIds = internships.map((i) => i.companyId);
    const companyProfiles = await CompanyProfile.find(
      { _id: { $in: companyProfileIds } },
    ).lean();
    const companyMap = new Map(companyProfiles.map((c) => [c._id.toString(), c.companyName]));

    // Get student user names
    const userIds = profiles.map((p) => p.userId);
    const users = await User.find({ _id: { $in: userIds } }, { name: 1 }).lean();
    const userNameMap = new Map(users.map((u) => [u._id.toString(), u.name]));

    const data = assignments.map((assignment) => {
      const app = appMap.get(assignment.applicationId.toString());
      if (!app) return null;
      const profile = profileMap.get(app.studentId.toString()) ?? {};
      const internship = internshipMap.get(app.internshipId.toString()) ?? {};
      const risk = riskMap.get(app._id.toString()) ?? {};
      const studentName = userNameMap.get(profile.userId?.toString()) ?? null;
      const companyName = companyMap.get(internship.companyId?.toString()) ?? null;

      return {
        applicationId: app._id,
        studentName,
        studentDept: profile.department ?? null,
        internshipTitle: internship.title ?? null,
        companyName,
        currentStatus: app.currentStatus,
        riskLevel: risk.riskLevel ?? 'low',
        riskSignals: risk.signals ?? [],
        riskSuppressed: risk.suppressed ?? false,
      };
    }).filter(Boolean);

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/faculty/applications/:applicationId/progress
 *
 * Returns all progress logs for one assigned student's application.
 * Faculty must be the accepted assigned mentor for this application.
 */
export async function getStudentProgress(req, res) {
  try {
    // Verify faculty owns this assignment
    const assignment = await MentorAssignment.findOne({
      applicationId: req.params.applicationId,
      facultyId: req.user.userId,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
    }).lean();

    if (!assignment) {
      return res.status(403).json({
        error: 'Access denied: you are not the assigned mentor for this application',
      });
    }

    const logs = await ProgressLog.find(
      { applicationId: req.params.applicationId },
    ).sort({ createdAt: 1 }).lean();

    return res.status(200).json({ success: true, data: logs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/faculty/whats-next
 *
 * Action prompt for the faculty home screen.
 */
export async function getFacultyWhatsNext(req, res) {
  try {
    const assignments = await MentorAssignment.find({
      facultyId: req.user.userId,
      status: MENTOR_ASSIGNMENT_STATUS.ACCEPTED,
    }).lean();

    const applicationIds = assignments.map((a) => a.applicationId);

    // Pending assignment requests for this faculty
    const pendingAssignments = await MentorAssignment.countDocuments({
      facultyId: req.user.userId,
      status: MENTOR_ASSIGNMENT_STATUS.PENDING,
    });

    let atRiskCount = 0;
    let pendingVerificationCount = 0;

    if (applicationIds.length > 0) {
      const [riskResults, unverifiedLogs] = await Promise.all([
        getLiveRiskForApplications(applicationIds),
        ProgressLog.countDocuments({
          applicationId: { $in: applicationIds },
          verified: false,
        }),
      ]);

      atRiskCount = riskResults.filter(
        (r) => !r.suppressed && (r.riskLevel === 'high' || r.riskLevel === 'medium'),
      ).length;
      pendingVerificationCount = unverifiedLogs;
    }

    let action;
    if (atRiskCount > 0) {
      action = `${atRiskCount} assigned student(s) are at risk. Review their progress logs.`;
    } else if (pendingAssignments > 0) {
      action = `${pendingAssignments} pending mentor assignment request(s) awaiting your acceptance.`;
    } else if (pendingVerificationCount > 0) {
      action = `${pendingVerificationCount} progress log(s) pending your verification.`;
    } else {
      action = 'All caught up! No urgent actions at this time.';
    }

    return res.status(200).json({
      success: true,
      data: {
        action,
        counts: { atRisk: atRiskCount, pendingVerification: pendingVerificationCount, pendingAssignments },
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
