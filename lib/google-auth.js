import { OAuth2Client } from 'google-auth-library'

let googleClient = null

export function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || null
}

export function isGoogleAuthEnabled() {
  return Boolean(getGoogleClientId())
}

function getGoogleOAuthClient() {
  const clientId = getGoogleClientId()

  if (!clientId) {
    throw new Error('Google authentication is not configured.')
  }

  if (!googleClient) {
    googleClient = new OAuth2Client(clientId)
  }

  return googleClient
}

export function normalizeGoogleProfile(payload) {
  if (!payload?.sub || !payload?.email) {
    return null
  }

  const normalizedEmail = payload.email.trim().toLowerCase()
  const fallbackName = normalizedEmail.split('@')[0] || 'Bid360 User'
  const normalizedName = typeof payload.name === 'string' && payload.name.trim()
    ? payload.name.trim()
    : typeof payload.given_name === 'string' && payload.given_name.trim()
      ? payload.given_name.trim()
      : fallbackName

  return {
    googleSubject: payload.sub,
    email: normalizedEmail,
    emailVerified: payload.email_verified === true || payload.email_verified === 'true',
    name: normalizedName,
    avatarUrl: typeof payload.picture === 'string' && payload.picture.trim() ? payload.picture.trim() : null,
  }
}

export async function verifyGoogleIdToken(credential) {
  if (!credential || typeof credential !== 'string') {
    throw new Error('Google credential is required.')
  }

  const ticket = await getGoogleOAuthClient().verifyIdToken({
    idToken: credential,
    audience: getGoogleClientId(),
  })

  const profile = normalizeGoogleProfile(ticket.getPayload())

  if (!profile) {
    throw new Error('Google profile is incomplete.')
  }

  return profile
}
