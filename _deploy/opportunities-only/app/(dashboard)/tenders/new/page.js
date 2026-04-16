'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'
import UserSelect from '@/app/components/UserSelect'

const STATUSES = ['New', 'Under Review', 'In Progress', 'Submitted', 'Awarded', 'Lost', 'Cancelled']

export default function NewTenderPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    title: '',
    reference: '',
    entity: '',
    description: '',
    deadline: '',
    briefingDate: '',
    contactPerson: '',
    contactEmail: '',
    status: 'New',
    assignedUserId: '',
    assignedTo: '',
    notes: '',
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

    const res = await fetch('/api/tenders', {
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

    router.push(`/tenders/${data.id}`)
  }

  return (
    <div className="space-y-6">
      <Header
        title="Capture tender"
        eyebrow="Tender intake"
        description="Record the opportunity cleanly up front so deadlines, ownership, and compliance work stay easier to manage."
        meta={[
          { label: 'Stage', value: form.status },
          { label: 'Entity', value: form.entity || 'Not set' },
          { label: 'Owner', value: form.assignedTo || 'Unassigned' },
        ]}
      />

      <div className="app-page space-y-6">
        <Link href="/tenders" className="app-button-secondary">
          Back to tenders
        </Link>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="app-surface rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <p className="app-kicker">Tender record</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Matter details
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Capture the public opportunity, the key dates, and the owner who will keep the work moving.
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
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Tender title</label>
                  <input name="title" required value={form.title} onChange={handleChange} placeholder="Legal services for eThekwini Municipality" className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Issuing entity</label>
                  <input name="entity" required value={form.entity} onChange={handleChange} placeholder="eThekwini Municipality" className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Tender number or reference</label>
                  <input name="reference" value={form.reference} onChange={handleChange} placeholder="ETH-2026-001" className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Submission deadline</label>
                  <input type="datetime-local" name="deadline" value={form.deadline} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Compulsory briefing date</label>
                  <input type="datetime-local" name="briefingDate" value={form.briefingDate} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Contact person</label>
                  <input name="contactPerson" value={form.contactPerson} onChange={handleChange} placeholder="Name at the issuing entity" className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Contact email</label>
                  <input type="email" name="contactEmail" value={form.contactEmail} onChange={handleChange} placeholder="contact@entity.gov.za" className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className="app-select">
                    {STATUSES.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <UserSelect
                    label="Owner"
                    value={form.assignedUserId}
                    onChange={handleAssignedUserChange}
                    helperText="Pick the person responsible for driving this tender."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows={4} placeholder="Tender scope, special requirements, or decision notes..." className="app-textarea" />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Internal notes</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Internal reminders, strategy notes, or dependencies..." className="app-textarea" />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" disabled={loading} className="app-button-primary disabled:translate-y-0 disabled:opacity-60">
                  {loading ? 'Saving...' : 'Create tender'}
                </button>
                <Link href="/tenders" className="app-button-secondary">
                  Cancel
                </Link>
              </div>
            </form>
          </section>

          <aside className="app-surface rounded-[30px] p-5 sm:p-6">
            <p className="app-kicker">Helpful prompt</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Start with clarity
            </h2>
            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Capture real dates</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Deadline and briefing dates shape the urgency of everything else, so they are worth getting right early.
                </p>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Use internal notes sparingly</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Save the quick strategic cues here, then use the tender workspace to carry the matter forward.
                </p>
              </div>
            </div>

            <p className="mt-5 text-sm leading-7 text-slate-500">
              A default South African compliance checklist will be created automatically after the tender is saved.
            </p>
          </aside>
        </div>
      </div>
    </div>
  )
}
