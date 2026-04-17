import Link from 'next/link'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'
import { getOrganizationContextFromSession } from '@/lib/organization'
import { getCachedMyWorkData } from '@/lib/my-work-read-model'
import { requireAuth } from '@/lib/session'

const TENDER_STATUSES = ['New', 'Under Review', 'In Progress', 'Submitted', 'Awarded']
const TENDER_WARNING_DAYS = 14
const CONTRACT_WARNING_DAYS = 30

function formatDate(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function daysUntil(value) {
  if (!value) return null
  const diff = new Date(value).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getTenderTone(daysRemaining) {
  if (daysRemaining == null) return 'text-slate-500'
  if (daysRemaining < 0) return 'text-red-700'
  if (daysRemaining <= TENDER_WARNING_DAYS) return 'text-amber-700'
  return 'text-slate-700'
}

function getTenderLabel(daysRemaining) {
  if (daysRemaining == null) return 'No deadline'
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)}d overdue`
  if (daysRemaining === 0) return 'Due today'
  return `${daysRemaining}d left`
}

function getContractTone(daysRemaining) {
  if (daysRemaining == null) return 'text-slate-500'
  if (daysRemaining <= 0) return 'text-red-700'
  if (daysRemaining <= CONTRACT_WARNING_DAYS) return 'text-amber-700'
  return 'text-emerald-700'
}

function getContractLabel(daysRemaining) {
  if (daysRemaining == null) return 'No end date'
  if (daysRemaining <= 0) return 'Expired'
  return `${daysRemaining}d left`
}

export default async function MyWorkPage() {
  const session = await requireAuth()
  const organizationContext = await getOrganizationContextFromSession(session)
  const organizationId = organizationContext.organization.id
  const legacyAssigneeTokens = [session.email, session.name].filter(Boolean)
  const { tenders, contracts, unreadNotifications } = await getCachedMyWorkData({
    organizationId,
    userId: session.userId,
    legacyAssigneeTokens,
  })

  const dueSoonTenders = tenders.filter(tender => {
    const remaining = daysUntil(tender.deadline)
    return remaining != null && remaining >= 0 && remaining <= TENDER_WARNING_DAYS
  }).length
  const expiringContracts = contracts.filter(contract => {
    const remaining = daysUntil(contract.endDate)
    return remaining != null && remaining > 0 && remaining <= CONTRACT_WARNING_DAYS
  }).length

  return (
    <div className="space-y-6">
      <Header
        title="My Work"
        eyebrow="Assigned to you"
        primaryAction={{ href: '/inbox', label: 'Open inbox' }}
        secondaryAction={{ href: '/tenders', label: 'All tenders' }}
        meta={[
          { label: 'Tenders', value: `${tenders.length}` },
          { label: 'Appointments', value: `${contracts.length}` },
          { label: 'Due soon', value: `${dueSoonTenders}` },
          { label: 'Inbox unread', value: `${unreadNotifications}` },
        ]}
      />

      <div className="app-page space-y-6">
        <section className="grid gap-4 lg:grid-cols-3">
          <SummaryCard label="Assigned tenders" value={`${tenders.length}`} />
          <SummaryCard label="Assigned appointments" value={`${contracts.length}`} />
          <SummaryCard label="Expiring appointments" value={`${expiringContracts}`} />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="app-surface rounded-[24px] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="app-kicker">Tenders</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Your tender queue</h2>
              </div>
              <Link href="/tenders" className="app-button-secondary">All tenders</Link>
            </div>

            {tenders.length === 0 ? (
              <EmptyState
                title="No tenders are assigned to you."
                actionHref="/tenders"
                actionLabel="Browse tenders"
              />
            ) : (
              <div className="space-y-3">
                {tenders.map(tender => {
                  const remaining = daysUntil(tender.deadline)

                  return (
                    <Link
                      key={tender.id}
                      href={`/tenders/${tender.id}`}
                      className="block rounded-[20px] border border-slate-200 bg-white/80 p-4 hover:border-[rgba(13,103,181,0.26)]"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{tender.title}</p>
                          <p className="mt-1 text-sm text-slate-500">{tender.entity}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <span className="text-xs font-medium text-slate-500">
                              {tender.reference || 'Reference not set'}
                            </span>
                            <span className={`text-xs font-semibold ${getTenderTone(remaining)}`}>
                              {getTenderLabel(remaining)}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={tender.status} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          <section className="app-surface rounded-[24px] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="app-kicker">Appointments</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Your appointment watchlist</h2>
              </div>
              <Link href="/appointments" className="app-button-secondary">All appointments</Link>
            </div>

            {contracts.length === 0 ? (
              <EmptyState
                title="No appointments are assigned to you."
                actionHref="/appointments"
                actionLabel="Browse appointments"
              />
            ) : (
              <div className="space-y-3">
                {contracts.map(contract => {
                  const remaining = daysUntil(contract.endDate)

                  return (
                    <Link
                      key={contract.id}
                      href={`/appointments/${contract.id}`}
                      className="block rounded-[20px] border border-slate-200 bg-white/80 p-4 hover:border-amber-200"
                    >
                      <p className="text-sm font-semibold text-slate-900">{contract.title}</p>
                      <p className="mt-1 text-sm text-slate-500">{contract.client || 'Client not set'}</p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <Metric label="End" value={formatDate(contract.endDate)} tone={getContractTone(remaining)} />
                        <Metric label="Status" value={getContractLabel(remaining)} tone={getContractTone(remaining)} />
                        <Metric label="Renewal" value={formatDate(contract.renewalDate)} />
                        <Metric label="Instruction" value={contract.instructionStatus || 'No Instruction'} />
                        <Metric
                          label="Linked tender"
                          value={contract.tender?.title || 'Not linked'}
                        />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value }) {
  return (
    <div className="app-surface rounded-[24px] p-5">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="app-data mt-3 text-4xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  )
}

function Metric({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-[18px] bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  )
}

function EmptyState({ title, actionHref, actionLabel }) {
  return (
    <div className="rounded-[20px] bg-slate-50 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <Link href={actionHref} className="app-button-secondary mt-5">
        {actionLabel}
      </Link>
    </div>
  )
}
