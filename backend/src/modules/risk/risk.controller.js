// FILE: src/modules/risk/risk.controller.js
import {
  getLiveRiskForApplication,
  dismissRiskFlag,
} from './services/risk.service.js';

import { ValidationError, NotFoundError, ForbiddenError } from '../../core/errors.js';

/**
 * GET /api/v1/risk/:applicationId
 *
 * Returns live-computed risk result for one application.
 * Allowed roles: faculty, tnp (enforced by roleGuard in routes)
 */
export async function getRisk(req, res, next) {
  try {
    const result = await getLiveRiskForApplication(req.params.applicationId);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.status === 404) {
      return next(new NotFoundError(err.message));
    }
    if (err.code === 'FORBIDDEN' || err.status === 403) {
      return next(new ForbiddenError(err.message));
    }
    next(err);
  }
}

/**
 * PATCH /api/v1/risk/:applicationId/dismiss
 *
 * Persists a dismissal record for a risk flag.
 * Only the assigned faculty mentor may dismiss (enforced in risk.service).
 */
export async function dismissRisk(req, res, next) {
  try {
    const { note } = req.body ?? {};
    if (!note || typeof note !== 'string' || note.trim() === '') {
      throw new ValidationError('Dismissal note is required');
    }

    const result = await dismissRiskFlag(
      req.params.applicationId,
      req.user,
      note,
    );
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.status === 404) {
      return next(new NotFoundError(err.message));
    }
    if (err.code === 'FORBIDDEN' || err.status === 403) {
      return next(new ForbiddenError(err.message));
    }
    next(err);
  }
}
