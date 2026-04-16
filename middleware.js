/**
 * Next.js middleware for request/response handling
 * Runs before every request for logging and tracing
 */

import { NextResponse } from 'next/server'

/**
 * Middleware to add request tracing and logging support
 */
export function middleware(request) {
  // Generate request ID for tracing across logs
  const requestId = crypto.randomUUID()

  // Clone the request headers to add our custom header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  // Get user ID from session if available (from cookie)
  const sessionCookie = request.cookies.get('bidflow_session')
  const userId = sessionCookie ? 'authenticated' : 'anonymous'

  // Create response with new headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Add response headers for tracing
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-user-context', userId)

  return response
}

/**
 * Configure which routes should use middleware
 */
export const config = {
  // Apply middleware to all API routes
  matcher: ['/api/:path*', '/((?!_next|public|favicon).)*'],
}
