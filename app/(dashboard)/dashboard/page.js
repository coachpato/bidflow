import Link from 'next/link'
import { after } from 'next/server'
import EmailTestCard from '@/app/components/EmailTestCard'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
import { syncComplianceExpiryNotificationsIfNeeded } from '@/lib/compliance-documents'
import { getCachedDashboardOrganizationData, getCachedDashboardUserData } from '@/lib/dashboard-read-model'
import { isEmailConfigured } from '@/lib/email'
import { getCachedPilotLeadCount } from '@/lib/pilot-leads-read-model'
import { getOrganizationContextFromSession } from '@/lib/organization'
import { requireAuth } from '@/lib/session'

function formatShortDate(value) {
  return new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

export default async function DashboardPage() {
  const session = await requireAuth()
  const organizationContext = await getOrganizationContextFromSession(session)
  const organizationId = organizationContext.organization.id
  after(async () => {
    const syncedDocuments = await syncComplianceExpiryNotificationsIfNeeded(organizationId)
    if (syncedDocuments) {
      await expireCacheTags(dashboardCacheTag(organizationId))
    }
  })

  const legacyAssigneeTokens = [session.email, session.name].filter(Boolean)

  const [
    organizationDashboardData,
    userDashboardData,
  ] = await Promise.all([
    getCachedDashboardOrganizationData(organizationId),
    getCachedDashboardUserData({
      organizationId,
      userId: session.userId,
      legacyAssigneeTokens,
    }),
  ])

  const pilotLeadCount = session.role === 'admin'
    ? await getCachedPilotLeadCount()
    : 0
  const summary = {
    ...(organizationDashboardData.summary || {}),
    ...(userDashboardData || {}),
  }
  const upcomingDeadlines = organizationDashboardData.upcomingDeadlines || []
  const expiringContracts = organizationDashboardData.expiringContracts || []
  const opportunitiesToReview = organizationDashboardData.opportunitiesToReview || []
  const expiringComplianceDocuments = organizationDashboardData.expiringComplianceDocuments || []
  const activeTenders = summary.activeTenders || 0
  const submittedTenders = summary.submittedTenders || 0
  const awardedTenders = summary.awardedTenders || 0
  const lostTenders = summary.lostTenders || 0
  const myTenders = summary.myTenders || 0
  const myContracts = summary.myContracts || 0
  const expiringContractsCount = summary.expiringContractsCount || 0
  const opportunityQueueCount = summary.opportunityQueueCount || 0
  const highFitOpportunityCount = summary.highFitOpportunityCount || 0
  const dueSoonOpportunities = summary.dueSoonOpportunities || 0
  const pendingAppeals = summary.pendingAppeals || 0
  const unreadNotifications = summary.unreadNotifications || 0
  const teamMemberCount = summary.teamMemberCount || 0
  const expiringComplianceCount = expiringComplianceDocuments.length

  const firmProfileStatus = (organizationContext.firmProfile?.practiceAreas?.length || 0) > 0 ||
    organizationContext.firmProfile?.overview
    ? 'Started'
    : 'Needs setup'

  const stats = [
    { label: 'Active pursuits', value: activeTenders, tone: 'text-[var(--brand-500)]', href: '/pursuits?status=active' },
    { label: 'My work', value: myTenders + myContracts, tone: 'text-slate-900', href: '/my-work' },
    { label: 'Opportunities', value: opportunityQueueCount, tone: 'text-teal-700', href: '/opportunities' },
    { label: 'Submitted', value: submittedTenders, tone: 'text-violet-700', href: '/pursuits?status=Submitted' },
    { label: 'Appointed', value: awardedTenders, tone: 'text-emerald-700', href: '/pursuits?status=Awarded' },
    { label: 'Lost', value: lostTenders, tone: 'text-rose-700', href: '/pursuits?status=Lost' },
    { label: 'Active challenges', value: pendingAppeals, tone: 'text-amber-700', href: '/challenges' },
    { label: 'Appointments ending', value: expiringContractsCount, tone: 'text-cyan-700', href: '/appointments' },
    { label: 'Compliance alerts', value: expiringComplianceCount, tone: 'text-indigo-700', href: '/vault' },
  ]

  if (session.role === 'admin') {
    stats.splice(2, 0, {
      label: 'Pilot requests',
      value: pilotLeadCount,
      tone: 'text-[var(--accent-500)]',
      href: '/launch-interest',
    })
  }

  return (
    <div className="space-y-6">
      <Header
        title="Daily desk"
        eyebrow="Bidflow V2"
        primaryAction={{ href: '/opportunities/new', label: 'Capture opportunity' }}
        secondaryAction={{ href: '/pursuits/new', label: 'New pursuit' }}
        meta={[
          { label: 'Firm', value: organizationContext.organization.name },
          { label: 'Team', value: `${teamMemberCount}` },
          { label: 'Profile', value: firmProfileStatus },
          { label: 'Inbox unread', value: `${unreadNotifications}` },
          { label: 'Assigned to you', value: `${myTenders + myContracts}` },
          { label: 'Opportunity queue', value: `${opportunityQueueCount}` },
          { label: 'Deadlines soon', value: `${upcomingDeadlines.length}` },
          { label: 'Appointments ending', value: `${expiringContractsCount}` },
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
                ? `${myTenders} pursuit${myTenders === 1 ? '' : 's'} and ${myContracts} appointment${myContracts === 1 ? '' : 's'} are allocated to you.`
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

        <Link
          href="/firm"
          className="app-surface flex items-center justify-between gap-4 rounded-[24px] p-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Firm workspace</h2>
            <p className="mt-1 text-sm text-slate-500">
              {firmProfileStatus === 'Started'
                ? `${organizationContext.organization.name} is configured as the foundation for future matching and qualification.`
                : 'Complete the firm profile before the matching engine gets more specific.'}
            </p>
          </div>
          <span className="app-button-secondary whitespace-nowrap">Open firm profile</span>
        </Link>

        <Link
          href="/vault"
          className="app-surface flex items-center justify-between gap-4 rounded-[24px] p-5"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Compliance vault</h2>
            <p className="mt-1 text-sm text-slate-500">
              {expiringComplianceCount > 0
                ? `${expiringComplianceCount} compliance document${expiringComplianceCount === 1 ? '' : 's'} need attention in the next 30 days.`
                : 'No compliance documents are nearing expiry right now.'}
            </p>
          </div>
          <span className="app-button-secondary whitespace-nowrap">Open vault</span>
        </Link>

        {session.role === 'admin' && (
          <Link
            href="/launch-interest"
            className="app-surface flex items-center justify-between gap-4 rounded-[24px] p-5"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Pilot interest</h2>
              <p className="mt-1 text-sm text-slate-500">
                {pilotLeadCount > 0
                  ? `${pilotLeadCount} launch request${pilotLeadCount === 1 ? '' : 's'} captured so far.`
                  : 'No pilot requests have landed yet.'}
              </p>
            </div>
            <span className="app-button-secondary whitespace-nowrap">Review leads</span>
          </Link>
        )}

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

        {session.role === 'admin' && session.email && (
          <EmailTestCard email={session.email} isConfigured={isEmailConfigured()} />
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
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Opportunity radar</h2>
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
                    {Array.isArray(opportunity.matches?.[0]?.matchReasons) && opportunity.matches[0].matchReasons.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {opportunity.matches[0].matchReasons.slice(0, 2).map(reason => (
                          <span key={reason} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                            {reason}
                          </span>
                        ))}
                      </div>
                    ) : null}
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
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Pursuits due soon</h2>
              <Link href="/pursuits" className="app-button-secondary self-start">View pursuits</Link>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <div className="rounded-[20px] bg-slate-50 px-5 py-10 text-center">
                <p className="text-sm font-semibold text-slate-700">No looming pursuit deadlines.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map(tender => (
                  <Link
                    key={tender.id}
                    href={`/pursuits/${tender.id}`}
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
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Appointments nearing end date</h2>
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
                    href={`/appointments/${contract.id}`}
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

        <section className="app-surface rounded-[24px] p-5 sm:p-6">
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-slate-100 pb-4">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Compliance alerts</h2>
            <Link href="/vault" className="app-button-secondary self-start">Open vault</Link>
          </div>

          {expiringComplianceDocuments.length === 0 ? (
            <div className="rounded-[20px] bg-slate-50 px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-700">No compliance documents are expiring in the next 30 days.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expiringComplianceDocuments.map(document => (
                <Link
                  key={document.id}
                  href="/vault"
                  className="flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-white/90 p-4 hover:border-indigo-200 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{document.filename}</p>
                    <p className="mt-1 text-sm text-slate-500">{document.documentType}</p>
                  </div>
                  <div className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    Expires {formatShortDate(document.expiryDate)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
