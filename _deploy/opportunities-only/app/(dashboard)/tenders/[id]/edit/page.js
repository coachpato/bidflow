'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'
import UserSelect from '@/app/components/UserSelect'

const STATUSES = ['New', 'Under Review', 'In Progress', 'Submitted', 'Awarded', 'Lost', 'Cancelled']

export default function EditTenderPage() {
  const { id } = useParams()
  const router = useRouter()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/tenders/${id}`)
      .then(r => r.json())
      .then(data => {
        setForm({
          title: data.title || '',
          reference: data.reference || '',
          entity: data.entity || '',
          description: data.description || '',
          deadline: data.deadline ? data.deadline.substring(0, 16) : '',
          briefingDate: data.briefingDate ? data.briefingDate.substring(0, 16) : '',
          contactPerson: data.contactPerson || '',
          contactEmail: data.contactEmail || '',
          status: data.status || 'New',
          assignedUserId: data.assignedUserId ? String(data.assignedUserId) : '',
          assignedTo: data.assignedUser?.name || data.assignedTo || '',
          notes: data.notes || '',
        })
        setLoading(false)
      })
  }, [id])

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
    setSaving(true)

    const res = await fetch(`/api/tenders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(data.error)
      return
    }

    router.push(`/tenders/${id}`)
  }

  return (
    <div className="space-y-6">
      <Header
        title="Edit tender"
        eyebrow="Tender maintenance"
        description="Refresh the tender record so deadlines, contacts, and ownership remain trustworthy for the whole team."
        meta={form ? [
          { label: 'Stage', value: form.status || 'New' },
          { label: 'Entity', value: form.entity || 'Not set' },
          { label: 'Owner', value: form.assignedTo || 'Unassigned' },
        ] : []}
      />

      <div className="app-page space-y-6">
        <Link href={`/tenders/${id}`} className="app-button-secondary">
          Back to tender
        </Link>

        {loading || !form ? (
          <div className="app-surface rounded-[30px] px-6 py-16 text-center text-slate-500">
            Loading tender...
          </div>
        ) : (
          <section className="app-surface rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <p className="app-kicker">Tender details</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Update the record
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Keep the tender context current so workspaces, reminders, and follow-through stay aligned.
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
                  <input name="title" required value={form.title} onChange={handleChange} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Issuing entity</label>
                  <input name="entity" required value={form.entity} onChange={handleChange} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Reference</label>
                  <input name="reference" value={form.reference} onChange={handleChange} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Deadline</label>
                  <input type="datetime-local" name="deadline" value={form.deadline} onChange={handleChange} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Briefing date</label>
                  <input type="datetime-local" name="briefingDate" value={form.briefingDate} onChange={handleChange} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Contact person</label>
                  <input name="contactPerson" value={form.contactPerson} onChange={handleChange} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Contact email</label>
                  <input type="email" name="contactEmail" value={form.contactEmail} onChange={handleChange} className="app-input" />
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
                    helperText="Update the person responsible for this tender."
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Description</label>
                  <textarea name="description" value={form.description} onChange={handleChange} rows={4} className="app-textarea" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Internal notes</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} className="app-textarea" />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" disabled={saving} className="app-button-primary disabled:translate-y-0 disabled:opacity-60">
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
                <Link href={`/tenders/${id}`} className="app-button-secondary">
                  Cancel
                </Link>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  )
}
