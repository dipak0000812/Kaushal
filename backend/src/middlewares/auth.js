// FILE: src/middlewares/auth.js
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../modules/auth/models/User.js';

/**
 * authenticate — verifies JWT from Authorization header, attaches req.user.
 *
 * req.user shape: { userId, role, email, department }
 *
 * department is loaded from the stored User record (not trusted from the token)
 * so a T&P department-change takes effect immediately without re-login.
 * (Architecture.md authentication section)
 */
export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authorization token required' },
      });
    }

    const token = header.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
      });
    }

    // Load user from DB — department is not trusted from token
    const user = await User.findById(payload.userId).lean();
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not found' },
      });
    }

    req.user = {
      id: user._id.toString(),
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
      department: user.department ?? null,
    };

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Authentication error' },
    });
  }
}
