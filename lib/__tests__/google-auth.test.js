import {
  getGoogleClientId,
  isGoogleAuthEnabled,
  normalizeGoogleProfile,
} from '../google-auth'

describe('Google auth helpers', () => {
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID
  const originalPublicGoogleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = originalGoogleClientId
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = originalPublicGoogleClientId
  })

  it('prefers GOOGLE_CLIENT_ID when both env vars are set', () => {
    process.env.GOOGLE_CLIENT_ID = 'server-client-id'
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'public-client-id'

    expect(getGoogleClientId()).toBe('server-client-id')
    expect(isGoogleAuthEnabled()).toBe(true)
  })

  it('falls back to NEXT_PUBLIC_GOOGLE_CLIENT_ID when needed', () => {
    delete process.env.GOOGLE_CLIENT_ID
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'public-client-id'

    expect(getGoogleClientId()).toBe('public-client-id')
  })

  it('normalizes a Google profile payload', () => {
    const profile = normalizeGoogleProfile({
      sub: 'google-subject-123',
      email: 'FOUNDER@EXAMPLE.COM',
      email_verified: true,
      name: 'Founder Name',
      picture: 'https://example.com/avatar.png',
    })

    expect(profile).toEqual({
      googleSubject: 'google-subject-123',
      email: 'founder@example.com',
      emailVerified: true,
      name: 'Founder Name',
      avatarUrl: 'https://example.com/avatar.png',
    })
  })

  it('returns null when required Google fields are missing', () => {
    expect(normalizeGoogleProfile({ email: 'test@example.com' })).toBeNull()
    expect(normalizeGoogleProfile({ sub: 'abc123' })).toBeNull()
  })
})
