import TopNav from '@/app/components/TopNav'
import { getOrganizationContextFromSession, isOrganizationSetupComplete } from '@/lib/organization'
import { requireAuth } from '@/lib/session'
import { redirect } from 'next/navigation'

// Disable static pre-rendering since TopNav uses client-side context
export const dynamic = 'force-dynamic'

// This layout wraps every page inside the dashboard (tenders, contracts, etc.)
export default async function DashboardLayout({ children }) {
  const session = await requireAuth()
  const organizationContext = await getOrganizationContextFromSession(session)

  if (session.role === 'admin' && !isOrganizationSetupComplete(organizationContext)) {
    redirect('/settings')
  }

  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="pb-8">{children}</main>
    </div>
  )
}
