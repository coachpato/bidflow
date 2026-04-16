'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'
import UserSelect from '@/app/components/UserSelect'

const APPOINTMENT_STATUSES = ['Appointed', 'Dormant', 'Active', 'Completed', 'Closed']
const INSTRUCTION_STATUSES = ['No Instruction', 'Instruction Received']

function NewContractForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [form, setForm] = useState({
    title: searchParams.get('title') || '',
    client: searchParams.get('client') || '',
    assignedUserId: searchParams.get('assignedUserId') || '',
    assignedTo: searchParams.get('assignedTo') || '',
    appointmentStatus: 'Appointed',
    instructionStatus: 'No Instruction',
    appointmentDate: '',
    startDate: '',
    endDate: '',
    renewalDate: '',
    cancelDate: '',
    firstInstructionDate: '',
    nextFollowUpAt: '',
    lastFollowUpAt: '',
    value: '',
    milestoneSummary: '',
    notes: '',
    tenderId: searchParams.get('tenderId') || '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  function handleAssignedUserChange(assignedUserId, assignedUser) {
    setForm(current => ({
      ...current,
      assignedUserId,
      assignedTo: assignedUser?.name || assignedUser?.email || '',
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const response = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(data.error || 'Could not create appointment.')
      return
    }

    router.push(`/appointments/${data.id}`)
  }

  return (
    <div className="space-y-6">
      <Header
        title="Create appointment"
        eyebrow="Appointment setup"
        description="Capture the post-award record as soon as a firm is appointed so follow-ups, instructions, and milestones do not drift."
        meta={[
          { label: 'Linked pursuit', value: form.tenderId ? 'Attached' : 'Optional' },
          { label: 'Status', value: form.appointmentStatus },
          { label: 'Instruction', value: form.instructionStatus },
          { label: 'Allocated to', value: form.assignedTo || 'Unassigned' },
        ]}
      />

      <div className="app-page space-y-6">
        <Link href="/appointments" className="app-button-secondary">
          Back to appointments
        </Link>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="app-surface rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <p className="app-kicker">Appointment record</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Appointment details
              </h2>
            </div>

            {error ? (
              <div className="mt-5 rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Appointment title</label>
                  <input name="title" required value={form.title} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Client or entity</label>
                  <input name="client" value={form.client} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <UserSelect
                    label="Allocated to"
                    value={form.assignedUserId}
                    onChange={handleAssignedUserChange}
                    helperText="Choose the teammate who will follow up on this appointment."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Appointment status</label>
                  <select name="appointmentStatus" value={form.appointmentStatus} onChange={handleChange} className="app-select">
                    {APPOINTMENT_STATUSES.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Instruction status</label>
                  <select name="instructionStatus" value={form.instructionStatus} onChange={handleChange} className="app-select">
                    {INSTRUCTION_STATUSES.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Appointment date</label>
                  <input type="date" name="appointmentDate" value={form.appointmentDate} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">First instruction date</label>
                  <input type="date" name="firstInstructionDate" value={form.firstInstructionDate} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Start date</label>
                  <input type="date" name="startDate" value={form.startDate} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">End date</label>
                  <input type="date" name="endDate" value={form.endDate} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Renewal date</label>
                  <input type="date" name="renewalDate" value={form.renewalDate} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Cancellation date</label>
                  <input type="date" name="cancelDate" value={form.cancelDate} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Next follow-up</label>
                  <input type="date" name="nextFollowUpAt" value={form.nextFollowUpAt} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Last follow-up</label>
                  <input type="date" name="lastFollowUpAt" value={form.lastFollowUpAt} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Appointment value (ZAR)</label>
                  <input type="number" name="value" value={form.value} onChange={handleChange} className="app-input" />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Milestone summary</label>
                  <textarea name="milestoneSummary" value={form.milestoneSummary} onChange={handleChange} rows={3} className="app-textarea" />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Notes</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} className="app-textarea" />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" disabled={loading} className="app-button-primary disabled:translate-y-0 disabled:opacity-60">
                  {loading ? 'Saving...' : 'Create appointment'}
                </button>
                <Link href="/appointments" className="app-button-secondary">
                  Cancel
                </Link>
              </div>
            </form>
          </section>

          <aside className="app-surface rounded-[30px] p-5 sm:p-6">
            <p className="app-kicker">Helpful prompt</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              What belongs here?
            </h2>
            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Track dormant awards</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  If you have been appointed but not yet instructed, set a next follow-up date immediately so the appointment stays active in the desk.
                </p>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Keep the pursuit link</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Linking the appointment back to the pursuit preserves the full trail from opportunity to work.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default function NewContractPage() {
  return (
    <Suspense fallback={<div className="app-page py-12 text-slate-500">Loading...</div>}>
      <NewContractForm />
    </Suspense>
  )
}
