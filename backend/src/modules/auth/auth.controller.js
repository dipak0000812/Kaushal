import {
  registerStudent,
  registerCompany,
  login,
  getMe,
} from './auth.service.js';

/**
 * POST /api/v1/auth/register
 * Student self-registration. Role assigned server-side.
 */
export async function register(req, res, next) {
  try {
    const result = await registerStudent(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/register/company
 * Company registration via T&P invite token.
 */
export async function registerCompanyHandler(req, res, next) {
  try {
    const result = await registerCompany(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/login
 * Login for all roles. Returns JWT.
 */
export async function loginHandler(req, res, next) {
  try {
    const result = await login(req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 * Returns current user identity + profile (student/company).
 * Requires: authenticate middleware.
 */
export async function meHandler(req, res, next) {
  try {
    const result = await getMe(req.user.id);
    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
