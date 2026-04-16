/**
 * Structured error handling for APIs
 * Provides custom error classes with consistent response formatting
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = 500) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
    }
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', 400)
    this.name = 'ValidationError'
    this.details = details
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.details && { details: this.details }),
    }
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
    this.resource = resource
  }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401)
    this.name = 'UnauthorizedError'
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 'FORBIDDEN', 403)
    this.name = 'ForbiddenError'
  }
}

/**
 * Conflict error (409) - for duplicate resources, state conflicts
 */
export class ConflictError extends AppError {
  constructor(message, conflict = null) {
    super(message, 'CONFLICT', 409)
    this.name = 'ConflictError'
    this.conflict = conflict
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.conflict && { conflict: this.conflict }),
    }
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      retryAfter: this.retryAfter,
    }
  }
}

/**
 * Format error into standard API response
 * @param {Error|AppError} error - Error to format
 * @returns {{ status: number, body: object }} - Response object with status and body
 */
export function formatErrorResponse(error) {
  // Known application errors
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: error.toJSON(),
    }
  }

  // Prisma validation errors
  if (error.code === 'P2025') {
    return {
      status: 404,
      body: {
        error: 'Resource not found',
        code: 'NOT_FOUND',
      },
    }
  }

  // Prisma unique constraint violation
  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || 'field'
    return {
      status: 409,
      body: {
        error: `A record with this ${field} already exists`,
        code: 'CONFLICT',
        conflict: field,
      },
    }
  }

  // Prisma foreign key error
  if (error.code === 'P2003') {
    return {
      status: 400,
      body: {
        error: 'Referenced record does not exist',
        code: 'VALIDATION_ERROR',
      },
    }
  }

  // Unknown error
  return {
    status: 500,
    body: {
      error: 'Something went wrong. Please try again.',
      code: 'INTERNAL_ERROR',
    },
  }
}

/**
 * Create a validation error response
 * @param {string} message - Error message
 * @param {object} details - Optional details (e.g., field-level errors)
 * @returns {Response} - JSON response
 */
export function validationErrorResponse(message, details = null) {
  const error = new ValidationError(message, details)
  const { status, body } = formatErrorResponse(error)
  return Response.json(body, { status })
}

/**
 * Create a not found error response
 * @param {string} resource - Resource name
 * @returns {Response} - JSON response
 */
export function notFoundResponse(resource = 'Resource') {
  const error = new NotFoundError(resource)
  const { status, body } = formatErrorResponse(error)
  return Response.json(body, { status })
}

/**
 * Create an unauthorized error response
 * @param {string} message - Error message
 * @returns {Response} - JSON response
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  const error = new UnauthorizedError(message)
  const { status, body } = formatErrorResponse(error)
  return Response.json(body, { status })
}
