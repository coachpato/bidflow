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
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function fetchChallenges() {
      const response = await fetch('/api/appeals')
      const data = await response.json()

      if (!isMounted) return

      setChallenges(Array.isArray(data) ? data : [])
      setLoading(false)
    }

    fetchChallenges().catch(() => {
      if (!isMounted) return
      setChallenges([])
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [])

  const summary = useMemo(() => {
    const open = challenges.filter(challenge => ['Pending', 'Submitted'].includes(challenge.status)).length
    const urgent = challenges.filter(challenge => {
      const remaining = daysLeft(challenge.deadline)
      return remaining != null && remaining >= 0 && remaining <= 7
    }).length
    const overdue = challenges.filter(challenge => {
      const remaining = daysLeft(challenge.deadline)
      return remaining != null && remaining < 0
    }).length

    return {
      total: challenges.length,
      open,
      urgent,
      overdue,
    }
  }, [challenges])

  return (
    <div className="space-y-6">
      <Header
        title="Challenges"
        eyebrow="Disqualification desk"
        primaryAction={{ href: '/challenges/new', label: 'New challenge' }}
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
            Loading challenges...
          </section>
        ) : challenges.length === 0 ? (
          <section className="app-surface rounded-[24px] px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800">No challenges yet.</p>
            <Link href="/challenges/new" className="app-button-primary mt-5">
              Create challenge
            </Link>
          </section>
        ) : (
          <section className="space-y-4">
            {challenges.map(challenge => {
              const remaining = daysLeft(challenge.deadline)
              const deadlineTone =
                remaining == null
                  ? 'text-slate-600'
                  : remaining < 0
                    ? 'text-red-700'
                    : remaining <= 7
                      ? 'text-amber-700'
                      : 'text-slate-700'

              return (
                <Link key={challenge.id} href={`/challenges/${challenge.id}`} className="app-surface block rounded-[24px] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-slate-950">{challenge.reason}</h2>
                        <StatusBadge status={challenge.challengeType || 'Administrative Appeal'} />
                      </div>
                      {challenge.tender ? (
                        <p className="mt-2 text-sm text-slate-500">
                          {challenge.tender.entity} | {challenge.tender.title}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">No linked pursuit</p>
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
                      <StatusBadge status={challenge.status} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <Metric label="Deadline" value={formatDate(challenge.deadline)} tone={deadlineTone} />
                    <Metric label="Status" value={challenge.status || 'Pending'} />
                    <Metric label="Documents" value={`${challenge._count?.documents ?? 0}`} />
                    <Metric label="Draft" value={challenge.template ? 'Ready' : 'Not started'} />
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
