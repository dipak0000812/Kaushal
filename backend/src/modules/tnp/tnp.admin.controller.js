import {
  createInvite,
  provisionFaculty,
  provisionHod,
} from '../auth/auth.service.js';
import { verifyCompany } from '../onboarding/services/companyVerification.service.js';
import { applyTransition } from '../student/services/applicationTransition.service.js';
import {
  getTnpAlerts,
  getTnpDashboard,
  getApplicationFunnel,
  getSkillGapReport,
  getDepartmentAnalytics,
  getPpoOutcomes,
} from '../analytics/analytics.service.js';
import { User } from '../auth/models/User.js';
import { Internship } from '../company/models/Internship.js';
import { CompanyProfile } from '../company/models/CompanyProfile.js';
import { Application } from '../student/models/Application.js';
import { MentorAssignment } from '../faculty/models/MentorAssignment.js';
import {
  APPLICATION_STATUS,
  INTERNSHIP_STATUS,
  MENTOR_ASSIGNMENT_STATUS,
  ROLES,
} from '../../utils/constants.js';
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../core/errors.js';

/**
 * POST /api/v1/tnp/invites
 * T&P generates an invite token for company onboarding.
 */
export async function createInviteHandler(req, res, next) {
  try {
    const data = await createInvite(req.body, req.user.userId || req.user.id);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/tnp/users/faculty
 * T&P provisions a new faculty account.
 */
export async function provisionFacultyHandler(req, res, next) {
  try {
    const data = await provisionFaculty(req.body, req.user.userId || req.user.id);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/tnp/users/hod
 * T&P provisions a new HOD account.
 */
export async function provisionHodHandler(req, res, next) {
  try {
    const data = await provisionHod(req.body, req.user.userId || req.user.id);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/tnp/users
 * Generic user provisioning (faculty or hod) based on body.role.
 */
export async function provisionUserHandler(req, res, next) {
  try {
    const { role } = req.body ?? {};
    if (role === ROLES.HOD) {
      const data = await provisionHod(req.body, req.user.userId || req.user.id);
      return res.status(201).json({ success: true, data });
    } else if (role === ROLES.FACULTY) {
      const data = await provisionFaculty(req.body, req.user.userId || req.user.id);
      return res.status(201).json({ success: true, data });
    } else {
      throw new ValidationError("Role must be 'faculty' or 'hod'");
    }
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/tnp/users
 * Returns all faculty and HOD users provisioned.
 */
export async function getUsersHandler(req, res, next) {
  try {
    const users = await User.find({ role: { $in: [ROLES.FACULTY, ROLES.HOD] } })
      .select('-passwordHash')
      .lean();
    return res.status(200).json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/tnp/companies
 * Returns all company profiles with account status.
 */
export async function getCompaniesHandler(req, res, next) {
  try {
    const companies = await CompanyProfile.find().lean();
    const userIds = companies.map((c) => c.userId);
    const users = await User.find({ _id: { $in: userIds } }, 'status email name').lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const data = companies.map((c) => ({
      ...c,
      status: userMap.get(c.userId?.toString())?.status || 'pending',
    }));

    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/tnp/companies/:id/verify
 * T&P verifies a company account.
 */
export async function verifyCompanyHandler(req, res, next) {
  try {
    const companyUserId = req.params.id;

    // Validate that the target user exists and is a company
    const targetUser = await User.findById(companyUserId);
    if (!targetUser) {
      throw new NotFoundError('Company user not found');
    }

    const actor = { id: req.user.userId || req.user.id, role: req.user.role };
    const result = await verifyCompany(companyUserId, actor);

    return res.status(200).json({
      success: true,
      data: {
        userId: result.user._id,
        companyName: result.user.name,
        status: result.user.status,
        publishedCount: result.publishedCount,
      },
    });
  } catch (err) {
    if (err.code === 'NOT_FOUND') err.statusCode = 404;
    if (err.code === 'CONFLICT') err.statusCode = 409;
    next(err);
  }
}

/**
 * GET /api/v1/tnp/internships/pending-approval
 * Returns all internships from unverified companies awaiting manual approval.
 */
export async function getPendingInternships(req, res, next) {
  try {
    const internships = await Internship.find({ status: INTERNSHIP_STATUS.PENDING_APPROVAL })
      .populate('companyId')
      .lean();
    return res.status(200).json({ success: true, data: internships });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/tnp/internships/:id/approve
 * T&P manually approves an internship posting -> status: open.
 */
export async function approveInternship(req, res, next) {
  try {
    const internship = await Internship.findById(req.params.id);
    if (!internship) {
      throw new NotFoundError('Internship not found');
    }

    internship.status = INTERNSHIP_STATUS.OPEN;
    await internship.save();

    return res.status(200).json({ success: true, data: internship });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/tnp/applications/:id/verify-offer
 * Valid from accepted -> tnpVerified.
 */
export async function verifyOffer(req, res, next) {
  try {
    const applicationId = req.params.id;
    const actor = { id: req.user.userId || req.user.id, role: req.user.role };

    const updated = await applyTransition(
      applicationId,
      APPLICATION_STATUS.TNP_VERIFIED,
      actor,
      'Offer verified by T&P',
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    if (err.code === 'NOT_FOUND') err.statusCode = 404;
    if (err.code === 'INVALID_TRANSITION' || err.code === 'TRANSITION_CONFLICT') err.statusCode = 409;
    next(err);
  }
}

/**
 * PATCH /api/v1/tnp/applications/:id/reject-offer
 * Valid from accepted -> offered (reverts back to offered with reason).
 */
export async function rejectOffer(req, res, next) {
  try {
    const applicationId = req.params.id;
    const { reason } = req.body ?? {};

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new ValidationError('Rejection reason is required');
    }

    const actor = { id: req.user.userId || req.user.id, role: req.user.role };
    const updated = await applyTransition(
      applicationId,
      APPLICATION_STATUS.OFFERED,
      actor,
      `Offer rejected by T&P: ${reason.trim()}`,
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    if (err.code === 'NOT_FOUND') err.statusCode = 404;
    if (err.code === 'INVALID_TRANSITION' || err.code === 'TRANSITION_CONFLICT') err.statusCode = 409;
    next(err);
  }
}

/**
 * PATCH /api/v1/tnp/applications/:id/override
 * Overrides eligibility decision honestly preserving snapshot checks for audit.
 */
export async function overrideEligibility(req, res, next) {
  try {
    const applicationId = req.params.id;
    const { eligible, reason } = req.body ?? {};

    if (eligible === undefined) {
      throw new ValidationError('eligible boolean is required');
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw new ValidationError('Override reason is required');
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      throw new NotFoundError('Application not found');
    }

    application.override = {
      eligible: Boolean(eligible),
      reason: reason.trim(),
      byUserId: req.user.userId || req.user.id,
      at: new Date(),
    };
    await application.save();

    return res.status(200).json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/tnp/assignments
 * Assigns faculty mentor to an application in tnpVerified status.
 */
export async function assignMentor(req, res, next) {
  try {
    const { applicationId, facultyId } = req.body ?? {};

    if (!applicationId || !facultyId) {
      throw new ValidationError('applicationId and facultyId are required');
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      throw new NotFoundError('Application not found');
    }

    if (application.currentStatus !== APPLICATION_STATUS.TNP_VERIFIED) {
      throw new ConflictError(`Cannot assign mentor to application in status '${application.currentStatus}'`);
    }

    // Check if faculty exists and has role faculty
    const faculty = await User.findById(facultyId);
    if (!faculty || faculty.role !== ROLES.FACULTY) {
      throw new ValidationError('Invalid faculty user reference');
    }

    // Check if an active assignment already exists
    const existing = await MentorAssignment.findOne({
      applicationId,
      status: { $in: [MENTOR_ASSIGNMENT_STATUS.PENDING, MENTOR_ASSIGNMENT_STATUS.ACCEPTED] },
    });
    if (existing) {
      throw new ConflictError('An active mentor assignment already exists for this application');
    }

    const assignment = await MentorAssignment.create({
      applicationId,
      facultyId,
      status: MENTOR_ASSIGNMENT_STATUS.PENDING,
    });

    const actor = { id: req.user.userId || req.user.id, role: req.user.role };
    const updatedApp = await applyTransition(
      applicationId,
      APPLICATION_STATUS.MENTOR_PENDING,
      actor,
      `Mentor assigned: ${faculty.name}`,
    );

    return res.status(201).json({
      success: true,
      data: {
        assignment,
        application: updatedApp,
      },
    });
  } catch (err) {
    if (err.code === 'NOT_FOUND') err.statusCode = 404;
    if (err.code === 'INVALID_TRANSITION' || err.code === 'TRANSITION_CONFLICT') err.statusCode = 409;
    next(err);
  }
}

/**
 * PATCH /api/v1/tnp/applications/:id/cancel
 * Cancels application from any non-terminal state.
 */
export async function cancelApplication(req, res, next) {
  try {
    const applicationId = req.params.id;
    const { reason } = req.body ?? {};

    const actor = { id: req.user.userId || req.user.id, role: req.user.role };
    const updated = await applyTransition(
      applicationId,
      APPLICATION_STATUS.CANCELLED,
      actor,
      reason ?? 'Cancelled by T&P',
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    if (err.code === 'NOT_FOUND') err.statusCode = 404;
    if (err.code === 'INVALID_TRANSITION' || err.code === 'TRANSITION_CONFLICT') err.statusCode = 409;
    next(err);
  }
}

/**
 * GET /api/v1/tnp/alerts
 * Aggregated alert counts for T&P.
 */
export async function getTnpAlertsHandler(req, res, next) {
  try {
    const alerts = await getTnpAlerts();
    return res.status(200).json({ success: true, data: alerts });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/tnp/analytics/dashboard
 * Aggregated analytics for T&P dashboard.
 */
export async function getTnpAnalyticsDashboard(req, res, next) {
  try {
    const [dashboardData, alerts] = await Promise.all([
      getTnpDashboard(),
      getTnpAlerts(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...dashboardData,
        alerts,
      },
    });
  } catch (err) {
    next(err);
  }
}
