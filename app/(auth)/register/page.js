import prisma from '@/lib/prisma'
import AuthShell from '@/app/components/AuthShell'
import RegisterForm from './RegisterForm'
import { isPublicRegistrationEnabled } from '@/lib/env'

export const dynamic = 'force-dynamic'

const HIGHLIGHTS = [
  {
    title: 'Start with the right sector',
    body: 'Set up Bid360 for built environment, legal services, finance, or green energy from day one.',
  },
  {
    title: 'Run the full loop',
    body: 'Discover, pursue, back up submissions, then manage awards or appeals.',
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
      supportingLabel={isBootstrapMode ? 'Workspace setup' : canSelfRegister ? 'Built environment, legal, finance, energy' : 'Bid360 access'}
      supportingDescription={
        isBootstrapMode
          ? 'Create the first admin account and define the firm sectors that will drive the opportunity radar.'
          : canSelfRegister
            ? 'Create a new Bid360 workspace for your built-environment, legal, financial-services, or green-energy team.'
            : 'Ask your administrator to create your account or temporarily enable public registration.'
      }
      highlights={HIGHLIGHTS}
    >
      {canSelfRegister ? (
        <RegisterForm isBootstrapMode={isBootstrapMode} />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-5">
          <p className="text-sm font-semibold text-amber-900">Registration is currently closed</p>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Ask your administrator to create your account or temporarily enable public registration.
          </p>
        </div>
      )}
    </AuthShell>
  )
}
