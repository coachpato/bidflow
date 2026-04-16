/**
 * API route handler wrappers for middleware
 * Provides reusable middleware for auth, org context, and error handling
 */

import { getSession } from './session'
import { ensureOrganizationContext } from './organization'
import { formatErrorResponse, UnauthorizedError } from './errors'
import { logError } from './logger'

/**
 * Wraps a handler to enforce authentication
 * Checks session.userId and returns 401 if not authenticated
 * @param {Function} handler - Route handler (POST, GET, etc.)
 * @returns {Function} - Wrapped handler
 */
export function withAuth(handler) {
  return async (request, context) => {
    try {
      const session = await getSession()
      if (!session.userId) {
        const error = new UnauthorizedError('You must be logged in to access this resource')
        const { status, body } = formatErrorResponse(error)
        return Response.json(body, { status })
      }

      // Attach session to request for downstream use
      request.session = session
      return await handler(request, context)
    } catch (error) {
      logError('Auth check failed', error)
      const { status, body } = formatErrorResponse(error)
      return Response.json(body, { status })
    }
  }
}

/**
 * Wraps a handler to ensure organization context
 * Must be used after withAuth
 * @param {Function} handler - Route handler
 * @returns {Function} - Wrapped handler
 */
export function withOrgContext(handler) {
  return async (request, context) => {
    try {
      const session = request.session
      if (!session) {
        throw new UnauthorizedError('Session not found')
      }

      const organizationContext = await ensureOrganizationContext(session.userId)
      request.organizationContext = organizationContext

      return await handler(request, context)
    } catch (error) {
      logError('Organization context check failed', error)
      const { status, body } = formatErrorResponse(error)
      return Response.json(body, { status })
    }
  }
}

/**
 * Wraps a handler to catch and format errors
 * Should be the outermost wrapper
 * @param {Function} handler - Route handler
 * @returns {Function} - Wrapped handler
 */
export function withErrorHandling(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context)
    } catch (error) {
      logError('Unhandled error in API route', error)
      const { status, body } = formatErrorResponse(error)
      return Response.json(body, { status })
    }
  }
}

/**
 * Wraps a handler to check user role
 * Must be used after withAuth
 * @param {string|string[]} requiredRole - Role(s) required ('admin', 'member', etc.)
 * @param {Function} handler - Route handler
 * @returns {Function} - Wrapped handler
 */
export function withRoleCheck(requiredRole, handler) {
  return async (request, context) => {
    try {
      const session = request.session
      if (!session) {
        throw new UnauthorizedError('Session not found')
      }

      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
      if (!roles.includes(session.role)) {
        throw new UnauthorizedError(`This action requires one of these roles: ${roles.join(', ')}`)
      }

      return await handler(request, context)
    } catch (error) {
      logError('Role check failed', error)
      const { status, body } = formatErrorResponse(error)
      return Response.json(body, { status })
    }
  }
}

/**
 * Compose multiple middleware wrappers
 * Example: compose(withErrorHandling, withAuth, withOrgContext)(handler)
 * @param {...Function} wrappers - Middleware functions to apply
 * @returns {Function} - Composed middleware
 */
export function compose(...wrappers) {
  return (handler) => {
    return wrappers.reverse().reduce((acc, wrapper) => wrapper(acc), handler)
  }
}

/**
 * Convenience: Apply auth + org context + error handling
 * This is the most common pattern for authenticated routes
 * @param {Function} handler - Route handler
 * @returns {Function} - Wrapped handler
 */
export const withAuthAndOrg = (handler) => {
  return withErrorHandling(withAuth(withOrgContext(handler)))
}

/**
 * Convenience: Apply auth + role check + error handling
 * @param {string|string[]} requiredRole - Role(s) required
 * @returns {Function} - Returns a function that takes handler
 */
export const withAuthAndRole = (requiredRole) => (handler) => {
  return withErrorHandling(withAuth(withRoleCheck(requiredRole, handler)))
}

/**
 * Example usage in a route file:
 *
 * // OLD WAY (before):
 * export async function GET() {
 *   const session = await getSession()
 *   if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
 *   const organizationContext = await ensureOrganizationContext(session.userId)
 *
 *   try {
 *     const data = await prisma.contract.findMany(...)
 *     return Response.json(data)
 *   } catch (err) {
 *     console.error('Error:', err)
 *     return Response.json({ error: 'Something went wrong' }, { status: 500 })
 *   }
 * }
 *
 * // NEW WAY (after):
 * const handler = async (request) => {
 *   const data = await prisma.contract.findMany(
 *     where: { organizationId: request.organizationContext.organization.id }
 *   )
 *   return Response.json(data)
 * }
 *
 * export const GET = withAuthAndOrg(handler)
 */
