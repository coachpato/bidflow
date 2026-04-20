import Link from 'next/link'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'
import prisma from '@/lib/prisma'
import { getOrganizationContextFromSession } from '@/lib/organization'
import { requireAuth } from '@/lib/session'

function formatShortDate(value) {
  if (!value) return 'No date'
  return new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

export default async function DashboardPage() {
  const session = await requireAuth()
  const organizationContext = await getOrganizationContextFromSession(session)
  const organizationId = organizationContext.organization.id
  const now = new Date()
  const pursuitCutoff = new Date(now)
  pursuitCutoff.setDate(pursuitCutoff.getDate() + 14)
  const reminderCutoff = new Date(now)
  reminderCutoff.setDate(reminderCutoff.getDate() + 30)

  const [
    opportunitiesCount,
    activePursuitsCount,
    submittedPursuitsCount,
    appointmentsCount,
    openChallengesCount,
    unreadInboxCount,
    opportunitiesToReview,
    pursuitsDueSoon,
    appointmentReminders,
    challengeDeadlines,
  ] = await prisma.$transaction([
    prisma.opportunity.count({
      where: {
        organizationId,
        status: { in: ['New', 'Watch', 'Pursue'] },
      },
    }),
    prisma.tender.count({
      where: {
        organizationId,
        status: { in: ['New', 'Under Review', 'In Progress'] },
      },
    }),
    prisma.tender.count({
      where: {
        organizationId,
        status: 'Submitted',
      },
    }),
    prisma.contract.count({
      where: { organizationId },
    }),
    prisma.appeal.count({
      where: {
        organizationId,
        status: { in: ['Pending', 'Submitted'] },
      },
    }),
    prisma.notification.count({
      where: {
        read: false,
        OR: [
          { userId: session.userId },
          { userId: null, organizationId },
        ],
      },
    }),
    prisma.opportunity.findMany({
      where: {
        organizationId,
        status: { in: ['New', 'Watch', 'Pursue'] },
      },
      orderBy: [
        { deadline: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
      take: 5,
      select: {
        id: true,
        title: true,
        entity: true,
        deadline: true,
        status: true,
      },
    }),
    prisma.tender.findMany({
      where: {
        organizationId,
        status: { in: ['New', 'Under Review', 'In Progress', 'Submitted'] },
        deadline: {
          gte: now,
          lte: pursuitCutoff,
        },
      },
      orderBy: [{ deadline: 'asc' }],
      take: 5,
      select: {
        id: true,
        title: true,
        entity: true,
        deadline: true,
        status: true,
      },
    }),
    prisma.contract.findMany({
      where: {
        organizationId,
        OR: [
          {
            nextFollowUpAt: {
              gte: now,
              lte: reminderCutoff,
            },
          },
          {
            endDate: {
              gte: now,
              lte: reminderCutoff,
            },
          },
        ],
      },
      orderBy: [
        { nextFollowUpAt: { sort: 'asc', nulls: 'last' } },
        { endDate: { sort: 'asc', nulls: 'last' } },
      ],
      take: 5,
      select: {
        id: true,
        title: true,
        client: true,
        appointmentStatus: true,
        nextFollowUpAt: true,
        endDate: true,
      },
    }),
    prisma.appeal.findMany({
      where: {
        organizationId,
        status: { in: ['Pending', 'Submitted'] },
        deadline: {
          not: null,
        },
      },
      orderBy: [{ deadline: 'asc' }],
      take: 5,
      select: {
        id: true,
        reason: true,
        deadline: true,
        status: true,
        tender: {
          select: {
            title: true,
            entity: true,
          },
        },
      },
    }),
  ])

  const stats = [
    { label: 'Opportunities', value: opportunitiesCount, href: '/opportunities', tone: 'text-teal-700' },
    { label: 'Active pursuits', value: activePursuitsCount, href: '/pursuits?status=active', tone: 'text-[var(--brand-500)]' },
    { label: 'Submitted', value: submittedPursuitsCount, href: '/pursuits?status=Submitted', tone: 'text-slate-900' },
    { label: 'Appointments', value: appointmentsCount, href: '/appointments', tone: 'text-emerald-700' },
    { label: 'Open challenges', value: openChallengesCount, href: '/challenges', tone: 'text-amber-700' },
    { label: 'Inbox unread', value: unreadInboxCount, href: '/inbox', tone: 'text-slate-900' },
  ]

  return (
    <div className="space-y-6">
      <Header
        title="Tender 360 desk"
        eyebrow="Bid360"
        primaryAction={{ href: '/opportunities', label: 'Open opportunities' }}
        secondaryAction={{ href: '/pursuits/new', label: 'New pursuit' }}
        meta={[
          { label: 'Firm', value: organizationContext.organization.name },
          { label: 'Opportunities', value: `${opportunitiesCount}` },
          { label: 'Active pursuits', value: `${activePursuitsCount}` },
          { label: 'Appointments', value: `${appointmentsCount}` },
          { label: 'Challenges', value: `${openChallengesCount}` },
          { label: 'Inbox unread', value: `${unreadInboxCount}` },
        ]}
      />

      <div className="app-page space-y-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stats.map(stat => (
            <Link key={stat.label} href={stat.href} className="group app-surface rounded-[24px] p-5">
              <p className="text-sm font-semibold text-slate-500">{stat.label}</p>
              <p className={`app-data mt-3 text-4xl font-semibold tracking-tight ${stat.tone}`}>{stat.value}</p>
            </Link>
          ))}
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="app-surface rounded-[24px] p-5 sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Opportunity review queue</h2>
              <Link href="/opportunities" className="app-button-secondary self-start">Open opportunities</Link>
            </div>

            {opportunitiesToReview.length === 0 ? (
              <EmptyState message="No opportunities are waiting for review right now." />
            ) : (
              <div className="space-y-3">
                {opportunitiesToReview.map(opportunity => (
                  <Link
                    key={opportunity.id}
                    href={`/opportunities/${opportunity.id}`}
                    className="flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-white/90 p-4 hover:border-[rgba(23,125,109,0.24)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{opportunity.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{opportunity.entity}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                      {opportunity.deadline ? (
                        <span className="app-data rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                          Due {formatShortDate(opportunity.deadline)}
                        </span>
                      ) : null}
                      <StatusBadge status={opportunity.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="app-surface rounded-[24px] p-5 sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Pursuits due soon</h2>
              <Link href="/pursuits" className="app-button-secondary self-start">Open pursuits</Link>
            </div>

            {pursuitsDueSoon.length === 0 ? (
              <EmptyState message="No pursuit deadlines are coming up in the next 14 days." />
            ) : (
              <div className="space-y-3">
                {pursuitsDueSoon.map(tender => (
                  <Link
                    key={tender.id}
                    href={`/pursuits/${tender.id}`}
                    className="block rounded-[20px] border border-slate-200 bg-white/90 p-4 hover:border-[rgba(13,103,181,0.26)]"
                  >
                    <p className="text-sm font-semibold text-slate-900">{tender.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{tender.entity}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                        Due {formatShortDate(tender.deadline)}
                      </span>
                      <StatusBadge status={tender.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="app-surface rounded-[24px] p-5 sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Appointment follow-ups</h2>
              <Link href="/appointments" className="app-button-secondary self-start">Open appointments</Link>
            </div>

            {appointmentReminders.length === 0 ? (
              <EmptyState message="No appointment follow-ups are due in the next 30 days." />
            ) : (
              <div className="space-y-3">
                {appointmentReminders.map(contract => (
                  <Link
                    key={contract.id}
                    href={`/appointments/${contract.id}`}
                    className="block rounded-[20px] border border-slate-200 bg-white/90 p-4 hover:border-emerald-200"
                  >
                    <p className="text-sm font-semibold text-slate-900">{contract.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{contract.client || 'No client saved'}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {contract.nextFollowUpAt ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Follow up {formatShortDate(contract.nextFollowUpAt)}
                        </span>
                      ) : null}
                      {contract.endDate ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          Ends {formatShortDate(contract.endDate)}
                        </span>
                      ) : null}
                      <StatusBadge status={contract.appointmentStatus || 'Appointed'} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="app-surface rounded-[24px] p-5 sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Challenge deadlines</h2>
              <Link href="/challenges" className="app-button-secondary self-start">Open challenges</Link>
            </div>

            {challengeDeadlines.length === 0 ? (
              <EmptyState message="No challenge deadlines are active right now." />
            ) : (
              <div className="space-y-3">
                {challengeDeadlines.map(challenge => (
                  <Link
                    key={challenge.id}
                    href={`/challenges/${challenge.id}`}
                    className="block rounded-[20px] border border-slate-200 bg-white/90 p-4 hover:border-amber-200"
                  >
                    <p className="text-sm font-semibold text-slate-900">{challenge.reason}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {challenge.tender?.entity || 'Unlinked challenge'}{challenge.tender?.title ? ` | ${challenge.tender.title}` : ''}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        Due {formatShortDate(challenge.deadline)}
                      </span>
                      <StatusBadge status={challenge.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="rounded-[20px] bg-slate-50 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{message}</p>
    </div>
  )
}
