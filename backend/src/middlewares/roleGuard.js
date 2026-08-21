// FILE: src/middlewares/roleGuard.js

/**
 * roleGuard — route-level RBAC guard (Architecture.md two-layer enforcement, layer 1).
 *
 * Usage: roleGuard(['faculty', 'tnp'])
 *
 * Returns a middleware that rejects any request whose req.user.role is not
 * in the allowed list. authenticate must run before roleGuard.
 *
 * @param {string[]} allowedRoles
 * @returns {import('express').RequestHandler}
 */
export function roleGuard(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}
