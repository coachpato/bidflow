'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'

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
    assignedTo: '',
    notes: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
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
    <div>
      <Header title="New Tender" />
      <div className="p-6 max-w-3xl">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/tenders" className="text-slate-400 hover:text-slate-600 text-sm">← Back to Tenders</Link>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-6">Tender Details</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tender Title <span className="text-red-500">*</span>
                </label>
                <input
                  name="title" required value={form.title} onChange={handleChange}
                  placeholder="e.g. Legal Services for eThekwini Municipality"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Issuing Entity <span className="text-red-500">*</span>
                </label>
                <input
                  name="entity" required value={form.entity} onChange={handleChange}
                  placeholder="e.g. eThekwini Municipality"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tender Number / Reference</label>
                <input
                  name="reference" value={form.reference} onChange={handleChange}
                  placeholder="e.g. ETH-2024-001"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Submission Deadline</label>
                <input
                  type="datetime-local" name="deadline" value={form.deadline} onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Compulsory Briefing Date</label>
                <input
                  type="datetime-local" name="briefingDate" value={form.briefingDate} onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
                <input
                  name="contactPerson" value={form.contactPerson} onChange={handleChange}
                  placeholder="Name of contact at the entity"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contact Email</label>
                <input
                  type="email" name="contactEmail" value={form.contactEmail} onChange={handleChange}
                  placeholder="contact@entity.gov.za"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  name="status" value={form.status} onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assigned To</label>
                <input
                  name="assignedTo" value={form.assignedTo} onChange={handleChange}
                  placeholder="Team member names (comma separated)"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  name="description" value={form.description} onChange={handleChange} rows={3}
                  placeholder="Brief description of the tender scope…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  name="notes" value={form.notes} onChange={handleChange} rows={2}
                  placeholder="Internal notes…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit" disabled={loading}
                className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: '#185FA5' }}
              >
                {loading ? 'Saving…' : 'Create Tender'}
              </button>
              <Link href="/tenders">
                <button type="button" className="px-6 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">
                  Cancel
                </button>
              </Link>
            </div>
          </form>
        </div>

        <p className="text-xs text-slate-400 mt-4">
          A default SA compliance checklist (CSD, B-BBEE, SBD forms, etc.) will be automatically created for this tender.
        </p>
      </div>
    </div>
  )
}
