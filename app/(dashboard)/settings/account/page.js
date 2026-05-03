import { redirect } from 'next/navigation'
import Header from '@/app/components/Header'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/session'
import AccountForm from './AccountForm'

export default async function AccountPage() {
  const session = await requireAuth()

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  })

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="space-y-6">
      <Header
        title="Account"
        eyebrow="Personal settings"
        secondaryAction={{ href: '/dashboard', label: 'Back to dashboard' }}
        meta={[
          { label: 'Email', value: user.email },
          { label: 'Role', value: user.role },
        ]}
      />

      <div className="app-page">
        <AccountForm user={user} />
      </div>
    </div>
  )
}
