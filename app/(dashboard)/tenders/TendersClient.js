'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'

const FILTERS = [
  { label: 'All', value: 'All' },
  { label: 'Active', value: 'active' },
  { label: 'New', value: 'New' },
  { label: 'Under Review', value: 'Under Review' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Submitted', value: 'Submitted' },
  { label: 'Awarded', value: 'Awarded' },
  { label: 'Lost', value: 'Lost' },
  { label: 'Cancelled', value: 'Cancelled' },
]

function formatDate(value) {
  if (!value) return 'No deadline'
  return new Date(value).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getDaysRemaining(value) {
  if (!value) return null
  const diff = new Date(value).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getDeadlineTone(daysRemaining) {
  if (daysRemaining == null) return 'text-slate-500'
  if (daysRemaining < 0) return 'text-red-700'
  if (daysRemaining <= 7) return 'text-amber-700'
  return 'text-slate-700'
}

function getDeadlineLabel(daysRemaining) {
  if (daysRemaining == null) return 'No deadline'
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)}d overdue`
  if (daysRemaining === 0) return 'Due today'
  return `${daysRemaining}d left`
}

function getAssignedLabel(tender) {
  return tender?.assignedUser?.name || tender?.assignedTo || 'Unassigned'
}

export default function TendersClient({ initialSearch, initialStatus }) {
  const [tenders, setTenders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [submittedSearch, setSubmittedSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatus)

  useEffect(() => {
    let isMounted = true

    async function fetchTenders() {
      setLoading(true)

      const params = new URLSearchParams()
      if (submittedSearch) params.set('search', submittedSearch)
      if (statusFilter !== 'All') params.set('status', statusFilter)

      const response = await fetch(`/api/tenders?${params.toString()}`)
      const data = await response.json()

      if (!isMounted) return

      setTenders(Array.isArray(data) ? data : [])
      setLoading(false)
    }

    fetchTenders().catch(() => {
      if (!isMounted) return
      setTenders([])
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [statusFilter, submittedSearch])

  const summary = useMemo(() => {
    const activeCount = tenders.filter(tender => ['New', 'Under Review', 'In Progress'].includes(tender.status)).length
    const dueSoon = tenders.filter(tender => {
      const daysRemaining = getDaysRemaining(tender.deadline)
      return daysRemaining != null && daysRemaining >= 0 && daysRemaining <= 14
    }).length
    const awardedCount = tenders.filter(tender => tender.status === 'Awarded').length

    return {
      total: tenders.length,
      active: activeCount,
      dueSoon,
      awarded: awardedCount,
    }
  }, [tenders])

  function submitSearch() {
    setSubmittedSearch(searchInput.trim())
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'Enter') submitSearch()
  }

  return (
    <div className="space-y-6">
      <Header
        title="Pursuits"
        eyebrow="Pipeline"
        primaryAction={{ href: '/tenders/new', label: 'New pursuit' }}
        meta={[
          { label: 'In view', value: `${summary.total}` },
          { label: 'Active', value: `${summary.active}` },
          { label: 'Due soon', value: `${summary.dueSoon}` },
          { label: 'Awarded', value: `${summary.awarded}` },
        ]}
      />

      <div className="app-page space-y-6">
        <section className="app-surface rounded-[24px] p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map(filter => {
                const isActive = statusFilter === filter.value

                return (
                  <button
                    key={filter.value}
                    onClick={() => setStatusFilter(filter.value)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold tracking-[0.08em] uppercase ${
                      isActive
                        ? 'border-transparent bg-[var(--brand-600)] text-white'
                        : 'border-slate-200 bg-white/90 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {filter.label}
                  </button>
                )
              })}
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
              <input
                type="text"
                placeholder="Search title, entity, or reference"
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="app-input min-w-0 sm:w-[22rem]"
              />
              <button onClick={submitSearch} className="app-button-secondary whitespace-nowrap">
                Search
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="app-surface rounded-[24px] px-6 py-16 text-center text-slate-500">
            Loading pursuits...
          </section>
        ) : tenders.length === 0 ? (
          <section className="app-surface rounded-[24px] px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800">No pursuits found.</p>
            <Link href="/tenders/new" className="app-button-primary mt-5">
              Create pursuit
            </Link>
          </section>
        ) : (
          <>
            <div className="grid gap-4 md:hidden">
              {tenders.map(tender => {
                const daysRemaining = getDaysRemaining(tender.deadline)

                return (
                  <Link key={tender.id} href={`/tenders/${tender.id}`} className="app-surface rounded-[24px] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold text-slate-950">{tender.title}</h2>
                        <p className="mt-1 text-sm text-slate-500">{tender.entity}</p>
                      </div>
                      <StatusBadge status={tender.status} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Metric label="Reference" value={tender.reference || 'Not set'} />
                      <Metric label="Owner" value={getAssignedLabel(tender)} />
                      <Metric label="Deadline" value={formatDate(tender.deadline)} tone={getDeadlineTone(daysRemaining)} />
                      <Metric label="Countdown" value={getDeadlineLabel(daysRemaining)} tone={getDeadlineTone(daysRemaining)} />
                      <Metric label="Documents" value={`${tender._count?.documents ?? 0}`} />
                    </div>
                  </Link>
                )
              })}
            </div>

            <section className="app-surface hidden overflow-hidden rounded-[24px] md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-[rgba(248,246,242,0.95)]">
                  <tr className="text-left">
                    <th className="px-5 py-4 font-semibold text-slate-500">Pursuit</th>
                    <th className="px-5 py-4 font-semibold text-slate-500">Reference</th>
                    <th className="px-5 py-4 font-semibold text-slate-500">Owner</th>
                    <th className="px-5 py-4 font-semibold text-slate-500">Deadline</th>
                    <th className="px-5 py-4 font-semibold text-slate-500">Checklist</th>
                    <th className="px-5 py-4 font-semibold text-slate-500">Status</th>
                    <th className="px-5 py-4 font-semibold text-slate-500">Documents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenders.map(tender => {
                    const daysRemaining = getDaysRemaining(tender.deadline)

                    return (
                      <tr key={tender.id} className="bg-white/70 hover:bg-white">
                        <td className="px-5 py-4">
                          <Link href={`/tenders/${tender.id}`} className="font-semibold text-slate-900 hover:text-[var(--brand-500)]">
                            {tender.title}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500">{tender.entity}</p>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{tender.reference || 'Not set'}</td>
                        <td className="px-5 py-4 text-slate-600">{getAssignedLabel(tender)}</td>
                        <td className="px-5 py-4">
                          <p className={`font-semibold ${getDeadlineTone(daysRemaining)}`}>{formatDate(tender.deadline)}</p>
                          <p className={`mt-1 text-xs ${getDeadlineTone(daysRemaining)}`}>{getDeadlineLabel(daysRemaining)}</p>
                        </td>
                        <td className="px-5 py-4 text-slate-600">{tender._count?.checklistItems ?? 0} items</td>
                        <td className="px-5 py-4">
                          <StatusBadge status={tender.status} />
                        </td>
                        <td className="px-5 py-4 text-slate-600">{tender._count?.documents ?? 0}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
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
