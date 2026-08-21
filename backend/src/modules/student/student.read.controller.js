// FILE: src/modules/student/student.read.controller.js
import { Internship } from '../company/models/Internship.js';
import { Application } from './models/Application.js';
import { StudentProfile } from './models/StudentProfile.js';
import { CompanyProfile } from '../company/models/CompanyProfile.js';
import { evaluate } from '../eligibility/eligibilityEngine.js';
import { INTERNSHIP_STATUS, APPLICATION_STATUS } from '../../utils/constants.js';

/**
 * GET /api/v1/student/internships
 *
 * Lists all open internships with live eligibility badge.
 * Eligible internships are sorted first.
 * API Contract §1 student: "list open internships + live-computed eligibility.eligible badge"
 */
export async function getInternships(req, res) {
  try {
    const [internships, studentProfile] = await Promise.all([
      Internship.find({ status: INTERNSHIP_STATUS.OPEN }).lean(),
      StudentProfile.findOne({ userId: req.user.userId }).lean(),
    ]);

    const withEligibility = internships.map((internship) => {
      const eligibility = evaluate(studentProfile, internship.criteria);
      return {
        ...internship,
        eligibility: { eligible: eligibility.eligible, checks: eligibility.checks },
      };
    });

    // Sort: eligible first, then ineligible
    withEligibility.sort((a, b) => {
      if (a.eligibility.eligible === b.eligibility.eligible) return 0;
      return a.eligibility.eligible ? -1 : 1;
    });

    return res.status(200).json({ success: true, data: withEligibility });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/student/internships/:id
 *
 * Full per-criterion eligibility breakdown for one internship.
 * API Contract §1 student: "full per-criterion breakdown, live-computed, not stored"
 */
export async function getInternshipById(req, res) {
  try {
    const [internship, studentProfile] = await Promise.all([
      Internship.findById(req.params.id).lean(),
      StudentProfile.findOne({ userId: req.user.userId }).lean(),
    ]);

    if (!internship) {
      return res.status(404).json({ error: 'Internship not found' });
    }

    const eligibility = evaluate(studentProfile, internship.criteria);

    return res.status(200).json({
      success: true,
      data: {
        internship,
        eligibility: {
          eligible: eligibility.eligible,
          checks: eligibility.checks,
          computedAt: eligibility.computedAt,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/student/applications
 *
 * Returns all of this student's applications with full timeline.
 * API Contract §1 student: own applications, paginated, ?status= filter
 */
export async function getMyApplications(req, res) {
  try {
    const studentProfile = await StudentProfile.findOne({ userId: req.user.userId }).lean();
    const studentIds = [req.user.userId];
    if (studentProfile) {
      studentIds.push(studentProfile._id);
    }

    const filter = { studentId: { $in: studentIds } };
    if (req.query.status) {
      filter.currentStatus = req.query.status;
    }

    const applications = await Application.find(filter)
      .populate('internshipId', 'title companyId')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, data: applications });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/v1/student/whats-next
 *
 * Deterministic action prompt for the student home screen.
 * Priority: offers waiting > applications in progress > eligible postings.
 */
export async function getWhatsNext(req, res) {
  try {
    const studentProfile = await StudentProfile.findOne(
      { userId: req.user.userId },
    ).lean();

    const studentIds = [req.user.userId];
    if (studentProfile) {
      studentIds.push(studentProfile._id);
    }

    const [internships, myApplications] = await Promise.all([
      Internship.find({ status: INTERNSHIP_STATUS.OPEN }).lean(),
      Application.find({ studentId: { $in: studentIds } }).lean(),
    ]);

    // Count offers waiting for the student's accept/decline
    const offeredCount = myApplications.filter(
      (a) => a.currentStatus === APPLICATION_STATUS.OFFERED,
    ).length;

    // Count applications in progress (applied = waiting for company response)
    const appliedCount = myApplications.filter(
      (a) => a.currentStatus === APPLICATION_STATUS.APPLIED,
    ).length;

    // Count eligible open internships and find best match by skill overlap
    let eligibleCount = 0;
    let bestMatchTitle = '';
    let bestOverlap = -1;
    const studentSkills = studentProfile?.skills ?? [];

    for (const internship of internships) {
      const eligibility = evaluate(studentProfile, internship.criteria);
      if (eligibility.eligible) {
        eligibleCount++;
        const requiredSkills = internship.criteria?.requiredSkills ?? [];
        const overlap = requiredSkills.filter((s) => studentSkills.includes(s)).length;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestMatchTitle = internship.title;
        }
      }
    }

    let action;
    if (offeredCount > 0) {
      action = `You have ${offeredCount} offer(s) waiting for your response`;
    } else if (appliedCount > 0) {
      action = `${appliedCount} application(s) in progress. Keep submitting weekly logs.`;
    } else if (eligibleCount > 0) {
      action = `You are eligible for ${eligibleCount} internship(s). Best match: ${bestMatchTitle}`;
    } else {
      action = 'No open internships match your profile right now. Check back soon.';
    }

    return res.status(200).json({
      success: true,
      data: {
        action,
        counts: { eligible: eligibleCount, applied: appliedCount, offered: offeredCount },
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
