import { redirect } from 'next/navigation'
import Header from '@/app/components/Header'
import prisma from '@/lib/prisma'
import { getOrganizationContextFromSession } from '@/lib/organization'
import { getServiceSectorLabels } from '@/lib/service-sectors'
import { requireAuth } from '@/lib/session'
import FirmProfileForm from '../firm/FirmProfileForm'
import TeamInviteManager from '@/app/settings/TeamInviteManager'

function formatSectors(profile) {
  const labels = getServiceSectorLabels(profile?.serviceSectors)
  if (labels.length > 0) return labels.join(', ')
  return 'Not set'
}

export default async function SettingsPage() {
  const session = await requireAuth()

  if (session.role !== 'admin') {
    redirect('/dashboard')
  }

  const organizationContext = await getOrganizationContextFromSession(session)
  const organizationId = organizationContext.organization.id

  const [memberships, invites] = await prisma.$transaction([
    prisma.membership.findMany({
      where: { organizationId },
      orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    prisma.teamInvite.findMany({
      where: {
        organizationId,
        status: 'pending',
      },
      orderBy: { invitedAt: 'desc' },
    }),
  ])

  return (
    <div className="space-y-6">
      <Header
        title="Settings"
        eyebrow="Admin control"
        secondaryAction={{ href: '/dashboard', label: 'Back to dashboard' }}
        meta={[
          { label: 'Firm', value: organizationContext.organization.name },
          { label: 'Sectors', value: formatSectors(organizationContext.firmProfile) },
          { label: 'Members', value: `${memberships.length}` },
          { label: 'Pending invites', value: `${invites.length}` },
        ]}
      />

      <div className="app-page space-y-6">
        <section className="app-surface rounded-[24px] p-5 sm:p-6">
          <div className="border-b border-slate-100 pb-4">
            <p className="app-kicker">Admin-first setup</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Firm profile</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Define the firm name and the sectors that control the Bid360 opportunity radar. This route is reserved for admins because these choices affect the whole workspace.
            </p>
          </div>

          <div className="mt-6">
            <FirmProfileForm initialProfile={organizationContext.firmProfile} />
          </div>
        </section>

        <TeamInviteManager members={memberships} initialInvites={invites} />
      </div>
    </div>
  )
}
