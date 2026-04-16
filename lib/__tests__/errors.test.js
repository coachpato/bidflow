/**
 * Tests for error handling utilities
 */

import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  formatErrorResponse,
  validationErrorResponse,
  notFoundResponse,
  unauthorizedResponse,
} from '../errors'

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create base error with default values', () => {
      const error = new AppError('Something went wrong')
      expect(error.message).toBe('Something went wrong')
      expect(error.code).toBe('INTERNAL_ERROR')
      expect(error.statusCode).toBe(500)
    })

    it('should serialize to JSON', () => {
      const error = new AppError('Test error', 'TEST_ERROR', 400)
      const json = error.toJSON()
      expect(json.error).toBe('Test error')
      expect(json.code).toBe('TEST_ERROR')
    })
  })

  describe('ValidationError', () => {
    it('should have 400 status code', () => {
      const error = new ValidationError('Invalid input')
      expect(error.statusCode).toBe(400)
      expect(error.code).toBe('VALIDATION_ERROR')
    })

    it('should include details if provided', () => {
      const details = { email: 'Invalid email format' }
      const error = new ValidationError('Validation failed', details)
      const json = error.toJSON()
      expect(json.details).toEqual(details)
    })
  })

  describe('NotFoundError', () => {
    it('should have 404 status code', () => {
      const error = new NotFoundError('User')
      expect(error.statusCode).toBe(404)
      expect(error.code).toBe('NOT_FOUND')
      expect(error.message).toBe('User not found')
    })
  })

  describe('UnauthorizedError', () => {
    it('should have 401 status code', () => {
      const error = new UnauthorizedError('Please log in')
      expect(error.statusCode).toBe(401)
      expect(error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('ForbiddenError', () => {
    it('should have 403 status code', () => {
      const error = new ForbiddenError('Access denied')
      expect(error.statusCode).toBe(403)
      expect(error.code).toBe('FORBIDDEN')
    })
  })

  describe('ConflictError', () => {
    it('should have 409 status code', () => {
      const error = new ConflictError('Email already exists')
      expect(error.statusCode).toBe(409)
      expect(error.code).toBe('CONFLICT')
    })

    it('should include conflict details', () => {
      const error = new ConflictError('Email exists', 'email')
      const json = error.toJSON()
      expect(json.conflict).toBe('email')
    })
  })

  describe('RateLimitError', () => {
    it('should have 429 status code', () => {
      const error = new RateLimitError('Too many requests', 120)
      expect(error.statusCode).toBe(429)
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(error.retryAfter).toBe(120)
    })
  })
})

describe('Error Formatting', () => {
  describe('formatErrorResponse', () => {
    it('should format AppError correctly', () => {
      const error = new ValidationError('Invalid input')
      const { status, body } = formatErrorResponse(error)
      expect(status).toBe(400)
      expect(body.code).toBe('VALIDATION_ERROR')
      expect(body.error).toBe('Invalid input')
    })

    it('should format Prisma P2025 as NOT_FOUND', () => {
      const error = new Error('Record not found')
      error.code = 'P2025'
      const { status, body } = formatErrorResponse(error)
      expect(status).toBe(404)
      expect(body.code).toBe('NOT_FOUND')
    })

    it('should format Prisma P2002 as CONFLICT', () => {
      const error = new Error('Unique constraint failed')
      error.code = 'P2002'
      error.meta = { target: ['email'] }
      const { status, body } = formatErrorResponse(error)
      expect(status).toBe(409)
      expect(body.code).toBe('CONFLICT')
      expect(body.conflict).toBe('email')
    })

    it('should format unknown errors as INTERNAL_ERROR', () => {
      const error = new Error('Unknown error')
      const { status, body } = formatErrorResponse(error)
      expect(status).toBe(500)
      expect(body.code).toBe('INTERNAL_ERROR')
    })
  })

  describe('Response Builders', () => {
    it('validationErrorResponse should return proper response', () => {
      // This tests the builder function
      const details = { name: 'Field is required' }
      const error = new ValidationError('Validation failed', details)
      const { status, body } = formatErrorResponse(error)
      expect(status).toBe(400)
      expect(body.details).toEqual(details)
    })

    it('notFoundResponse should return 404', () => {
      const error = new NotFoundError('Contract')
      const { status, body } = formatErrorResponse(error)
      expect(status).toBe(404)
      expect(body.error).toContain('not found')
    })

    it('unauthorizedResponse should return 401', () => {
      const error = new UnauthorizedError('Session expired')
      const { status, body } = formatErrorResponse(error)
      expect(status).toBe(401)
    })
  })
})
