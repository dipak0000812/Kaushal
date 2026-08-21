import { Internship } from './models/Internship.js';
import { CompanyProfile } from './models/CompanyProfile.js';
import { Application } from '../student/models/Application.js';
import { User } from '../auth/models/User.js';
import { applyTransition } from '../student/services/applicationTransition.service.js';
import {
  APPLICATION_STATUS,
  INTERNSHIP_STATUS,
  USER_STATUS,
  INTERNSHIP_MODE,
} from '../../utils/constants.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../core/errors.js';

/**
 * POST /api/v1/company/internships
 * Company posts an internship.
 * If company is verified -> status: 'open'; if pending -> status: 'pendingApproval'.
 */
export async function postInternship(req, res, next) {
  try {
    const {
      title,
      description,
      duration,
      mode = INTERNSHIP_MODE.REMOTE,
      vacancies,
      lastDate,
      criteria = {},
    } = req.body ?? {};

    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new ValidationError('Title is required');
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      throw new ValidationError('Description is required');
    }
    if (!duration) {
      throw new ValidationError('Duration is required');
    }
    if (!vacancies || Number(vacancies) < 1) {
      throw new ValidationError('Vacancies must be at least 1');
    }
    if (!lastDate) {
      throw new ValidationError('Application deadline (lastDate) is required');
    }

    const [companyProfile, user] = await Promise.all([
      CompanyProfile.findOne({ userId: req.user.userId }),
      User.findById(req.user.userId),
    ]);

    if (!companyProfile || !user) {
      throw new NotFoundError('Company profile not found');
    }

    // Status: open if user verified, pendingApproval if pending
    const status = user.status === USER_STATUS.VERIFIED
      ? INTERNSHIP_STATUS.OPEN
      : INTERNSHIP_STATUS.PENDING_APPROVAL;

    const internship = await Internship.create({
      companyId: companyProfile._id,
      title: title.trim(),
      description: description.trim(),
      duration: typeof duration === 'number' ? `${duration} months` : String(duration),
      mode,
      vacancies: Number(vacancies),
      lastDate: new Date(lastDate),
      status,
      criteria: {
        minCgpa: Number(criteria.minCgpa) || 0,
        maxBacklogs: Number(criteria.maxBacklogs) || 0,
        departments: Array.isArray(criteria.departments)
          ? criteria.departments
          : criteria.department ? [criteria.department] : [],
        requiredSkills: Array.isArray(criteria.requiredSkills) ? criteria.requiredSkills : [],
        requiredCerts: Array.isArray(criteria.requiredCerts) ? criteria.requiredCerts : [],
      },
    });

    return res.status(201).json({ success: true, data: internship });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/company/internships/:id
 * Get single internship detail for the company.
 */
export async function getInternshipById(req, res, next) {
  try {
    const internship = await Internship.findById(req.params.id).lean();
    if (!internship) {
      throw new NotFoundError('Internship not found');
    }
    return res.status(200).json({ success: true, data: internship });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/company/internships/:id
 * Updates criteria/posting details for an internship.
 */
export async function updateInternshipCriteria(req, res, next) {
  try {
    const internship = await Internship.findById(req.params.id);
    if (!internship) {
      throw new NotFoundError('Internship not found');
    }

    const companyProfile = await CompanyProfile.findOne({ userId: req.user.userId });
    if (!companyProfile || internship.companyId.toString() !== companyProfile._id.toString()) {
      throw new ForbiddenError('You can only update your own internships');
    }

    const { title, description, duration, mode, vacancies, lastDate, criteria } = req.body ?? {};

    if (title !== undefined) internship.title = title.trim();
    if (description !== undefined) internship.description = description.trim();
    if (duration !== undefined) internship.duration = typeof duration === 'number' ? `${duration} months` : String(duration);
    if (mode !== undefined) internship.mode = mode;
    if (vacancies !== undefined) internship.vacancies = Number(vacancies);
    if (lastDate !== undefined) internship.lastDate = new Date(lastDate);
    if (criteria !== undefined) {
      internship.criteria = {
        minCgpa: criteria.minCgpa !== undefined ? Number(criteria.minCgpa) : internship.criteria.minCgpa,
        maxBacklogs: criteria.maxBacklogs !== undefined ? Number(criteria.maxBacklogs) : internship.criteria.maxBacklogs,
        departments: criteria.departments !== undefined ? criteria.departments : internship.criteria.departments,
        requiredSkills: criteria.requiredSkills !== undefined ? criteria.requiredSkills : internship.criteria.requiredSkills,
        requiredCerts: criteria.requiredCerts !== undefined ? criteria.requiredCerts : internship.criteria.requiredCerts,
      };
    }

    await internship.save();
    return res.status(200).json({ success: true, data: internship });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/company/internships/:id/close
 * Closes an internship early.
 */
export async function closeInternship(req, res, next) {
  try {
    const internship = await Internship.findById(req.params.id);
    if (!internship) {
      throw new NotFoundError('Internship not found');
    }

    const companyProfile = await CompanyProfile.findOne({ userId: req.user.userId });
    if (!companyProfile || internship.companyId.toString() !== companyProfile._id.toString()) {
      throw new ForbiddenError('You can only close your own internships');
    }

    internship.status = INTERNSHIP_STATUS.CLOSED;
    await internship.save();

    return res.status(200).json({ success: true, data: internship });
  } catch (err) {
    next(err);
  }
}

/**
 * Helper to ensure the calling company owns the internship associated with an application.
 */
async function verifyCompanyApplicationOwnership(userId, applicationId) {
  const companyProfile = await CompanyProfile.findOne({ userId });
  if (!companyProfile) {
    throw new NotFoundError('Company profile not found');
  }

  const application = await Application.findById(applicationId).populate('internshipId');
  if (!application) {
    throw new NotFoundError('Application not found');
  }

  const internshipCompanyId = application.internshipId?.companyId?.toString();
  if (!internshipCompanyId || internshipCompanyId !== companyProfile._id.toString()) {
    throw new ForbiddenError('You can only manage applicants for your own company internships');
  }

  return { companyProfile, application };
}

/**
 * PATCH /api/v1/company/applications/:id/shortlist
 * Shortlist applicant (applied -> shortlisted).
 */
export async function shortlistApplicant(req, res, next) {
  try {
    const applicationId = req.params.id;
    await verifyCompanyApplicationOwnership(req.user.userId, applicationId);

    const actor = { id: req.user.userId, role: req.user.role };

    const updated = await applyTransition(
      applicationId,
      APPLICATION_STATUS.SHORTLISTED,
      actor,
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    if (err.code === 'NOT_FOUND') err.statusCode = 404;
    if (err.code === 'INVALID_TRANSITION' || err.code === 'TRANSITION_CONFLICT') err.statusCode = 409;
    next(err);
  }
}

/**
 * PATCH /api/v1/company/applications/:id/reject
 * Reject applicant (from applied or shortlisted -> rejected).
 */
export async function rejectApplicant(req, res, next) {
  try {
    const applicationId = req.params.id;
    await verifyCompanyApplicationOwnership(req.user.userId, applicationId);

    const { reason } = req.body ?? {};
    const actor = { id: req.user.userId, role: req.user.role };

    const updated = await applyTransition(
      applicationId,
      APPLICATION_STATUS.REJECTED,
      actor,
      reason ?? 'Rejected by company',
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    if (err.code === 'NOT_FOUND') err.statusCode = 404;
    if (err.code === 'INVALID_TRANSITION' || err.code === 'TRANSITION_CONFLICT') err.statusCode = 409;
    next(err);
  }
}

/**
 * PATCH /api/v1/company/applications/:id/offer
 * Offer applicant (shortlisted -> offered).
 */
export async function offerApplicant(req, res, next) {
  try {
    const applicationId = req.params.id;
    await verifyCompanyApplicationOwnership(req.user.userId, applicationId);

    const actor = { id: req.user.userId, role: req.user.role };

    const updated = await applyTransition(
      applicationId,
      APPLICATION_STATUS.OFFERED,
      actor,
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    if (err.code === 'NOT_FOUND') err.statusCode = 404;
    if (err.code === 'INVALID_TRANSITION' || err.code === 'TRANSITION_CONFLICT') err.statusCode = 409;
    next(err);
  }
}

/**
 * POST /api/v1/company/applications/:id/evaluate
 * Evaluate completed application.
 */
export async function evaluateApplication(req, res, next) {
  try {
    const applicationId = req.params.id;
    const { application } = await verifyCompanyApplicationOwnership(req.user.userId, applicationId);
    const { rating, ppoRecommended } = req.body ?? {};

    if (ppoRecommended !== undefined) {
      application.ppoOffered = !!ppoRecommended;
    }
    await application.save();

    return res.status(200).json({
      success: true,
      data: {
        applicationId,
        rating,
        ppoOffered: application.ppoOffered,
      },
    });
  } catch (err) {
    next(err);
  }
}
