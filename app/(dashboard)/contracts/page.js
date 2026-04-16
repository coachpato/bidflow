'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'

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

function getAssignedLabel(appointment) {
  return appointment?.assignedUser?.name || appointment?.assignedTo || 'Unassigned'
}

function daysUntil(value) {
  if (!value) return null
  const diff = new Date(value).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getDormantLabel(appointment) {
  if (appointment.instructionStatus === 'Instruction Received') return 'Instruction flowing'
  const remaining = daysUntil(appointment.nextFollowUpAt)
  if (remaining == null) return 'Follow-up not scheduled'
  if (remaining < 0) return `${Math.abs(remaining)}d overdue`
  if (remaining === 0) return 'Follow-up today'
  return `Follow-up in ${remaining}d`
}

export default function ContractsPage() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function fetchAppointments() {
      const response = await fetch('/api/contracts')
      const data = await response.json()

      if (!isMounted) return

      setAppointments(Array.isArray(data) ? data : [])
      setLoading(false)
    }

    fetchAppointments().catch(() => {
      if (!isMounted) return
      setAppointments([])
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [])

  const summary = useMemo(() => {
    const dormant = appointments.filter(appointment =>
      appointment.instructionStatus === 'No Instruction'
    ).length
    const active = appointments.filter(appointment =>
      appointment.appointmentStatus === 'Active' || appointment.instructionStatus === 'Instruction Received'
    ).length
    const followUpsDue = appointments.filter(appointment => {
      const remaining = daysUntil(appointment.nextFollowUpAt)
      return remaining != null && remaining >= 0 && remaining <= 14
    }).length

    return {
      total: appointments.length,
      active,
      dormant,
      followUpsDue,
    }
  }, [appointments])

  return (
    <div className="space-y-6">
      <Header
        title="Appointments"
        eyebrow="Post-award"
        primaryAction={{ href: '/appointments/new', label: 'New appointment' }}
        meta={[
          { label: 'In view', value: `${summary.total}` },
          { label: 'Active', value: `${summary.active}` },
          { label: 'Dormant', value: `${summary.dormant}` },
          { label: 'Follow-ups due', value: `${summary.followUpsDue}` },
        ]}
      />

      <div className="app-page">
        {loading ? (
          <section className="app-surface rounded-[24px] px-6 py-16 text-center text-slate-500">
            Loading appointments...
          </section>
        ) : appointments.length === 0 ? (
          <section className="app-surface rounded-[24px] px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800">No appointments yet.</p>
            <Link href="/appointments/new" className="app-button-primary mt-5">
              Create appointment
            </Link>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {appointments.map(appointment => {
              const endRemaining = daysUntil(appointment.endDate)
              const endTone = endRemaining != null && endRemaining <= 0
                ? 'text-red-700'
                : endRemaining != null && endRemaining <= 30
                  ? 'text-amber-700'
                  : 'text-slate-900'

              return (
                <Link key={appointment.id} href={`/appointments/${appointment.id}`} className="app-surface rounded-[24px] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-semibold text-slate-950">{appointment.title}</h2>
                      <p className="mt-1 text-sm text-slate-500">{appointment.client || 'Entity not set'}</p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={appointment.appointmentStatus || 'Appointed'} />
                      <StatusBadge status={appointment.instructionStatus || 'No Instruction'} />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Metric label="Allocated to" value={getAssignedLabel(appointment)} />
                    <Metric label="Value" value={formatMoney(appointment.value)} />
                    <Metric label="Appointment date" value={formatDate(appointment.appointmentDate)} />
                    <Metric label="End date" value={formatDate(appointment.endDate)} tone={endTone} />
                    <Metric label="Follow-up" value={getDormantLabel(appointment)} />
                    <Metric label="Milestones" value={`${appointment._count?.milestones ?? 0}`} />
                  </div>

                  {appointment.tender ? (
                    <div className="mt-4 rounded-[18px] border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-600">
                      Linked pursuit: {appointment.tender.title}
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
