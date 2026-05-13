import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { APP_URL } from '@/lib/config/app-url'

const DEVELOPMENT_SESSION_SECRET = 'bidflow_super_secret_key_change_this_in_development_only_2024'

function resolveCookieSecureFlag() {
  if (process.env.NODE_ENV !== 'production') {
    return false
  }

  try {
    const url = new URL(APP_URL)

    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return false
    }

    return url.protocol === 'https:'
  } catch {
    return false
  }
}

function resolveSessionSecret() {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: SESSION_SECRET is required in production.')
  }

  return DEVELOPMENT_SESSION_SECRET
}

const sessionOptions = {
  password: resolveSessionSecret(),
  cookieName: 'bidflow_session',
  cookieOptions: {
    secure: resolveCookieSecureFlag(),
    httpOnly: true,
    sameSite: 'lax',
  },
}

// Use this in API routes and server components to get the current session
export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession(cookieStore, sessionOptions)
}

// Use this in server page components to require login
// If not logged in, it will redirect to /login automatically
export async function requireAuth() {
  const session = await getSession()
  if (!session.userId) {
    redirect('/login')
  }
  return session
}
