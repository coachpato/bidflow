'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import ConfirmDialog from '@/app/components/ConfirmDialog'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'
import { useToast } from '@/app/components/Toast'

const FILTERS = [
  { label: 'All', value: 'All' },
  { label: 'New', value: 'New' },
  { label: 'Watch', value: 'Watch' },
  { label: 'Pursue', value: 'Pursue' },
  { label: 'Ignore', value: 'Ignore' },
  { label: 'Converted', value: 'Converted' },
]

const REVIEW_ACTIONS = ['Watch', 'Pursue', 'Ignore']

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

function getFitTone(score) {
  if (score == null) return 'text-slate-500'
  if (score >= 75) return 'text-emerald-700'
  if (score >= 45) return 'text-amber-700'
  return 'text-slate-700'
}

function getFitLabel(score) {
  if (score == null) return 'Not scored'
  return `${score}/100`
}

function getMatchReasons(opportunity) {
  if (!Array.isArray(opportunity.match?.matchReasons)) return []
  return opportunity.match.matchReasons.filter(Boolean).slice(0, 2)
}

export default function OpportunitiesClient({ initialSearch, initialStatus }) {
  const { addToast } = useToast()
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState(initialSearch)
  const [submittedSearch, setSubmittedSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState(initialStatus)
  const [updatingId, setUpdatingId] = useState(null)
  const [opportunityToConvert, setOpportunityToConvert] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function fetchOpportunities() {
      setLoading(true)

      const params = new URLSearchParams()
      if (submittedSearch) params.set('search', submittedSearch)
      if (statusFilter !== 'All') params.set('status', statusFilter)

      const response = await fetch(`/api/opportunities?${params.toString()}`)
      const data = await response.json()

      if (!isMounted) return

      setOpportunities(Array.isArray(data) ? data : [])
      setLoading(false)
    }

    fetchOpportunities().catch(() => {
      if (!isMounted) return
      setOpportunities([])
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [statusFilter, submittedSearch])

  const summary = useMemo(() => {
    const highFit = opportunities.filter(opportunity => (opportunity.fitScore ?? 0) >= 75).length
    const dueSoon = opportunities.filter(opportunity => {
      const daysRemaining = getDaysRemaining(opportunity.deadline)
      return daysRemaining != null && daysRemaining >= 0 && daysRemaining <= 10
    }).length
    const pursueCount = opportunities.filter(opportunity => opportunity.status === 'Pursue').length
    const watchCount = opportunities.filter(opportunity => opportunity.status === 'Watch').length

    return {
      total: opportunities.length,
      highFit,
      dueSoon,
      pursueCount,
      watchCount,
    }
  }, [opportunities])

  function submitSearch() {
    setSubmittedSearch(searchInput.trim())
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'Enter') submitSearch()
  }

  async function updateOpportunityStatus(opportunityId, status) {
    if (status === 'Pursue') {
      const opportunity = opportunities.find(item => item.id === opportunityId)
      setOpportunityToConvert(opportunity || { id: opportunityId })
      return
    }

    setUpdatingId(opportunityId)

    try {
      const response = await fetch(`/api/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Could not update opportunity.')
      }

      setOpportunities(current =>
        current.map(opportunity =>
          opportunity.id === opportunityId ? data : opportunity
        )
      )
      addToast('Opportunity updated.', 'success')
    } catch (error) {
      console.error(error)
      addToast(error.message || 'Could not update opportunity.', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  async function convertOpportunity() {
    if (!opportunityToConvert) return

    setUpdatingId(opportunityToConvert.id)
    try {
      const response = await fetch(`/api/opportunities/${opportunityToConvert.id}/convert`, {
        method: 'POST',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Could not convert opportunity.')
      }

      setOpportunities(current =>
        current.filter(opportunity => opportunity.id !== opportunityToConvert.id)
      )
      setOpportunityToConvert(null)
      addToast('Opportunity converted to pursuit.', 'success')
    } catch (error) {
      console.error(error)
      addToast(error.message || 'Could not convert opportunity.', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <>
      <div className="space-y-6">
      <Header
        title="Opportunity radar"
        eyebrow="Top of funnel"
        primaryAction={{ href: '/opportunities/new', label: 'Capture opportunity' }}
        secondaryAction={{ href: '/pursuits', label: 'Open pursuits' }}
        meta={[
          { label: 'In radar', value: `${summary.total}` },
          { label: 'High fit', value: `${summary.highFit}` },
          { label: 'Closing soon', value: `${summary.dueSoon}` },
          { label: 'Pursue', value: `${summary.pursueCount}` },
          { label: 'Watch', value: `${summary.watchCount}` },
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
                placeholder="Search title, entity, practice area, or reference"
                value={searchInput}
                onChange={event => setSearchInput(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="app-input min-w-0 sm:w-[24rem]"
              />
              <button onClick={submitSearch} className="app-button-secondary whitespace-nowrap">
                Search
              </button>
            </div>
          </div>
        </section>

        {loading ? (
          <section className="app-surface rounded-[24px] px-6 py-16 text-center text-slate-500">
            Loading opportunities...
          </section>
        ) : opportunities.length === 0 ? (
          <section className="app-surface rounded-[24px] px-6 py-16">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No opportunities found</h3>
              <p className="text-gray-500 mb-4">
                We couldn&apos;t find opportunities matching your firm&apos;s current sector and preferences.
              </p>
              <Link href="/settings" className="app-button-primary">
                Go to Settings
              </Link>
              <p className="text-sm text-gray-400 mt-4">
                Update your firm profile or sector to see relevant opportunities.
              </p>
            </div>
          </section>
        ) : (
          <>
            <div className="grid gap-4 md:hidden">
              {opportunities.map(opportunity => {
                const daysRemaining = getDaysRemaining(opportunity.deadline)
                const reasons = getMatchReasons(opportunity)

                return (
                  <section key={opportunity.id} className="app-surface rounded-[24px] p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link href={`/opportunities/${opportunity.id}`} className="truncate text-lg font-semibold text-slate-950 hover:text-[var(--brand-500)]">
                          {opportunity.title}
                        </Link>
                        <p className="mt-1 text-sm text-slate-500">{opportunity.entity}</p>
                      </div>
                      <StatusBadge status={opportunity.status} />
                    </div>

                    {reasons.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {reasons.map(reason => (
                          <span key={reason} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <Metric label="Reference" value={opportunity.reference || 'Not set'} />
                      <Metric label="Source" value={opportunity.source?.name || opportunity.sourceName || 'Manual'} />
                      <Metric label="Practice area" value={opportunity.practiceArea || 'Not set'} />
                      <Metric label="Fit score" value={getFitLabel(opportunity.fitScore)} tone={getFitTone(opportunity.fitScore)} />
                      <Metric label="Deadline" value={formatDate(opportunity.deadline)} tone={getDeadlineTone(daysRemaining)} />
                      <Metric label="Countdown" value={getDeadlineLabel(daysRemaining)} tone={getDeadlineTone(daysRemaining)} />
                      <Metric label="Documents" value={`${opportunity._count?.documents ?? 0}`} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {REVIEW_ACTIONS.map(status => (
                        <button
                          key={status}
                          onClick={() => updateOpportunityStatus(opportunity.id, status)}
                          disabled={updatingId === opportunity.id || opportunity.status === status || opportunity.status === 'Converted'}
                          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 disabled:opacity-50"
                        >
                          {status}
                        </button>
                      ))}
                    </div>

                    {opportunity.tender ? (
                      <div className="mt-4 rounded-[18px] bg-slate-50 px-3 py-3 text-sm font-medium text-slate-600">
                        Linked pursuit: {opportunity.tender.title}
                      </div>
                    ) : null}
                  </section>
                )
              })}
            </div>

            <section className="app-surface hidden overflow-hidden rounded-[24px] md:block">
              <div className="overflow-x-auto">
                <table className="min-w-[76rem] w-full table-fixed text-sm">
                <thead className="border-b border-slate-200 bg-[rgba(248,246,242,0.95)]">
                  <tr className="text-left">
                    <th className="w-[26rem] px-5 py-4 font-semibold text-slate-500">Opportunity</th>
                    <th className="w-[20rem] px-5 py-4 font-semibold text-slate-500">Why it matched</th>
                    <th className="w-[9rem] px-5 py-4 font-semibold text-slate-500">Deadline</th>
                    <th className="w-[8rem] px-5 py-4 font-semibold text-slate-500">Fit</th>
                    <th className="w-[9rem] px-5 py-4 font-semibold text-slate-500">Status</th>
                    <th className="w-[14rem] px-5 py-4 font-semibold text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {opportunities.map(opportunity => {
                    const daysRemaining = getDaysRemaining(opportunity.deadline)
                    const reasons = getMatchReasons(opportunity)

                    return (
                      <tr key={opportunity.id} className="bg-white/70 align-top hover:bg-white">
                        <td className="px-5 py-4 align-top">
                          <Link href={`/opportunities/${opportunity.id}`} className="block break-words font-semibold text-slate-900 hover:text-[var(--brand-500)]">
                            {opportunity.title}
                          </Link>
                          <p className="mt-1 break-words text-xs text-slate-500">{opportunity.entity}</p>
                          <p className="mt-1 break-words text-xs text-slate-500">
                            {opportunity.reference || 'No ref'} | {opportunity.source?.name || opportunity.sourceName || 'Manual'}
                          </p>
                        </td>
                        <td className="px-5 py-4 align-top text-slate-600">
                          {reasons.length === 0 ? (
                            <span className="text-xs text-slate-500">Manual intake or no match reasons saved yet.</span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {reasons.map(reason => (
                                <span key={reason} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                                  {reason}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <p className={`font-semibold ${getDeadlineTone(daysRemaining)}`}>{formatDate(opportunity.deadline)}</p>
                          <p className={`mt-1 text-xs ${getDeadlineTone(daysRemaining)}`}>{getDeadlineLabel(daysRemaining)}</p>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <p className={`font-semibold ${getFitTone(opportunity.fitScore)}`}>{getFitLabel(opportunity.fitScore)}</p>
                          <p className="mt-1 text-xs text-slate-500">{opportunity.practiceArea || 'Not set'}</p>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <StatusBadge status={opportunity.status} />
                        </td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            {REVIEW_ACTIONS.map(status => (
                              <button
                                key={status}
                                onClick={() => updateOpportunityStatus(opportunity.id, status)}
                                disabled={updatingId === opportunity.id || opportunity.status === status || opportunity.status === 'Converted'}
                                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 disabled:opacity-50"
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                          {opportunity.tender ? (
                            <p className="mt-2 text-xs text-slate-500">Pursuit linked</p>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
      </div>

      <ConfirmDialog
        isOpen={Boolean(opportunityToConvert)}
        title="Convert opportunity to pursuit?"
        description="This will move the opportunity from the review queue into your Pursuits list."
        confirmLabel="Convert"
        isLoading={updatingId === opportunityToConvert?.id}
        onConfirm={convertOpportunity}
        onClose={() => setOpportunityToConvert(null)}
      />
    </>
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
