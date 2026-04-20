import prisma from '@/lib/prisma'
import AuthShell from '@/app/components/AuthShell'
import RegisterForm from './RegisterForm'
import { isPublicRegistrationEnabled } from '@/lib/env'

export const dynamic = 'force-dynamic'

const HIGHLIGHTS = [
  {
    title: 'Start with the right sector',
    body: 'Set up Bid360 for the built environment, legal, or accounting from day one.',
  },
  {
    title: 'Run the full loop',
    body: 'Discover, pursue, back up submissions, then manage awards or challenges.',
  },
  {
    title: 'Keep handovers clean',
    body: 'Assignments, dates, and reminders make the workload obvious.',
  },
]

export default async function RegisterPage() {
  const userCount = await prisma.user.count()
  const isBootstrapMode = userCount === 0
  const publicRegistrationEnabled = isPublicRegistrationEnabled()
  const canSelfRegister = isBootstrapMode || publicRegistrationEnabled

  return (
    <AuthShell
      title={isBootstrapMode ? 'Create your Bid360 workspace' : canSelfRegister ? 'Create your Bid360 account' : 'Registration is closed'}
      description={
        isBootstrapMode
          ? 'Set up the first account and workspace'
          : canSelfRegister
            ? 'Join with a new workspace for your team'
            : 'Online self-registration is currently disabled for this workspace.'
      }
      supportingLabel={isBootstrapMode ? 'Workspace setup' : canSelfRegister ? 'Built environment, legal, accounting' : 'Bid360 access'}
      supportingDescription={
        isBootstrapMode
          ? 'Create the first admin account and choose whether the workspace is for the built environment, legal, or accounting.'
          : canSelfRegister
            ? 'Create a new Bid360 workspace for your built-environment, legal, or accounting team.'
            : 'Ask your administrator to create your account or temporarily enable public registration.'
      }
      highlights={HIGHLIGHTS}
    >
      {canSelfRegister ? (
        <RegisterForm isBootstrapMode={isBootstrapMode} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Online self-registration is currently disabled for this workspace.
          </div>
          <p className="text-sm leading-7 text-slate-600">
            Ask your administrator to create your account or temporarily enable public registration.
          </p>
        </div>
      )}
    </AuthShell>
  )
}
