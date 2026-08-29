import { NextResponse } from 'next/server'

const PUBLIC_PATHS = [
  '/privacy',
  '/terms',
  '/manage',
  '/tenders',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/crawler',
  '/api/pilot-leads',
  '/api/subscribe',
  '/api/unsubscribe',
  '/api/subscriptions',
]

const CSRF_PROTECTED_METHODS = new Set(['POST', 'PATCH', 'DELETE'])

function isPublicPath(pathname) {
  return PUBLIC_PATHS.some(path => pathname.startsWith(path))
}

function isStaticAssetPath(pathname) {
  return /\.(png|jpg|jpeg|svg|ico|webp|avif|css|js)$/i.test(pathname)
}

function hasCsrfHeader(request) {
  return (
    request.headers.get('x-requested-with') === 'XMLHttpRequest'
    || request.headers.get('x-bid360-csrf') === '1'
  )
}

export function proxy(request) {
  const { pathname } = request.nextUrl
  const isApi = pathname.startsWith('/api/')

  if (isStaticAssetPath(pathname)) {
    return NextResponse.next()
  }

  if (isApi && CSRF_PROTECTED_METHODS.has(request.method) && !hasCsrfHeader(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isPublic = isPublicPath(pathname)
  if (isPublic) return NextResponse.next()
  if (pathname === '/') return NextResponse.next()

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next()
  }

  const sessionCookie = request.cookies.get('bidflow_session')
  if (!sessionCookie) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
