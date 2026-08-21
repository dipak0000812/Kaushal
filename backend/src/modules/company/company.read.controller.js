// FILE: src/modules/company/company.read.controller.js
import { Internship } from './models/Internship.js';
import { Application } from '../student/models/Application.js';
import { StudentProfile } from '../student/models/StudentProfile.js';
import { CompanyProfile } from './models/CompanyProfile.js';
import { APPLICATION_STATUS, ACTIVE_STATUSES } from '../../utils/constants.js';

/**
 * GET /api/v1/company/internships
 *
 * Returns all internships owned by this company with vacancy and application counts.
 * Scope enforced via companyId === req.user.userId (Architecture.md invariant #7).
 */
export async function getMyInternships(req, res) {
  try {
    // companyId on Internship refs CompanyProfile._id — look up the profile first
    const companyProfile = await CompanyProfile.findOne(
      { userId: req.user.userId },
    ).lean();

    if (!companyProfile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    const internships = await Internship.find(
      { companyId: companyProfile._id },
    ).lean();

    if (internships.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const internshipIds = internships.map((i) => i._id);

    // Count active applications per internship in one query
    const applicationCounts = await Application.aggregate([
      { $match: { internshipId: { $in: internshipIds } } },
      { $group: { _id: '$internshipId', total: { $sum: 1 } } },
    ]);

    const countMap = new Map(applicationCounts.map((r) => [r._id.toString(), r.total]));

    const data = internships.map((i) => ({
      ...i,
      applicationCount: countMap.get(i._id.toString()) ?? 0,
    }));

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/company/internships/:id/applicants
 *
 * Returns tiered applicant list — privacy controlled by pipeline stage.
 * API Contract §1 company applicants:
 *   pre-shortlist (applied): applicationId, eligible, stage — NO skills, cgpa, name, resume
 *   post-shortlist (shortlisted+): adds matchedSkills, resumeUrl, name — still NO raw cgpa/backlogs
 *
 * Effective eligibility = override?.eligible ?? eligibilitySnapshot.eligible
 */
export async function getApplicants(req, res) {
  try {
    const companyProfile = await CompanyProfile.findOne(
      { userId: req.user.userId },
    ).lean();

    if (!companyProfile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    const internship = await Internship.findById(req.params.id).lean();

    if (!internship) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    if (internship.companyId.toString() !== companyProfile._id.toString()) {
      return res.status(403).json({ error: 'Access denied: internship does not belong to your company' });
    }

    const applications = await Application.find(
      { internshipId: internship._id },
    ).lean();

    // Post-shortlist statuses: anything beyond 'applied'
    const postShortlistStatuses = new Set([
      APPLICATION_STATUS.SHORTLISTED,
      APPLICATION_STATUS.OFFERED,
      APPLICATION_STATUS.ACCEPTED,
      APPLICATION_STATUS.TNP_VERIFIED,
      APPLICATION_STATUS.MENTOR_PENDING,
      APPLICATION_STATUS.MENTOR_ASSIGNED,
      APPLICATION_STATUS.IN_PROGRESS,
      APPLICATION_STATUS.COMPLETED,
    ]);

    // Batch fetch student profiles for post-shortlist apps only
    const postShortlistAppIds = applications
      .filter((a) => postShortlistStatuses.has(a.currentStatus))
      .map((a) => a.studentId);

    let profileMap = new Map();
    if (postShortlistAppIds.length > 0) {
      const profiles = await StudentProfile.find(
        { _id: { $in: postShortlistAppIds } },
        { skills: 1, resumeUrl: 1, userId: 1 },
      ).lean();

      // Also get user names
      const { User } = await import('../auth/models/User.js');
      const userIds = profiles.map((p) => p.userId);
      const users = await User.find(
        { _id: { $in: userIds } },
        { name: 1 },
      ).lean();
      const userNameMap = new Map(users.map((u) => [u._id.toString(), u.name]));

      for (const p of profiles) {
        profileMap.set(p._id.toString(), {
          skills: p.skills ?? [],
          resumeUrl: p.resumeUrl ?? null,
          name: userNameMap.get(p.userId.toString()) ?? null,
        });
      }
    }

    const requiredSkills = internship.criteria?.requiredSkills ?? [];

    const data = applications.map((app) => {
      const effectiveEligible = app.override?.eligible ?? app.eligibilitySnapshot?.eligible ?? false;
      const stage = app.currentStatus;

      if (!postShortlistStatuses.has(stage)) {
        // Pre-shortlist tier: minimal info only
        return {
          applicationId: app._id,
          eligible: effectiveEligible,
          stage,
        };
      }

      // Post-shortlist tier: adds skills, resume, name
      const profile = profileMap.get(app.studentId.toString()) ?? {};
      const matchedSkills = requiredSkills.filter((s) =>
        (profile.skills ?? []).includes(s),
      );

      return {
        applicationId: app._id,
        eligible: effectiveEligible,
        stage,
        matchedSkills,
        resumeUrl: profile.resumeUrl ?? null,
        name: profile.name ?? null,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/company/whats-next
 *
 * One-line action prompt for the company home screen.
 */
export async function getCompanyWhatsNext(req, res) {
  try {
    const companyProfile = await CompanyProfile.findOne(
      { userId: req.user.userId },
    ).lean();

    if (!companyProfile) {
      return res.status(200).json({ success: true, data: { action: 'Set up your company profile to get started.' } });
    }

    const internships = await Internship.find(
      { companyId: companyProfile._id },
      { _id: 1 },
    ).lean();
    const internshipIds = internships.map((i) => i._id);

    if (internshipIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: { action: 'Post your first internship to start receiving applications.' },
      });
    }

    const [awaitingShortlist, pendingVerification] = await Promise.all([
      Application.countDocuments({
        internshipId: { $in: internshipIds },
        currentStatus: APPLICATION_STATUS.APPLIED,
      }),
      Application.countDocuments({
        internshipId: { $in: internshipIds },
        currentStatus: APPLICATION_STATUS.ACCEPTED,
      }),
    ]);

    let action;
    if (awaitingShortlist > 0) {
      action = `${awaitingShortlist} application(s) awaiting your shortlist decision.`;
    } else if (pendingVerification > 0) {
      action = `${pendingVerification} offer(s) pending T&P verification.`;
    } else {
      action = 'All caught up! No pending actions at this time.';
    }

    return res.status(200).json({ success: true, data: { action } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/company/analytics
 *
 * Aggregate pipeline stats for this company's postings.
 */
export async function getCompanyAnalytics(req, res) {
  try {
    const companyProfile = await CompanyProfile.findOne(
      { userId: req.user.userId },
    ).lean();

    if (!companyProfile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    const internships = await Internship.find(
      { companyId: companyProfile._id },
      { _id: 1 },
    ).lean();

    const internshipIds = internships.map((i) => i._id);

    if (internshipIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          applicantCount: 0,
          eligiblePct: 0,
          shortlistPct: 0,
          completionRate: 0,
          ppoCount: 0,
        },
      });
    }

    const [result] = await Application.aggregate([
      { $match: { internshipId: { $in: internshipIds } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          eligible: {
            $sum: {
              $cond: [
                { $ifNull: ['$override.eligible', '$eligibilitySnapshot.eligible'] },
                1,
                0,
              ],
            },
          },
          shortlisted: {
            $sum: {
              $cond: [
                { $in: ['$currentStatus', [APPLICATION_STATUS.SHORTLISTED, APPLICATION_STATUS.OFFERED, APPLICATION_STATUS.ACCEPTED, APPLICATION_STATUS.TNP_VERIFIED, APPLICATION_STATUS.MENTOR_PENDING, APPLICATION_STATUS.MENTOR_ASSIGNED, APPLICATION_STATUS.IN_PROGRESS, APPLICATION_STATUS.COMPLETED]] },
                1,
                0,
              ],
            },
          },
          completed: {
            $sum: { $cond: [{ $eq: ['$currentStatus', APPLICATION_STATUS.COMPLETED] }, 1, 0] },
          },
          ppo: {
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
    ]);

    if (!result) {
      return res.status(200).json({
        success: true,
        data: {
          applicantCount: 0,
          eligiblePct: 0,
          shortlistPct: 0,
          completionRate: 0,
          ppoCount: 0,
        },
      });
    }

    const safePct = (n, d) => (d > 0 ? Math.round((n / d) * 100 * 100) / 100 : 0);

    return res.status(200).json({
      success: true,
      data: {
        applicantCount: result.total,
        eligiblePct: safePct(result.eligible, result.total),
        shortlistPct: safePct(result.shortlisted, result.total),
        completionRate: safePct(result.completed, result.total),
        ppoCount: result.ppo,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
