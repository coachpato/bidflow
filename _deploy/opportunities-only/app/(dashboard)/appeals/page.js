'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'

function formatDate(value) {
  if (!value) return 'No deadline'
  return new Date(value).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function daysLeft(value) {
  if (!value) return null
  const diff = new Date(value).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function AppealsPage() {
  const [appeals, setAppeals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function fetchAppeals() {
      const response = await fetch('/api/appeals')
      const data = await response.json()

      if (!isMounted) return

      setAppeals(Array.isArray(data) ? data : [])
      setLoading(false)
    }

    fetchAppeals().catch(() => {
      if (!isMounted) return
      setAppeals([])
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [])

  const summary = useMemo(() => {
    const open = appeals.filter(appeal => ['Pending', 'Submitted'].includes(appeal.status)).length
    const urgent = appeals.filter(appeal => {
      const remaining = daysLeft(appeal.deadline)
      return remaining != null && remaining >= 0 && remaining <= 7
    }).length
    const overdue = appeals.filter(appeal => {
      const remaining = daysLeft(appeal.deadline)
      return remaining != null && remaining < 0
    }).length

    return {
      total: appeals.length,
      open,
      urgent,
      overdue,
    }
  }, [appeals])

  return (
    <div className="space-y-6">
      <Header
        title="Appeals"
        eyebrow="Disputes"
        primaryAction={{ href: '/appeals/new', label: 'New appeal' }}
        meta={[
          { label: 'In view', value: `${summary.total}` },
          { label: 'Open', value: `${summary.open}` },
          { label: 'Urgent', value: `${summary.urgent}` },
          { label: 'Overdue', value: `${summary.overdue}` },
        ]}
      />

      <div className="app-page">
        {loading ? (
          <section className="app-surface rounded-[24px] px-6 py-16 text-center text-slate-500">
            Loading appeals...
          </section>
        ) : appeals.length === 0 ? (
          <section className="app-surface rounded-[24px] px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800">No appeals yet.</p>
            <Link href="/appeals/new" className="app-button-primary mt-5">
              Create appeal
            </Link>
          </section>
        ) : (
          <section className="space-y-4">
            {appeals.map(appeal => {
              const remaining = daysLeft(appeal.deadline)
              const deadlineTone =
                remaining == null
                  ? 'text-slate-600'
                  : remaining < 0
                    ? 'text-red-700'
                    : remaining <= 7
                      ? 'text-amber-700'
                      : 'text-slate-700'

              return (
                <Link key={appeal.id} href={`/appeals/${appeal.id}`} className="app-surface block rounded-[24px] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-slate-950">{appeal.reason}</h2>
                      {appeal.tender ? (
                        <p className="mt-2 text-sm text-slate-500">
                          {appeal.tender.entity} • {appeal.tender.title}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">No linked tender</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                        {remaining == null
                          ? 'No deadline'
                          : remaining < 0
                            ? `${Math.abs(remaining)}d overdue`
                            : remaining === 0
                              ? 'Due today'
                              : `${remaining}d left`}
                      </div>
                      <StatusBadge status={appeal.status} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Metric label="Deadline" value={formatDate(appeal.deadline)} tone={deadlineTone} />
                    <Metric label="Status" value={appeal.status || 'Pending'} />
                    <Metric label="Draft" value={appeal.template ? 'Ready' : 'Not started'} />
                  </div>
                </Link>
              )
            })}
          </section>
        )}
      </div>
    </div>
  )
}

function Metric({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-[18px] bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${tone}`}>{value}</p>
    </div>
  )
}
