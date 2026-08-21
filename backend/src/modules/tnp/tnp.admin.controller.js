import {
  createInvite,
  provisionFaculty,
  provisionHod,
} from '../auth/auth.service.js';
import { verifyCompany } from '../onboarding/services/companyVerification.service.js';
import { User } from '../auth/models/User.js';
import { NotFoundError } from '../../core/errors.js';

/**
 * POST /api/v1/tnp/invites
 * T&P generates an invite token for company onboarding.
 */
export async function createInviteHandler(req, res, next) {
  try {
    const data = await createInvite(req.body, req.user.id);
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
    const data = await provisionFaculty(req.body, req.user.id);
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
    const data = await provisionHod(req.body, req.user.id);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/tnp/companies/:id/verify
 * T&P verifies a company account.
 * Delegates entirely to the existing verifyCompany() domain service.
 * Does NOT duplicate any verification business logic.
 */
export async function verifyCompanyHandler(req, res, next) {
  try {
    const companyUserId = req.params.id;

    // Validate that the target user exists and is a company
    const targetUser = await User.findById(companyUserId);
    if (!targetUser) {
      throw new NotFoundError('Company user not found');
    }

    const actor = { id: req.user.id, role: req.user.role };
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
    // Map the domain service's internal error codes to AppError codes
    if (err.code === 'NOT_FOUND') {
      err.statusCode = 404;
    } else if (err.code === 'CONFLICT') {
      err.statusCode = 409;
    }
    next(err);
  }
}
