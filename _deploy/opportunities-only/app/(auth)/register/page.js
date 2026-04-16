import prisma from '@/lib/prisma'
import AuthShell from '@/app/components/AuthShell'
import RegisterForm from './RegisterForm'

export const dynamic = 'force-dynamic'

const HIGHLIGHTS = [
  {
    title: 'Start with one source of truth',
    body: 'Capture tenders, contracts, and linked files in one place.',
  },
  {
    title: 'Carry work into contracts',
    body: 'Keep awarded matters visible after the tender is closed.',
  },
  {
    title: 'Keep handovers clean',
    body: 'Assignments and inbox updates make the workload obvious.',
  },
]

export default async function RegisterPage() {
  const userCount = await prisma.user.count()
  const isBootstrapMode = userCount === 0

  return (
    <AuthShell
      title="Create your workspace access"
      description={isBootstrapMode ? 'Set up the first account' : 'Online self-registration is currently disabled for this workspace.'}
      supportingLabel={isBootstrapMode ? 'Workspace setup' : 'Get your team into BidFlow'}
      supportingDescription={
        isBootstrapMode
          ? 'Create the first admin account to open the workspace.'
          : 'Ask your administrator to create your account or temporarily enable public registration.'
      }
      highlights={HIGHLIGHTS}
    >
      {isBootstrapMode ? (
        <RegisterForm />
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
