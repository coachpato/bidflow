import AuthShell from '@/app/components/AuthShell'
import VerificationResendForm from '@/app/components/VerificationResendForm'

const HIGHLIGHTS = [
  {
    title: 'Check your inbox',
    body: 'Your workspace is ready, but email confirmation must happen before sign-in.',
  },
  {
    title: 'One secure link',
    body: 'The verification link expires in 24 hours and can be resent from this page.',
  },
]

export default async function CheckEmailPage({ searchParams }) {
  const params = await searchParams
  const email = typeof params?.email === 'string' ? params.email : ''
  const deliveryFailed = params?.delivery === 'failed'

  return (
    <AuthShell
      title="Check your email"
      description="Verify your account"
      supportingLabel="Almost there"
      supportingDescription="Bid360 keeps new pilot accounts protected by confirming email ownership before the first sign-in."
      highlights={HIGHLIGHTS}
    >
      <div className="app-surface rounded-[24px] p-5 sm:p-6">
        {deliveryFailed ? (
          <div className="rounded-lg border border-var(--danger-500)/20 bg-var(--danger-500)/8 px-4 py-3 text-sm leading-7 text-var(--danger-600)" role="alert">
            Your account was created, but the verification email could not be sent. Try resending below, and contact support if the problem continues.
          </div>
        ) : (
          <p className="text-sm leading-7 text-var(--foreground-secondary)">
            We&apos;ve sent a verification link to your inbox. Click it to activate your Bid360 account. The link expires in 24 hours.
          </p>
        )}

        <div className="mt-6">
          <VerificationResendForm initialEmail={email} />
        </div>
      </div>
    </AuthShell>
  )
}
