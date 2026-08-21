/**
 * 404 handler — registered after all routes, before the error handler.
 * Uses the same error-response shape as API_Contract.md.
 */
export function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}
