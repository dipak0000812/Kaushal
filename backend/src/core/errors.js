/**
 * Application-level error classes.
 * All classes extend AppError which carries statusCode and a safe client-facing code string.
 * Stack traces are never sent in production responses — only code + message.
 */
export class AppError extends Error {
  /**
   * @param {string} message   Safe, client-facing description
   * @param {number} statusCode HTTP status code
   * @param {string} code      Machine-readable error code (snake_case)
   * @param {unknown} [details] Optional structured details (validation issues, etc.)
   */
  constructor(message, statusCode, code, details) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/** 400 — request body / query / param failed schema validation */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/** 401 — missing or invalid authentication */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** 403 — authenticated but role/scope insufficient */
export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

/** 404 — resource not found */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/** 409 — duplicate resource or invalid state transition */
export class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

/** 422 — request is well-formed but violates a business rule */
export class BusinessRuleError extends AppError {
  constructor(message = 'Business rule violation', code = 'BUSINESS_RULE_VIOLATION') {
    super(message, 422, code);
  }
}
