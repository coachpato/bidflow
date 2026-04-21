import Link from 'next/link'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'
import EmptyState from '@/app/components/EmptyState'
import prisma from '@/lib/prisma'
import { getOrganizationContextFromSession } from '@/lib/organization'
import { requireAuth } from '@/lib/session'

function formatShortDate(value) {
  if (!value) return 'No date'
  return new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

function getDeadlineColor(deadline) {
  if (!deadline) return 'app-badge-info'
  const daysUntil = Math.ceil((deadline - new Date()) / (1000 * 60 * 60 * 24))
  if (daysUntil <= 3) return 'app-badge-danger'
  if (daysUntil <= 7) return 'app-badge-warning'
  return 'app-badge-info'
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
    {
      label: 'Opportunities',
      value: opportunitiesCount,
      href: '/opportunities',
      icon: '🎯',
      description: 'Opportunities waiting review'
    },
    {
      label: 'Active pursuits',
      value: activePursuitsCount,
      href: '/pursuits?status=active',
      icon: '🚀',
      description: 'In progress and tracking'
    },
    {
      label: 'Submitted',
      value: submittedPursuitsCount,
      href: '/pursuits?status=Submitted',
      icon: '✓',
      description: 'Awaiting feedback'
    },
    {
      label: 'Appointments',
      value: appointmentsCount,
      href: '/appointments',
      icon: '📅',
      description: 'Active contracts'
    },
    {
      label: 'Open challenges',
      value: openChallengesCount,
      href: '/challenges',
      icon: '⚠️',
      description: 'Requiring action'
    },
    {
      label: 'Inbox unread',
      value: unreadInboxCount,
      href: '/inbox',
      icon: '📬',
      description: 'Unread messages'
    },
  ]

  return (
    <div className="space-y-6">
      <Header
        title="Dashboard"
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

      <div className="app-page space-y-8">
        {/* Key Metrics */}
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading" className="sr-only">Key Metrics</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.map(stat => (
              <Link
                key={stat.label}
                href={stat.href}
                className="app-card interactive group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-var(--muted)">
                      {stat.label}
                    </p>
                    <p className="app-data mt-3 text-4xl font-bold text-var(--foreground)">
                      {stat.value}
                    </p>
                    <p className="mt-2 text-xs text-var(--foreground-secondary)">
                      {stat.description}
                    </p>
                  </div>
                  <span className="text-3xl opacity-20 group-hover:opacity-30 transition">
                    {stat.icon}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Main Dashboard Grid */}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Opportunities Section */}
          <section className="app-card" aria-labelledby="opp-heading">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-var(--line)">
              <h2 id="opp-heading" className="text-xl font-bold text-var(--foreground)">
                Opportunity Review Queue
              </h2>
              <Link
                href="/opportunities"
                className="app-button-secondary app-button-sm"
              >
                View all
              </Link>
            </div>

            {opportunitiesToReview.length === 0 ? (
              <EmptyState
                icon="🎯"
                title="No opportunities to review"
                description="Check back soon for new opportunities matching your criteria."
                actionText="Explore opportunities"
                actionHref="/opportunities"
              />
            ) : (
              <div className="space-y-3">
                {opportunitiesToReview.map(opportunity => (
                  <Link
                    key={opportunity.id}
                    href={`/opportunities/${opportunity.id}`}
                    className="group block p-4 rounded-xl border border-var(--line) hover:border-var(--brand-500) hover:bg-var(--background-muted) transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-var(--foreground) group-hover:text-var(--brand-600) transition truncate">
                          {opportunity.title}
                        </p>
                        <p className="mt-1 text-sm text-var(--muted) truncate">
                          {opportunity.entity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={opportunity.status} />
                      </div>
                    </div>
                    {opportunity.deadline && (
                      <p className="mt-3 text-xs text-var(--foreground-secondary)">
                        ⏰ Due {formatShortDate(opportunity.deadline)}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Pursuits Section */}
          <section className="app-card" aria-labelledby="pursuits-heading">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-var(--line)">
              <h2 id="pursuits-heading" className="text-xl font-bold text-var(--foreground)">
                Pursuits Due Soon
              </h2>
              <Link
                href="/pursuits"
                className="app-button-secondary app-button-sm"
              >
                View all
              </Link>
            </div>

            {pursuitsDueSoon.length === 0 ? (
              <EmptyState
                icon="🚀"
                title="No deadlines coming up"
                description="No pursuit deadlines in the next 14 days."
                actionText="Manage pursuits"
                actionHref="/pursuits"
              />
            ) : (
              <div className="space-y-3">
                {pursuitsDueSoon.map(tender => (
                  <Link
                    key={tender.id}
                    href={`/pursuits/${tender.id}`}
                    className="group block p-4 rounded-xl border border-var(--line) hover:border-var(--brand-500) hover:bg-var(--background-muted) transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-var(--foreground) group-hover:text-var(--brand-600) transition truncate">
                          {tender.title}
                        </p>
                        <p className="mt-1 text-sm text-var(--muted) truncate">
                          {tender.entity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={tender.status} />
                      </div>
                    </div>
                    {tender.deadline && (
                      <p className="mt-3 text-xs text-var(--foreground-secondary)">
                        ⏰ Due {formatShortDate(tender.deadline)}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Bottom Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Appointments Section */}
          <section className="app-card" aria-labelledby="apt-heading">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-var(--line)">
              <h2 id="apt-heading" className="text-xl font-bold text-var(--foreground)">
                Appointment Follow-ups
              </h2>
              <Link
                href="/appointments"
                className="app-button-secondary app-button-sm"
              >
                View all
              </Link>
            </div>

            {appointmentReminders.length === 0 ? (
              <EmptyState
                icon="📅"
                title="No follow-ups due"
                description="No appointment follow-ups in the next 30 days."
                actionText="Manage appointments"
                actionHref="/appointments"
              />
            ) : (
              <div className="space-y-3">
                {appointmentReminders.map(contract => (
                  <Link
                    key={contract.id}
                    href={`/appointments/${contract.id}`}
                    className="group block p-4 rounded-xl border border-var(--line) hover:border-var(--success-500) hover:bg-var(--background-muted) transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-var(--foreground) group-hover:text-var(--success-600) transition truncate">
                          {contract.title}
                        </p>
                        <p className="mt-1 text-sm text-var(--muted) truncate">
                          {contract.client || 'Unassigned client'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={contract.appointmentStatus || 'Appointed'} />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {contract.nextFollowUpAt && (
                        <p className="text-xs text-var(--foreground-secondary)">
                          📞 Follow up {formatShortDate(contract.nextFollowUpAt)}
                        </p>
                      )}
                      {contract.endDate && (
                        <p className="text-xs text-var(--foreground-secondary)">
                          📌 Ends {formatShortDate(contract.endDate)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Challenges Section */}
          <section className="app-card" aria-labelledby="chal-heading">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-var(--line)">
              <h2 id="chal-heading" className="text-xl font-bold text-var(--foreground)">
                Challenge Deadlines
              </h2>
              <Link
                href="/challenges"
                className="app-button-secondary app-button-sm"
              >
                View all
              </Link>
            </div>

            {challengeDeadlines.length === 0 ? (
              <EmptyState
                icon="✓"
                title="No active challenges"
                description="No challenge deadlines to manage right now."
                actionText="View challenges"
                actionHref="/challenges"
              />
            ) : (
              <div className="space-y-3">
                {challengeDeadlines.map(challenge => (
                  <Link
                    key={challenge.id}
                    href={`/challenges/${challenge.id}`}
                    className="group block p-4 rounded-xl border border-var(--line) hover:border-var(--warning-500) hover:bg-var(--background-muted) transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-var(--foreground) group-hover:text-var(--warning-600) transition truncate">
                          {challenge.reason}
                        </p>
                        <p className="mt-1 text-sm text-var(--muted) truncate">
                          {challenge.tender?.entity || 'Unlinked challenge'}
                          {challenge.tender?.title && ` • ${challenge.tender.title}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={challenge.status} />
                      </div>
                    </div>
                    {challenge.deadline && (
                      <p className="mt-3 text-xs text-var(--foreground-secondary)">
                        ⏰ Due {formatShortDate(challenge.deadline)}
                      </p>
                    )}
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
