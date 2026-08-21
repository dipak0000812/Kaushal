import { StudentProfile } from './models/StudentProfile.js';
import { Application } from './models/Application.js';
import { Internship } from '../company/models/Internship.js';
import { ProgressLog } from './models/ProgressLog.js';
import { updateStudentProfile } from '../auth/auth.service.js';
import { acceptOffer } from './services/applicationLifecycle.service.js';
import { applyTransition } from './services/applicationTransition.service.js';
import { evaluate } from '../eligibility/eligibilityEngine.js';
import {
  APPLICATION_STATUS,
  INTERNSHIP_STATUS,
  EVIDENCE_TYPE,
} from '../../utils/constants.js';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '../../core/errors.js';

/**
 * GET /api/v1/student/profile
 * Returns the authenticated student's own profile.
 */
export async function getProfile(req, res, next) {
  try {
    const profile = await StudentProfile.findOne({ userId: req.user.userId }).lean();
    if (!profile) {
      throw new NotFoundError('Student profile not found');
    }
    return res.status(200).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/student/profile
 * Updates the authenticated student's own profile.
 */
export async function updateProfile(req, res, next) {
  try {
    const updatedProfile = await updateStudentProfile(req.user.userId, req.body);
    return res.status(200).json({ success: true, data: updatedProfile });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/student/applications
 * Body: { internshipId }
 * Applies to an open internship, snapshotting eligibility at this moment.
 */
export async function applyToInternship(req, res, next) {
  try {
    const { internshipId } = req.body ?? {};
    if (!internshipId) {
      throw new ValidationError('internshipId is required');
    }

    const [internship, studentProfile] = await Promise.all([
      Internship.findById(internshipId),
      StudentProfile.findOne({ userId: req.user.userId }),
    ]);

    if (!internship) {
      throw new NotFoundError('Internship not found');
    }

    // Check if internship is open and not expired
    if (internship.status !== INTERNSHIP_STATUS.OPEN) {
      throw new ConflictError('Internship is not open for applications', 'INTERNSHIP_NOT_OPEN');
    }
    if (new Date() > new Date(internship.lastDate)) {
      // Lazy closure check
      internship.status = INTERNSHIP_STATUS.CLOSED;
      await internship.save();
      throw new ConflictError('Application deadline has passed', 'DEADLINE_PASSED');
    }

    if (!studentProfile) {
      throw new NotFoundError('Student profile not found. Please complete your profile first.');
    }

    // Check for existing active application
    const existingApp = await Application.findOne({
      studentId: studentProfile._id,
      internshipId: internship._id,
      currentStatus: { $nin: [APPLICATION_STATUS.REJECTED, APPLICATION_STATUS.WITHDRAWN, APPLICATION_STATUS.CANCELLED] },
    });
    if (existingApp) {
      throw new ConflictError('You have already applied to this internship', 'DUPLICATE_APPLICATION');
    }

    // Compute live eligibility snapshot
    const eligibility = evaluate(studentProfile.toObject ? studentProfile.toObject() : studentProfile, internship.criteria);

    const application = await Application.create({
      studentId: studentProfile._id,
      internshipId: internship._id,
      currentStatus: APPLICATION_STATUS.APPLIED,
      eligibilitySnapshot: {
        eligible: eligibility.eligible,
        checks: eligibility.checks,
        computedAt: eligibility.computedAt,
      },
      timeline: [
        {
          fromStatus: null,
          toStatus: APPLICATION_STATUS.APPLIED,
          actorId: req.user.userId,
          actorRole: req.user.role,
          reason: 'Application submitted',
          at: new Date(),
        },
      ],
    });

    return res.status(201).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/student/applications/:id/accept
 * Accepts one offer and atomically withdraws all other offers.
 */
export async function acceptOfferHandler(req, res, next) {
  try {
    const applicationId = req.params.id;
    const application = await Application.findById(applicationId);
    if (!application) {
      throw new NotFoundError('Application not found');
    }

    const studentProfile = await StudentProfile.findOne({ userId: req.user.userId });
    if (!studentProfile || application.studentId.toString() !== studentProfile._id.toString()) {
      throw new ForbiddenError('You can only accept offers for your own applications');
    }

    const actor = { id: req.user.userId, role: req.user.role };

    const result = await acceptOffer(applicationId, actor);
    return res.status(200).json({ success: true, data: result.accepted, withdrawnCount: result.withdrawnCount });
  } catch (err) {
    if (err.code === 'NOT_FOUND') err.statusCode = 404;
    if (err.code === 'INVALID_TRANSITION' || err.code === 'TRANSITION_CONFLICT') err.statusCode = 409;
    next(err);
  }
}

/**
 * PATCH /api/v1/student/applications/:id/decline
 * Declines an offer (transitions to withdrawn).
 */
export async function declineOfferHandler(req, res, next) {
  try {
    const applicationId = req.params.id;
    const application = await Application.findById(applicationId);
    if (!application) {
      throw new NotFoundError('Application not found');
    }

    const studentProfile = await StudentProfile.findOne({ userId: req.user.userId });
    if (!studentProfile || application.studentId.toString() !== studentProfile._id.toString()) {
      throw new ForbiddenError('You can only decline offers for your own applications');
    }

    const actor = { id: req.user.userId, role: req.user.role };

    const updated = await applyTransition(
      applicationId,
      APPLICATION_STATUS.WITHDRAWN,
      actor,
      'Student declined offer',
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    if (err.code === 'NOT_FOUND') err.statusCode = 404;
    if (err.code === 'INVALID_TRANSITION' || err.code === 'TRANSITION_CONFLICT') err.statusCode = 409;
    next(err);
  }
}

/**
 * POST /api/v1/student/applications/:id/progress-logs
 * Submits a weekly progress log.
 */
export async function submitProgressLog(req, res, next) {
  try {
    const applicationId = req.params.id;
    const { weekLabel, description, evidence } = req.body ?? {};

    if (!description || typeof description !== 'string' || !description.trim()) {
      throw new ValidationError('Description is required');
    }
    if (!evidence || !evidence.type || !evidence.value) {
      throw new ValidationError('Evidence type and value are required');
    }
    if (!Object.values(EVIDENCE_TYPE).includes(evidence.type)) {
      throw new ValidationError(`Invalid evidence type. Must be one of: ${Object.values(EVIDENCE_TYPE).join(', ')}`);
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      throw new NotFoundError('Application not found');
    }

    // Verify ownership
    const studentProfile = await StudentProfile.findOne({ userId: req.user.userId });
    if (!studentProfile || application.studentId.toString() !== studentProfile._id.toString()) {
      throw new ForbiddenError('You can only submit progress logs for your own applications');
    }

    // Allowed if inProgress or mentorAssigned
    if (application.currentStatus !== APPLICATION_STATUS.IN_PROGRESS && application.currentStatus !== APPLICATION_STATUS.MENTOR_ASSIGNED) {
      throw new ConflictError('Progress logs can only be submitted for active in-progress internships', 'INVALID_STATUS');
    }

    // If currently mentorAssigned, auto-transition to inProgress
    if (application.currentStatus === APPLICATION_STATUS.MENTOR_ASSIGNED) {
      await applyTransition(
        applicationId,
        APPLICATION_STATUS.IN_PROGRESS,
        { id: req.user.userId, role: req.user.role },
        'First progress log submitted — internship active',
      );
    }

    // Determine week label if not provided
    const logCount = await ProgressLog.countDocuments({ applicationId });
    const finalWeekLabel = weekLabel || `Week ${logCount + 1}`;

    const log = await ProgressLog.create({
      applicationId,
      weekLabel: finalWeekLabel,
      description: description.trim(),
      evidence: {
        type: evidence.type,
        value: String(evidence.value).trim(),
      },
      verified: false,
    });

    return res.status(201).json({ success: true, data: log });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/student/recommendations
 * Deterministic skill overlap ranking.
 */
export async function getRecommendations(req, res, next) {
  try {
    const studentProfile = await StudentProfile.findOne({ userId: req.user.userId }).lean();
    const openInternships = await Internship.find({ status: INTERNSHIP_STATUS.OPEN }).lean();

    const studentSkills = studentProfile?.skills ?? [];

    const recommendations = openInternships
      .map((internship) => {
        const requiredSkills = internship.criteria?.requiredSkills ?? [];
        const matchedSkills = requiredSkills.filter((s) => studentSkills.includes(s));
        const overlapCount = matchedSkills.length;
        const totalRequired = requiredSkills.length || 1;
        const matchPercentage = Math.round((overlapCount / totalRequired) * 100);

        return {
          ...internship,
          matchedSkills,
          matchPercentage,
          overlapCount,
        };
      })
      .sort((a, b) => b.overlapCount - a.overlapCount);

    return res.status(200).json({
      success: true,
      data: {
        method: 'deterministic-skill-overlap',
        recommendations,
      },
    });
  } catch (err) {
    next(err);
  }
}
