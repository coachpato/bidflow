'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '@/app/components/Header'

function formatDate(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatMoney(value) {
  if (value == null) return 'Not set'
  return `R ${Number(value).toLocaleString('en-ZA')}`
}

function getAssignedLabel(contract) {
  return contract?.assignedUser?.name || contract?.assignedTo || 'Unassigned'
}

function daysUntil(value) {
  if (!value) return null
  const diff = new Date(value).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function fetchContracts() {
      const response = await fetch('/api/contracts')
      const data = await response.json()

      if (!isMounted) return

      setContracts(Array.isArray(data) ? data : [])
      setLoading(false)
    }

    fetchContracts().catch(() => {
      if (!isMounted) return
      setContracts([])
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [])

  const summary = useMemo(() => {
    const expired = contracts.filter(contract => {
      const remaining = daysUntil(contract.endDate)
      return remaining != null && remaining <= 0
    }).length
    const expiring = contracts.filter(contract => {
      const remaining = daysUntil(contract.endDate)
      return remaining != null && remaining > 0 && remaining <= 30
    }).length

    return {
      total: contracts.length,
      active: Math.max(contracts.length - expired, 0),
      expiring,
      expired,
    }
  }, [contracts])

  return (
    <div className="space-y-6">
      <Header
        title="Contracts"
        eyebrow="Delivery"
        primaryAction={{ href: '/contracts/new', label: 'New contract' }}
        meta={[
          { label: 'In view', value: `${summary.total}` },
          { label: 'Active', value: `${summary.active}` },
          { label: 'Expiring', value: `${summary.expiring}` },
          { label: 'Expired', value: `${summary.expired}` },
        ]}
      />

      <div className="app-page">
        {loading ? (
          <section className="app-surface rounded-[24px] px-6 py-16 text-center text-slate-500">
            Loading contracts...
          </section>
        ) : contracts.length === 0 ? (
          <section className="app-surface rounded-[24px] px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800">No contracts yet.</p>
            <Link href="/contracts/new" className="app-button-primary mt-5">
              Create contract
            </Link>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {contracts.map(contract => {
              const remaining = daysUntil(contract.endDate)
              const isExpired = remaining != null && remaining <= 0
              const isExpiring = remaining != null && remaining > 0 && remaining <= 30

              return (
                <Link key={contract.id} href={`/contracts/${contract.id}`} className="app-surface rounded-[24px] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-semibold text-slate-950">{contract.title}</h2>
                      <p className="mt-1 text-sm text-slate-500">{contract.client || 'Client not set'}</p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        isExpired
                          ? 'bg-red-50 text-red-700'
                          : isExpiring
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {isExpired
                        ? 'Expired'
                        : isExpiring
                          ? `${remaining}d left`
                          : 'Active'}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Metric label="Allocated to" value={getAssignedLabel(contract)} />
                    <Metric label="Value" value={formatMoney(contract.value)} />
                    <Metric label="Start" value={formatDate(contract.startDate)} />
                    <Metric
                      label="End"
                      value={formatDate(contract.endDate)}
                      tone={isExpired ? 'text-red-700' : isExpiring ? 'text-amber-700' : 'text-slate-900'}
                    />
                    <Metric label="Renewal" value={formatDate(contract.renewalDate)} />
                    <Metric label="Files" value={`${contract._count?.documents ?? 0}`} />
                  </div>

                  {contract.tender ? (
                    <div className="mt-4 rounded-[18px] border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-600">
                      Linked tender: {contract.tender.title}
                    </div>
                  ) : null}
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
