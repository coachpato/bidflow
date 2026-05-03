import Link from 'next/link'
import { headers } from 'next/headers'
import AuthShell from '@/app/components/AuthShell'
import VerificationResendForm from '@/app/components/VerificationResendForm'

const HIGHLIGHTS = [
  {
    title: 'Protected access',
    body: 'Email verification keeps pilot workspaces tied to real inboxes.',
  },
  {
    title: 'Normal sign-in after verification',
    body: 'Once verified, use your email and password on the login page.',
  },
]

async function getRequestOrigin() {
  const requestHeaders = await headers()
  const host = requestHeaders.get('host')
  const forwardedProto = requestHeaders.get('x-forwarded-proto')

  if (!host) return null

  const protocol = forwardedProto || (host.startsWith('localhost') ? 'http' : 'https')
  return `${protocol}://${host}`
}

async function verifyEmailToken(token) {
  if (!token) {
    return {
      status: 'invalid',
      message: 'This verification link is invalid.',
    }
  }

  const origin = await getRequestOrigin()
  if (!origin) {
    return {
      status: 'invalid',
      message: 'This verification link is invalid.',
    }
  }

  const response = await fetch(`${origin}/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))

  if (response.ok) {
    return {
      status: 'success',
      email: payload.email,
    }
  }

  if (payload.code === 'EXPIRED') {
    return {
      status: 'expired',
      message: 'This verification link has expired.',
    }
  }

  return {
    status: 'invalid',
    message: 'This verification link is invalid.',
  }
}

export default async function VerifyEmailPage({ searchParams }) {
  const params = await searchParams
  const token = typeof params?.token === 'string' ? params.token : ''
  const result = await verifyEmailToken(token)

  return (
    <AuthShell
      title="Verify email"
      description="Account activation"
      supportingLabel="Bid360 access"
      supportingDescription="Confirming your email activates your Bid360 account before your first password sign-in."
      highlights={HIGHLIGHTS}
    >
      <div className="app-surface rounded-[24px] p-5 sm:p-6">
        {result.status === 'success' ? (
          <div className="space-y-5">
            <div>
              <p className="app-kicker">Verified</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-var(--foreground)">
                Email verified! You can now log in.
              </h1>
              <p className="mt-3 text-sm leading-7 text-var(--foreground-secondary)">
                You can now log in to Bid360{result.email ? ` with ${result.email}` : ''}.
              </p>
            </div>

            <Link href="/login" className="app-button-primary w-full">
              Log in
            </Link>
          </div>
        ) : result.status === 'expired' ? (
          <div className="space-y-5">
            <div>
              <p className="app-kicker">Expired link</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-var(--foreground)">
                This verification link has expired.
              </h1>
              <p className="mt-3 text-sm leading-7 text-var(--foreground-secondary)">
                Request a new verification email and use the latest link in your inbox.
              </p>
            </div>

            <VerificationResendForm />
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="app-kicker">Invalid link</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-var(--foreground)">
                This verification link is invalid.
              </h1>
              <p className="mt-3 text-sm leading-7 text-var(--foreground-secondary)">
                The link may have already been used or copied incorrectly.
              </p>
            </div>

            <Link href="/login" className="app-button-secondary w-full">
              Back to login
            </Link>
          </div>
        )}
      </div>
    </AuthShell>
  )
}
