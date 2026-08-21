import mongoose from 'mongoose';
import {
  ROLES,
  INTERNSHIP_STATUS,
  INTERNSHIP_SOURCE,
  OFF_CAMPUS_VERIFICATION_STATUS,
  APPLICATION_STATUS,
  INTERNSHIP_MODE,
} from '../../../utils/constants.js';
import { Internship } from '../../company/models/Internship.js';
import { StudentProfile } from '../models/StudentProfile.js';
import { Application } from '../models/Application.js';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from '../../../core/errors.js';

/**
 * Submits an off-campus internship opportunity for institutional verification.
 * Does NOT create an Application yet (student is registering an already-secured opportunity).
 *
 * @param {string} studentUserId - ID of the submitting student user
 * @param {object} payload - opportunity details
 * @returns {Promise<object>} created Internship document
 */
export async function submitOffCampusOpportunity(studentUserId, payload) {
  if (!studentUserId) {
    throw new ValidationError('Student user ID is required');
  }

  const studentProfile = await StudentProfile.findOne({ userId: studentUserId });
  if (!studentProfile) {
    throw new NotFoundError('Student profile not found. Please complete your profile first.');
  }

  const {
    companyName,
    title,
    description,
    duration,
    mode,
    stipend = 0,
    evidenceUrl = null,
  } = payload || {};

  if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
    throw new ValidationError('Company name is required');
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new ValidationError('Internship title is required');
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    throw new ValidationError('Description is required');
  }
  if (!duration || typeof duration !== 'string' || !duration.trim()) {
    throw new ValidationError('Duration is required');
  }
  if (!mode || !Object.values(INTERNSHIP_MODE).includes(mode)) {
    throw new ValidationError(
      `Mode is required and must be one of: ${Object.values(INTERNSHIP_MODE).join(', ')}`,
    );
  }

  // Prevent duplicate active/pending submissions for the same student, company, and title
  const existing = await Internship.findOne({
    source: INTERNSHIP_SOURCE.OFF_CAMPUS,
    'offCampusVerification.submittedBy': studentProfile._id,
    externalCompanyName: companyName.trim(),
    title: title.trim(),
    'offCampusVerification.status': {
      $in: [OFF_CAMPUS_VERIFICATION_STATUS.PENDING, OFF_CAMPUS_VERIFICATION_STATUS.VERIFIED],
    },
  });

  if (existing) {
    throw new ConflictError(
      'An off-campus opportunity with this title and company name is already registered or pending verification',
    );
  }

  const internship = await Internship.create({
    source: INTERNSHIP_SOURCE.OFF_CAMPUS,
    companyId: null,
    externalCompanyName: companyName.trim(),
    title: title.trim(),
    description: description.trim(),
    duration: duration.trim(),
    mode,
    stipend: Number(stipend) >= 0 ? Number(stipend) : 0,
    vacancies: 1,
    lastDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default 1-year window
    status: INTERNSHIP_STATUS.PENDING_APPROVAL,
    offCampusVerification: {
      status: OFF_CAMPUS_VERIFICATION_STATUS.PENDING,
      submittedBy: studentProfile._id,
      submittedAt: new Date(),
      evidenceUrl: evidenceUrl ? String(evidenceUrl).trim() : null,
      verifiedBy: null,
      verifiedAt: null,
      rejectionReason: null,
    },
  });

  return internship;
}

/**
 * Returns all off-campus opportunities submitted by the student, along with
 * any downstream Application details if verified.
 *
 * @param {string} studentUserId
 * @returns {Promise<Array>}
 */
export async function getStudentOffCampusOpportunities(studentUserId) {
  const studentProfile = await StudentProfile.findOne({ userId: studentUserId });
  if (!studentProfile) {
    throw new NotFoundError('Student profile not found');
  }

  const internships = await Internship.find({
    source: INTERNSHIP_SOURCE.OFF_CAMPUS,
    'offCampusVerification.submittedBy': studentProfile._id,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (internships.length === 0) {
    return [];
  }

  const internshipIds = internships.map((i) => i._id);
  const applications = await Application.find({
    studentId: studentProfile._id,
    internshipId: { $in: internshipIds },
  }).lean();

  const appMap = new Map(applications.map((a) => [a.internshipId.toString(), a]));

  return internships.map((internship) => {
    const app = appMap.get(internship._id.toString()) || null;
    return {
      ...internship,
      application: app
        ? {
            _id: app._id,
            currentStatus: app.currentStatus,
            ppoOffered: app.ppoOffered,
            createdAt: app.createdAt,
          }
        : null,
    };
  });
}

/**
 * Returns the T&P verification queue of pending off-campus opportunities.
 *
 * @returns {Promise<Array>}
 */
export async function getOffCampusVerificationQueue() {
  const pending = await Internship.find({
    source: INTERNSHIP_SOURCE.OFF_CAMPUS,
    'offCampusVerification.status': OFF_CAMPUS_VERIFICATION_STATUS.PENDING,
  })
    .populate({
      path: 'offCampusVerification.submittedBy',
      populate: {
        path: 'userId',
        select: 'name email department',
      },
    })
    .sort({ 'offCampusVerification.submittedAt': 1 })
    .lean();

  return pending.map((item) => {
    const studentProfile = item.offCampusVerification?.submittedBy || {};
    const user = studentProfile.userId || {};

    return {
      internshipId: item._id,
      title: item.title,
      companyName: item.externalCompanyName,
      description: item.description,
      duration: item.duration,
      mode: item.mode,
      stipend: item.stipend,
      evidenceUrl: item.offCampusVerification?.evidenceUrl ?? null,
      submittedAt: item.offCampusVerification?.submittedAt ?? item.createdAt,
      student: {
        profileId: studentProfile._id ?? null,
        name: user.name ?? null,
        email: user.email ?? null,
        department: studentProfile.department ?? user.department ?? null,
        year: studentProfile.year ?? null,
        cgpa: studentProfile.cgpa ?? null,
      },
    };
  });
}

/**
 * Verifies an off-campus opportunity.
 * Atomically marks the internship verified and creates an Application directly
 * in 'tnpVerified' status, converging into the standard mentor assignment and progress workflow.
 *
 * @param {string} internshipId
 * @param {{id: string, role: string}} actor
 * @returns {Promise<{internship: object, application: object}>}
 */
export async function verifyOffCampusOpportunity(internshipId, actor) {
  if (!actor || actor.role !== ROLES.TNP) {
    throw new ForbiddenError('Only Training & Placement (T&P) officers can verify off-campus opportunities');
  }

  const session = await mongoose.startSession();
  let verifiedInternship;
  let createdApplication;

  try {
    await session.withTransaction(async () => {
      const internship = await Internship.findById(internshipId).session(session);

      if (!internship) {
        throw new NotFoundError(`Internship '${internshipId}' not found`);
      }
      if (internship.source !== INTERNSHIP_SOURCE.OFF_CAMPUS) {
        throw new ValidationError('Only off-campus opportunities can be verified through this endpoint');
      }
      if (internship.offCampusVerification?.status !== OFF_CAMPUS_VERIFICATION_STATUS.PENDING) {
        throw new ConflictError(
          `Opportunity is not pending verification (current status: ${internship.offCampusVerification?.status})`,
        );
      }

      const studentProfileId = internship.offCampusVerification.submittedBy;
      if (!studentProfileId) {
        throw new ValidationError('Opportunity is missing submitting student profile reference');
      }

      const studentProfile = await StudentProfile.findById(studentProfileId).session(session);
      const studentDept = studentProfile?.department || 'N/A';

      // Update Internship status to OPEN and verification status to VERIFIED
      internship.status = INTERNSHIP_STATUS.OPEN;
      internship.offCampusVerification.status = OFF_CAMPUS_VERIFICATION_STATUS.VERIFIED;
      internship.offCampusVerification.verifiedBy = actor.id;
      internship.offCampusVerification.verifiedAt = new Date();
      internship.offCampusVerification.rejectionReason = null;
      await internship.save({ session });

      // Create downstream Application converging directly into TNP_VERIFIED
      const [app] = await Application.create(
        [
          {
            studentId: studentProfileId,
            internshipId: internship._id,
            currentStatus: APPLICATION_STATUS.TNP_VERIFIED,
            eligibilitySnapshot: {
              eligible: true,
              checks: [
                {
                  criterion: 'DEPARTMENT',
                  required: [],
                  actual: studentDept,
                  pass: true,
                  reason: null,
                },
                {
                  criterion: 'OFF_CAMPUS_INSTITUTIONAL_VERIFICATION',
                  pass: true,
                  reason: 'Verified and approved by T&P cell',
                },
              ],
              computedAt: new Date(),
            },
            timeline: [
              {
                fromStatus: null,
                toStatus: APPLICATION_STATUS.APPLIED,
                actorId: actor.id,
                actorRole: actor.role,
                reason: 'Off-campus opportunity registered',
                at: internship.offCampusVerification.submittedAt || new Date(),
              },
              {
                fromStatus: APPLICATION_STATUS.APPLIED,
                toStatus: APPLICATION_STATUS.TNP_VERIFIED,
                actorId: actor.id,
                actorRole: actor.role,
                reason: 'Institutional verification granted by T&P',
                at: new Date(),
              },
            ],
          },
        ],
        { session },
      );

      createdApplication = app;
      verifiedInternship = internship;
    });
  } finally {
    await session.endSession();
  }

  return {
    internship: verifiedInternship,
    application: createdApplication,
  };
}

/**
 * Rejects an off-campus opportunity.
 *
 * @param {string} internshipId
 * @param {{id: string, role: string}} actor
 * @param {string} reason
 * @returns {Promise<object>} updated Internship document
 */
export async function rejectOffCampusOpportunity(internshipId, actor, reason) {
  if (!actor || actor.role !== ROLES.TNP) {
    throw new ForbiddenError('Only Training & Placement (T&P) officers can reject off-campus opportunities');
  }
  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    throw new ValidationError('Rejection reason is required');
  }

  const internship = await Internship.findById(internshipId);
  if (!internship) {
    throw new NotFoundError(`Internship '${internshipId}' not found`);
  }
  if (internship.source !== INTERNSHIP_SOURCE.OFF_CAMPUS) {
    throw new ValidationError('Only off-campus opportunities can be processed through this endpoint');
  }
  if (internship.offCampusVerification?.status !== OFF_CAMPUS_VERIFICATION_STATUS.PENDING) {
    throw new ConflictError(
      `Opportunity is not pending verification (current status: ${internship.offCampusVerification?.status})`,
    );
  }

  internship.status = INTERNSHIP_STATUS.CANCELLED;
  internship.offCampusVerification.status = OFF_CAMPUS_VERIFICATION_STATUS.REJECTED;
  internship.offCampusVerification.verifiedBy = actor.id;
  internship.offCampusVerification.verifiedAt = new Date();
  internship.offCampusVerification.rejectionReason = reason.trim();
  await internship.save();

  return internship;
}
