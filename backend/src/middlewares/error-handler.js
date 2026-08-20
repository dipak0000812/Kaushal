import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../core/errors.js';
import { logger } from '../core/logger.js';
import { env } from '../config/env.js';

/**
 * Centralized Express error handler.
 * Error response shape per API_Contract.md:
 *   { success: false, error: { code, message, details? } }
 *
 * Registered as the last middleware in app.js (after all routes).
 * Must have 4 parameters so Express recognises it as an error handler.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // ── Known application error ─────────────────────────────────────────────
  if (err instanceof AppError) {
    const body = {
      success: false,
      error: { code: err.code, message: err.message },
    };
    if (err.details !== undefined) body.error.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  // ── Zod validation error ─────────────────────────────────────────────────
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }

  // ── Mongoose duplicate key (E11000) ──────────────────────────────────────
  if (err.name === 'MongoServerError' && err.code === 11000) {
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: 'Duplicate resource' },
    });
  }

  // ── Mongoose CastError (bad ObjectId in params) ──────────────────────────
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ID', message: `Invalid value for field '${err.path}'` },
    });
  }

  // ── Mongoose ValidationError ─────────────────────────────────────────────
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      path: e.path,
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details },
    });
  }

  // ── Unknown / unexpected error ───────────────────────────────────────────
  logger.error({ err, req: { method: req.method, url: req.url } }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message ?? 'An unexpected error occurred',
    },
  });
}
