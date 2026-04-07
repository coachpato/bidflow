import { NextResponse } from 'next/server'

// Paths that do NOT require login
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
]

export function middleware(request) {
  const { pathname } = request.nextUrl

  // Allow public paths
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))
  if (isPublic) return NextResponse.next()

  // Allow Next.js internals and static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next()
  }

  // Check if session cookie exists (basic guard)
  // Full session validation happens inside each page/API route
  const sessionCookie = request.cookies.get('bidflow_session')
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
