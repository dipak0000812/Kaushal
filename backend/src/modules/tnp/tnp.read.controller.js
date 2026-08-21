// FILE: src/modules/tnp/tnp.read.controller.js
import { Application } from '../student/models/Application.js';
import { StudentProfile } from '../student/models/StudentProfile.js';
import { Internship } from '../company/models/Internship.js';
import { CompanyProfile } from '../company/models/CompanyProfile.js';
import { User } from '../auth/models/User.js';
import { getTnpAlerts } from '../analytics/analytics.service.js';
import { APPLICATION_STATUS } from '../../utils/constants.js';

/**
 * GET /api/v1/tnp/verification-queue
 *
 * All offered applications awaiting student acceptance (status: offered),
 * sorted oldest first (most urgent).
 * API Contract §1 T&P: /tnp/applications/:id/verify-offer — valid from accepted.
 * Note: this queue shows offers so T&P can track what's coming.
 */
export async function getVerificationQueue(req, res) {
  try {
    // T&P verifies offers that are in 'accepted' state (student accepted, T&P next)
    const applications = await Application.find(
      { currentStatus: APPLICATION_STATUS.ACCEPTED },
    ).sort({ createdAt: 1 }).lean();

    if (applications.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const studentIds = applications.map((a) => a.studentId);
    const internshipIds = applications.map((a) => a.internshipId);

    const [profiles, internships] = await Promise.all([
      StudentProfile.find({ _id: { $in: studentIds } }).lean(),
      Internship.find({ _id: { $in: internshipIds } }).lean(),
    ]);

    const profileMap = new Map(profiles.map((p) => [p._id.toString(), p]));
    const internshipMap = new Map(internships.map((i) => [i._id.toString(), i]));

    // Get student names and company names
    const userIds = profiles.map((p) => p.userId);
    const companyIds = internships.map((i) => i.companyId);

    const [users, companyProfiles] = await Promise.all([
      User.find({ _id: { $in: userIds } }, { name: 1 }).lean(),
      CompanyProfile.find({ _id: { $in: companyIds } }, { companyName: 1 }).lean(),
    ]);

    const userNameMap = new Map(users.map((u) => [u._id.toString(), u.name]));
    const companyNameMap = new Map(companyProfiles.map((c) => [c._id.toString(), c.companyName]));

    const data = applications.map((app) => {
      const profile = profileMap.get(app.studentId.toString()) ?? {};
      const internship = internshipMap.get(app.internshipId.toString()) ?? {};
      const studentName = userNameMap.get(profile.userId?.toString()) ?? null;
      const companyName = companyNameMap.get(internship.companyId?.toString()) ?? null;

      // offeredAt: find the 'offered' → 'accepted' transition in the timeline
      const offeredEntry = (app.timeline ?? []).find((t) => t.toStatus === APPLICATION_STATUS.OFFERED);

      return {
        applicationId: app._id,
        studentName,
        internshipTitle: internship.title ?? null,
        companyName,
        offeredAt: offeredEntry?.at ?? null,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/tnp/unassigned-queue
 *
 * Applications in tnpVerified with no active mentor assignment.
 * API Contract §1 T&P: /tnp/assignments/unassigned
 */
export async function getUnassignedQueue(req, res) {
  try {
    const applications = await Application.find(
      { currentStatus: APPLICATION_STATUS.TNP_VERIFIED },
    ).sort({ createdAt: 1 }).lean();

    if (applications.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const studentIds = applications.map((a) => a.studentId);
    const internshipIds = applications.map((a) => a.internshipId);

    const [profiles, internships] = await Promise.all([
      StudentProfile.find({ _id: { $in: studentIds } }).lean(),
      Internship.find({ _id: { $in: internshipIds } }).lean(),
    ]);

    const profileMap = new Map(profiles.map((p) => [p._id.toString(), p]));
    const internshipMap = new Map(internships.map((i) => [i._id.toString(), i]));

    const userIds = profiles.map((p) => p.userId);
    const companyIds = internships.map((i) => i.companyId);

    const [users, companyProfiles] = await Promise.all([
      User.find({ _id: { $in: userIds } }, { name: 1 }).lean(),
      CompanyProfile.find({ _id: { $in: companyIds } }, { companyName: 1 }).lean(),
    ]);

    const userNameMap = new Map(users.map((u) => [u._id.toString(), u.name]));
    const companyNameMap = new Map(companyProfiles.map((c) => [c._id.toString(), c.companyName]));

    const data = applications.map((app) => {
      const profile = profileMap.get(app.studentId.toString()) ?? {};
      const internship = internshipMap.get(app.internshipId.toString()) ?? {};
      const studentName = userNameMap.get(profile.userId?.toString()) ?? null;
      const companyName = companyNameMap.get(internship.companyId?.toString()) ?? null;

      return {
        applicationId: app._id,
        studentName,
        studentDept: profile.department ?? null,
        internshipTitle: internship.title ?? null,
        companyName,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/tnp/whats-next
 *
 * Formats the most urgent alert into an action string.
 */
export async function getTnpWhatsNext(req, res) {
  try {
    const alerts = await getTnpAlerts();

    const alertList = [
      { key: 'pendingOfferVerification', label: 'offer(s) awaiting T&P verification', count: alerts.pendingOfferVerification },
      { key: 'unassignedMentorCount', label: 'student(s) in tnpVerified with no assigned mentor', count: alerts.unassignedMentorCount },
      { key: 'atRiskCount', label: 'at-risk student(s) requiring attention', count: alerts.atRiskCount },
      { key: 'zeroEligibleApplicants', label: 'open posting(s) with zero eligible applicants', count: alerts.zeroEligibleApplicants },
    ];

    const urgent = alertList.find((a) => a.count > 0);
    const action = urgent
      ? `${urgent.count} ${urgent.label}.`
      : 'No urgent actions — all queues are clear.';

    return res.status(200).json({
      success: true,
      data: { action, alerts: alertList },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/tnp/students
 *
 * All students across all departments.
 * API Contract: T&P has full visibility (role matrix §3).
 */
export async function getAllStudents(req, res) {
  try {
    const profiles = await StudentProfile.find({}).lean();

    if (profiles.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const userIds = profiles.map((p) => p.userId);
    const users = await User.find(
      { _id: { $in: userIds } },
      { name: 1, email: 1 },
    ).lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const data = profiles.map((p) => {
      const user = userMap.get(p.userId.toString()) ?? {};
      return {
        profileId: p._id,
        userId: p.userId,
        name: user.name ?? null,
        email: user.email ?? null,
        department: p.department,
        year: p.year,
        cgpa: p.cgpa,
        activeBacklogs: p.activeBacklogs,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/tnp/internships
 *
 * All internships across all companies.
 */
export async function getAllInternships(req, res) {
  try {
    const internships = await Internship.find({}).lean();

    if (internships.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const companyIds = internships.map((i) => i.companyId);
    const companyProfiles = await CompanyProfile.find(
      { _id: { $in: companyIds } },
      { companyName: 1 },
    ).lean();
    const companyNameMap = new Map(companyProfiles.map((c) => [c._id.toString(), c.companyName]));

    const internshipIds = internships.map((i) => i._id);
    const applicationCounts = await Application.aggregate([
      { $match: { internshipId: { $in: internshipIds } } },
      { $group: { _id: '$internshipId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(applicationCounts.map((r) => [r._id.toString(), r.count]));

    const data = internships.map((i) => ({
      ...i,
      companyName: companyNameMap.get(i.companyId.toString()) ?? null,
      applicationCount: countMap.get(i._id.toString()) ?? 0,
    }));

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
