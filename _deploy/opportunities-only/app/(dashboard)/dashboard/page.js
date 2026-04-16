import Link from 'next/link'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/session'

const DEADLINE_WARNING_DAYS = 14
const CONTRACT_EXPIRY_WARNING_DAYS = 30
const OPPORTUNITY_WARNING_DAYS = 10

function addDays(date, days) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function formatShortDate(value) {
  return new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

export default async function DashboardPage() {
  const session = await requireAuth()

  const now = new Date()
  const legacyAssigneeTokens = [session.email, session.name].filter(Boolean)
  const myAssignmentWhere = legacyAssigneeTokens.length > 0
    ? {
        OR: [
          { assignedUserId: session.userId },
          { assignedUserId: null, assignedTo: { in: legacyAssigneeTokens } },
        ],
      }
    : { assignedUserId: session.userId }

  const [
    activeTenders,
    submittedTenders,
    awardedTenders,
    lostTenders,
    pendingAppeals,
    expiringContracts,
    upcomingDeadlines,
    myTenders,
    myContracts,
    opportunityQueueCount,
    highFitOpportunityCount,
    opportunitiesToReview,
    unreadNotifications,
  ] = await Promise.all([
    prisma.tender.count({ where: { status: { in: ['New', 'Under Review', 'In Progress'] } } }),
    prisma.tender.count({ where: { status: 'Submitted' } }),
    prisma.tender.count({ where: { status: 'Awarded' } }),
    prisma.tender.count({ where: { status: 'Lost' } }),
    prisma.appeal.count({ where: { status: 'Pending' } }),
    prisma.contract.findMany({
      where: {
        endDate: { gte: now, lte: addDays(now, CONTRACT_EXPIRY_WARNING_DAYS) },
      },
      select: { id: true, title: true, client: true, endDate: true },
      orderBy: { endDate: 'asc' },
      take: 5,
    }),
    prisma.tender.findMany({
      where: {
        deadline: { gte: now, lte: addDays(now, DEADLINE_WARNING_DAYS) },
        status: { notIn: ['Submitted', 'Awarded', 'Lost', 'Cancelled'] },
      },
      select: { id: true, title: true, entity: true, deadline: true, status: true },
      orderBy: { deadline: 'asc' },
      take: 5,
    }),
    prisma.tender.count({
      where: {
        AND: [
          myAssignmentWhere,
          { status: { in: ['New', 'Under Review', 'In Progress', 'Submitted'] } },
        ],
      },
    }),
    prisma.contract.count({ where: myAssignmentWhere }),
    prisma.opportunity.count({
      where: { status: { in: ['New', 'Reviewing', 'Pursue'] } },
    }),
    prisma.opportunity.count({
      where: {
        status: { in: ['New', 'Reviewing', 'Pursue'] },
        fitScore: { gte: 70 },
      },
    }),
    prisma.opportunity.findMany({
      where: { status: { in: ['New', 'Reviewing', 'Pursue'] } },
      select: {
        id: true,
        title: true,
        entity: true,
        deadline: true,
        fitScore: true,
        status: true,
      },
      orderBy: [{ deadline: 'asc' }, { fitScore: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }),
    prisma.notification.count({
      where: {
        read: false,
        OR: [{ userId: session.userId }, { userId: null }],
      },
    }),
  ])

  const stats = [
    { label: 'Active tenders', value: activeTenders, tone: 'text-[var(--brand-500)]', href: '/tenders?status=active' },
    { label: 'My work', value: myTenders + myContracts, tone: 'text-slate-900', href: '/my-work' },
    { label: 'Opportunities', value: opportunityQueueCount, tone: 'text-teal-700', href: '/opportunities' },
    { label: 'Submitted', value: submittedTenders, tone: 'text-violet-700', href: '/tenders?status=Submitted' },
    { label: 'Awarded', value: awardedTenders, tone: 'text-emerald-700', href: '/tenders?status=Awarded' },
    { label: 'Lost', value: lostTenders, tone: 'text-rose-700', href: '/tenders?status=Lost' },
    { label: 'Pending appeals', value: pendingAppeals, tone: 'text-amber-700', href: '/appeals' },
    { label: 'Contracts expiring', value: expiringContracts.length, tone: 'text-cyan-700', href: '/contracts' },
  ]

  const dueSoonOpportunities = opportunitiesToReview.filter(opportunity => {
    if (!opportunity.deadline) return false
    return opportunity.deadline >= now && opportunity.deadline <= addDays(now, OPPORTUNITY_WARNING_DAYS)
  }).length

  return (
    <div className="space-y-6">
      <Header
        title="Operations dashboard"
        eyebrow="Workspace overview"
        primaryAction={{ href: '/opportunities/new', label: 'Capture opportunity' }}
        secondaryAction={{ href: '/tenders/new', label: 'New tender' }}
        meta={[
          { label: 'Inbox unread', value: `${unreadNotifications}` },
          { label: 'Assigned to you', value: `${myTenders + myContracts}` },
          { label: 'Opportunity queue', value: `${opportunityQueueCount}` },
          { label: 'Deadlines soon', value: `${upcomingDeadlines.length}` },
          { label: 'Expiring contracts', value: `${expiringContracts.length}` },
        ]}
      />

      <div className="app-page space-y-6">
        <Link
          href="/my-work"
          className="app-surface flex items-center justify-between gap-4 rounded-[24px] p-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900">My Work</h2>
            <p className="mt-1 text-sm text-slate-500">
              {myTenders + myContracts > 0
                ? `${myTenders} tender${myTenders === 1 ? '' : 's'} and ${myContracts} contract${myContracts === 1 ? '' : 's'} are allocated to you.`
                : 'Nothing is allocated to you yet.'}
            </p>
          </div>
          <span className="app-button-secondary whitespace-nowrap">Open my work</span>
        </Link>

        <Link
          href="/opportunities"
          className="app-surface flex items-center justify-between gap-4 rounded-[24px] p-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Opportunities</h2>
            <p className="mt-1 text-sm text-slate-500">
              {opportunityQueueCount > 0
                ? `${opportunityQueueCount} in review, ${highFitOpportunityCount} high-fit, ${dueSoonOpportunities} closing soon.`
                : 'No opportunities have been captured yet.'}
            </p>
          </div>
          <span className="app-button-secondary whitespace-nowrap">Open opportunities</span>
        </Link>

        {unreadNotifications > 0 && (
          <Link
            href="/inbox"
            className="app-surface flex items-center justify-between gap-4 rounded-[24px] border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.9))] p-5"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              {unreadNotifications} unread notification{unreadNotifications === 1 ? '' : 's'}
            </h2>
            <span className="app-button-secondary whitespace-nowrap border-amber-200 bg-white">
              Open inbox
            </span>
          </Link>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {stats.map(stat => (
            <Link key={stat.label} href={stat.href} className="group app-surface rounded-[24px] p-5">
              <p className="text-sm font-semibold text-slate-500">{stat.label}</p>
              <p className={`app-data mt-3 text-4xl font-semibold tracking-tight ${stat.tone}`}>{stat.value}</p>
            </Link>
          ))}
        </section>

        <section className="app-surface rounded-[24px] p-5 sm:p-6">
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Opportunity queue</h2>
            <Link href="/opportunities" className="app-button-secondary self-start">Open opportunities</Link>
          </div>

          {opportunitiesToReview.length === 0 ? (
            <div className="rounded-[20px] bg-slate-50 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">No opportunities waiting for review.</p>
            </div>
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
                    {opportunity.fitScore !== null && opportunity.fitScore !== undefined ? (
                      <span className="app-data rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                        Fit {opportunity.fitScore}/100
                      </span>
                    ) : null}
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

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
          <section className="app-surface rounded-[24px] p-5 sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Next 14 days</h2>
              <Link href="/tenders" className="app-button-secondary self-start">View tenders</Link>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <div className="rounded-[20px] bg-slate-50 px-5 py-10 text-center">
                <p className="text-sm font-semibold text-slate-700">No looming tender deadlines.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map(tender => (
                  <Link
                    key={tender.id}
                    href={`/tenders/${tender.id}`}
                    className="flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-white/90 p-4 hover:border-[rgba(13,103,181,0.26)] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{tender.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{tender.entity}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                      <span className="app-data rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                        Due {formatShortDate(tender.deadline)}
                      </span>
                      <StatusBadge status={tender.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="app-surface rounded-[24px] p-5 sm:p-6">
            <div className="mb-5 border-b border-slate-100 pb-4">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Expiring agreements</h2>
            </div>

            {expiringContracts.length === 0 ? (
              <div className="rounded-[20px] bg-slate-50 px-5 py-10 text-center">
                <p className="text-sm font-semibold text-slate-700">Nothing expires in the next 30 days.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expiringContracts.map(contract => (
                  <Link
                    key={contract.id}
                    href={`/contracts/${contract.id}`}
                    className="block rounded-[20px] border border-slate-200 bg-white/90 p-4 hover:border-amber-200"
                  >
                    <p className="text-sm font-semibold text-slate-900">{contract.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{contract.client}</p>
                    <div className="mt-3 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      Ends {formatShortDate(contract.endDate)}
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
