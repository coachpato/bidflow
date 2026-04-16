'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'
import UserSelect from '@/app/components/UserSelect'

function NewContractForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [form, setForm] = useState({
    title: searchParams.get('title') || '',
    client: searchParams.get('client') || '',
    assignedUserId: searchParams.get('assignedUserId') || '',
    assignedTo: searchParams.get('assignedTo') || '',
    startDate: '',
    endDate: '',
    renewalDate: '',
    cancelDate: '',
    value: '',
    notes: '',
    tenderId: searchParams.get('tenderId') || '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleAssignedUserChange(assignedUserId, assignedUser) {
    setForm(current => ({
      ...current,
      assignedUserId,
      assignedTo: assignedUser?.name || assignedUser?.email || '',
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error)
      return
    }

    router.push(`/contracts/${data.id}`)
  }

  return (
    <div className="space-y-6">
      <Header
        title="Create contract"
        eyebrow="Contract setup"
        description="Capture the commercial record as soon as a tender is won so delivery details do not drift."
        meta={[
          { label: 'Linked tender', value: form.tenderId ? 'Attached' : 'Optional' },
          { label: 'Client', value: form.client || 'Not set' },
          { label: 'Allocated to', value: form.assignedTo || 'Unassigned' },
          { label: 'Value', value: form.value ? `R ${Number(form.value).toLocaleString('en-ZA')}` : 'Not set' },
        ]}
      />

      <div className="app-page space-y-6">
        <Link href="/contracts" className="app-button-secondary">
          Back to contracts
        </Link>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="app-surface rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <p className="app-kicker">Contract record</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Contract details
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Start with the commercial essentials, then add notes that will matter to whoever manages renewals later.
              </p>
            </div>

            {error && (
              <div className="mt-5 rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Contract title</label>
                  <input name="title" required value={form.title} onChange={handleChange} placeholder="Legal services contract - municipality 2026" className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Client or entity</label>
                  <input name="client" value={form.client} onChange={handleChange} placeholder="eThekwini Municipality" className="app-input" />
                </div>

                <div>
                  <UserSelect
                    label="Allocated to"
                    value={form.assignedUserId}
                    onChange={handleAssignedUserChange}
                    helperText="Choose the teammate who will manage this contract."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Contract value (ZAR)</label>
                  <input type="number" name="value" value={form.value} onChange={handleChange} placeholder="500000" className="app-input" />
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

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Notes</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} rows={4} placeholder="Commercial notes, service levels, handover reminders..." className="app-textarea" />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" disabled={loading} className="app-button-primary disabled:translate-y-0 disabled:opacity-60">
                  {loading ? 'Saving...' : 'Create contract'}
                </button>
                <Link href="/contracts" className="app-button-secondary">
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
                <p className="text-sm font-semibold text-slate-900">Key dates first</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Start and end dates make renewal planning much easier later, even if the rest of the record is still evolving.
                </p>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Preserve tender context</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  If the contract comes from a tender award, keep that link so the team can trace scope and background quickly.
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
