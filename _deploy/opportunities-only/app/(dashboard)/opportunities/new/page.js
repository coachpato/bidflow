'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'

const STATUSES = ['New', 'Reviewing', 'Pursue', 'Skipped']

export default function NewOpportunityPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    title: '',
    reference: '',
    entity: '',
    sourceName: 'eTenders.gov.za',
    sourceUrl: '',
    practiceArea: '',
    summary: '',
    estimatedValue: '',
    deadline: '',
    briefingDate: '',
    siteVisitDate: '',
    contactPerson: '',
    contactEmail: '',
    fitScore: '',
    status: 'New',
    notes: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const response = await fetch('/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(data.error || 'Could not create opportunity.')
      return
    }

    router.push(`/opportunities/${data.id}`)
  }

  return (
    <div className="space-y-6">
      <Header
        title="Capture opportunity"
        eyebrow="Opportunity intake"
        meta={[
          { label: 'Source', value: form.sourceName || 'Manual' },
          { label: 'Fit score', value: form.fitScore ? `${form.fitScore}/100` : 'Not scored' },
          { label: 'Status', value: form.status },
          { label: 'Deadline', value: form.deadline ? 'Set' : 'Pending' },
        ]}
      />

      <div className="app-page space-y-6">
        <Link href="/opportunities" className="app-button-secondary">
          Back to opportunities
        </Link>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="app-surface rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <p className="app-kicker">Opportunity record</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Intake details
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Capture the signal before it becomes bid work. Once the team decides to pursue it, you can convert it straight into a tender.
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
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Opportunity title</label>
                  <input
                    name="title"
                    required
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Panel of legal services for provincial entity"
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Issuing entity</label>
                  <input
                    name="entity"
                    required
                    value={form.entity}
                    onChange={handleChange}
                    placeholder="Provincial Treasury"
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Reference</label>
                  <input
                    name="reference"
                    value={form.reference}
                    onChange={handleChange}
                    placeholder="PT-2026-014"
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Source name</label>
                  <input
                    name="sourceName"
                    value={form.sourceName}
                    onChange={handleChange}
                    placeholder="eTenders.gov.za"
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Source URL</label>
                  <input
                    name="sourceUrl"
                    type="url"
                    value={form.sourceUrl}
                    onChange={handleChange}
                    placeholder="https://..."
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Practice area</label>
                  <input
                    name="practiceArea"
                    value={form.practiceArea}
                    onChange={handleChange}
                    placeholder="Public procurement"
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Fit score</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    name="fitScore"
                    value={form.fitScore}
                    onChange={handleChange}
                    placeholder="78"
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Estimated value (ZAR)</label>
                  <input
                    type="number"
                    name="estimatedValue"
                    value={form.estimatedValue}
                    onChange={handleChange}
                    placeholder="1200000"
                    className="app-input"
                  />
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
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Deadline</label>
                  <input type="datetime-local" name="deadline" value={form.deadline} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Briefing date</label>
                  <input type="datetime-local" name="briefingDate" value={form.briefingDate} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Site visit date</label>
                  <input type="datetime-local" name="siteVisitDate" value={form.siteVisitDate} onChange={handleChange} className="app-input" />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Contact person</label>
                  <input
                    name="contactPerson"
                    value={form.contactPerson}
                    onChange={handleChange}
                    placeholder="Bid office contact"
                    className="app-input"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Contact email</label>
                  <input
                    type="email"
                    name="contactEmail"
                    value={form.contactEmail}
                    onChange={handleChange}
                    placeholder="bidoffice@gov.za"
                    className="app-input"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Summary</label>
                  <textarea
                    name="summary"
                    value={form.summary}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Short summary of the scope, eligibility, and why this may fit."
                    className="app-textarea"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Decision notes</label>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={4}
                    placeholder="What makes this attractive, risky, or not worth pursuing yet?"
                    className="app-textarea"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button type="submit" disabled={loading} className="app-button-primary disabled:translate-y-0 disabled:opacity-60">
                  {loading ? 'Saving...' : 'Create opportunity'}
                </button>
                <Link href="/opportunities" className="app-button-secondary">
                  Cancel
                </Link>
              </div>
            </form>
          </section>

          <aside className="app-surface rounded-[30px] p-5 sm:p-6">
            <p className="app-kicker">How to use it</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Start light
            </h2>
            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Manual first</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Paste the opportunity into BidFlow before building automation. That gives you a real workflow to learn from.
                </p>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Score honestly</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  A simple fit score is enough for MVP. The important part is being consistent about why you would pursue or skip.
                </p>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Convert only when ready</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Once the team decides to bid, the tender record can inherit the dates, notes, and uploaded pack automatically.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
