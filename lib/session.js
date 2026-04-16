import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

function resolveCookieSecureFlag() {
  if (process.env.NODE_ENV !== 'production') {
    return false
  }

  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

  if (!configuredUrl) {
    return false
  }

  try {
    const normalizedUrl = configuredUrl.startsWith('http')
      ? configuredUrl
      : `https://${configuredUrl}`
    const url = new URL(normalizedUrl)

    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return false
    }

    return url.protocol === 'https:'
  } catch {
    return false
  }
}

const sessionOptions = {
  password: process.env.SESSION_SECRET || 'bidflow_super_secret_key_change_this_in_production_2024',
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
