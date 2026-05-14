import { logger as defaultLogger } from './logger'

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

export const CRAWL_ERROR_TYPES = {
  RETRYABLE: 'retryable',
  RATE_LIMITED: 'rate_limited',
  FATAL: 'fatal',
  SOURCE_DATA_INVALID: 'source_data_invalid',
  TIMEOUT: 'timeout',
  BUDGET_EXHAUSTED: 'budget_exhausted',
}

/**
 * CrawlError extends Error rather than AppError because crawler failures
 * are internal operational retry/diagnostic signals, not HTTP API responses.
 * Crawler-specific error that carries enough classification for retry and diagnostics decisions.
 */
export class CrawlError extends Error {
  constructor(message, type, retryAfterMs = null, context = {}) {
    super(message)
    this.name = 'CrawlError'
    this.type = type
    this.retryAfterMs = retryAfterMs
    this.context = context
  }

  toJSON() {
    return {
      error: this.message,
      type: this.type,
      ...(this.retryAfterMs !== null && { retryAfterMs: this.retryAfterMs }),
      ...(this.context && Object.keys(this.context).length > 0 && { context: this.context }),
    }
  }
}

function getHttpStatus(error, httpStatus) {
  return httpStatus
    || error?.response?.status
    || error?.status
    || error?.statusCode
    || null
}

function parseRetryAfterMs(value) {
  if (!value) return null
  const retryAfter = Array.isArray(value) ? value[0] : value
  const seconds = Number.parseInt(retryAfter, 10)

  if (Number.isFinite(seconds)) {
    return seconds * 1000
  }

  const dateMs = new Date(retryAfter).getTime()
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now())
  }

  return null
}

function getRetryAfterMs(error) {
  const headers = error?.response?.headers || error?.headers
  if (!headers) return null

  if (typeof headers.get === 'function') {
    return parseRetryAfterMs(headers.get('retry-after'))
  }

  return parseRetryAfterMs(headers['retry-after'] || headers['Retry-After'])
}

function isTimeoutError(error) {
  return error?.name === 'AbortError'
    || error?.code === 'ETIMEDOUT'
    || (error?.code === 'ECONNABORTED' && /timeout|aborted/i.test(error.message || ''))
    || /timeout|timed out/i.test(error?.message || '')
}

function isNetworkError(error) {
  return error instanceof TypeError
    || ['ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE'].includes(error?.code)
}

function isParseError(error) {
  return error instanceof SyntaxError
    || error?.name === 'ParseError'
    || error?.code === 'ERR_PARSE'
    || /parse|invalid json|invalid html/i.test(error?.message || '')
}

/**
 * Classifies crawl failures using this decision table:
 * HTTP 429 -> rate_limited; HTTP 5xx -> retryable; HTTP 4xx -> fatal;
 * network throws -> retryable; AbortError/timeouts -> timeout;
 * JSON/HTML parse failures -> source_data_invalid; Prisma constraint errors -> fatal.
 */
export function classifyError(error, httpStatus = null) {
  if (error instanceof CrawlError) {
    return error
  }

  const status = getHttpStatus(error, httpStatus)
  const message = error?.message || 'Unknown crawl error'
  const context = {
    ...(status && { httpStatus: status }),
    ...(error?.code && { code: error.code }),
    ...(error?.name && { name: error.name }),
  }

  if (status === 429) {
    return new CrawlError(message, CRAWL_ERROR_TYPES.RATE_LIMITED, getRetryAfterMs(error), context)
  }

  if (status >= 500) {
    return new CrawlError(message, CRAWL_ERROR_TYPES.RETRYABLE, null, context)
  }

  if (status >= 400) {
    return new CrawlError(message, CRAWL_ERROR_TYPES.FATAL, null, context)
  }

  if (['P2002', 'P2003', 'P2025'].includes(error?.code)) {
    return new CrawlError(message, CRAWL_ERROR_TYPES.FATAL, null, context)
  }

  if (isTimeoutError(error)) {
    return new CrawlError(message, CRAWL_ERROR_TYPES.TIMEOUT, null, context)
  }

  if (isParseError(error)) {
    return new CrawlError(message, CRAWL_ERROR_TYPES.SOURCE_DATA_INVALID, null, context)
  }

  if (isNetworkError(error)) {
    return new CrawlError(message, CRAWL_ERROR_TYPES.RETRYABLE, null, context)
  }

  return new CrawlError(message, CRAWL_ERROR_TYPES.FATAL, null, context)
}

function defaultSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getRetryDelayMs(error, attemptNumber, { baseDelayMs, jitterMs, random }) {
  if (error.type === CRAWL_ERROR_TYPES.RATE_LIMITED && error.retryAfterMs !== null) {
    return error.retryAfterMs
  }

  return baseDelayMs * (2 ** (attemptNumber - 1)) + Math.floor(random() * jitterMs)
}

function logCrawlerRetryEvent(logger, level, message, error, context) {
  if (typeof logger.crawler === 'function') {
    logger.crawler({
      level,
      message,
      phase: context.phase || null,
      error,
      data: context,
    })
    return
  }

  if (level === 'error') {
    logger.error(message, error, context)
    return
  }

  logger.warn(message, context)
}

/**
 * Retries only transient crawl failures so fatal source or data issues fail fast and stay visible.
 */
export async function withRetry(fn, options = {}) {
  const {
    operationName = 'crawl operation',
    baseDelayMs = 1000,
    jitterMs = 500,
    retryableAttempts = 3,
    rateLimitedAttempts = 2,
    sleep = defaultSleep,
    random = Math.random,
    logger = defaultLogger,
  } = options
  const attemptsByType = {
    [CRAWL_ERROR_TYPES.RETRYABLE]: 0,
    [CRAWL_ERROR_TYPES.RATE_LIMITED]: 0,
  }

  while (true) {
    try {
      return await fn()
    } catch (error) {
      const classifiedError = classifyError(error)
      const isRetryable = [
        CRAWL_ERROR_TYPES.RETRYABLE,
        CRAWL_ERROR_TYPES.RATE_LIMITED,
      ].includes(classifiedError.type)

      if (!isRetryable) {
        logCrawlerRetryEvent(logger, 'error', 'crawl_error_not_retryable', classifiedError, {
          operationName,
          errorType: classifiedError.type,
        })
        throw classifiedError
      }

      attemptsByType[classifiedError.type] += 1
      const maxAttempts = classifiedError.type === CRAWL_ERROR_TYPES.RATE_LIMITED
        ? rateLimitedAttempts
        : retryableAttempts
      const attemptNumber = attemptsByType[classifiedError.type]

      if (attemptNumber >= maxAttempts) {
        logCrawlerRetryEvent(logger, 'error', 'crawl_retry_exhausted', classifiedError, {
          operationName,
          errorType: classifiedError.type,
          attempts: attemptNumber,
        })
        throw classifiedError
      }

      const delayMs = getRetryDelayMs(classifiedError, attemptNumber, {
        baseDelayMs,
        jitterMs,
        random,
      })

      logCrawlerRetryEvent(logger, 'warn', 'crawl_retry_scheduled', classifiedError, {
        operationName,
        errorType: classifiedError.type,
        attempt: attemptNumber,
        maxAttempts,
        delayMs,
      })

      await sleep(delayMs)
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
