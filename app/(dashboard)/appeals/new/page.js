'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'

const CHALLENGE_TYPES = ['Administrative Appeal', 'Bid Protest', 'Review']
const STATUSES = ['Pending', 'Submitted', 'Won', 'Lost']

const INTENTION_TEMPLATE = `[Date]

[Entity Name]
[Entity Address]

Dear Sir/Madam,

RE: NOTICE OF CHALLENGE - [TENDER NUMBER]

We, [COMPANY NAME], hereby give formal notice of our intention to challenge the decision made in respect of [TENDER TITLE] (Reference: [TENDER NUMBER]).

Grounds currently identified:
- [Insert the first issue]
- [Insert the second issue]

We request that implementation be placed on hold while this challenge is considered.

Yours faithfully,

[NAME]
[DESIGNATION]
[COMPANY NAME]
[CONTACT]`

function NewAppealForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [form, setForm] = useState({
    reason: '',
    challengeType: 'Administrative Appeal',
    exclusionReason: '',
    exclusionDate: '',
    deadline: '',
    status: 'Pending',
    requestedRelief: '',
    nextStep: '',
    notes: '',
    template: '',
    tenderId: searchParams.get('tenderId') || '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const response = await fetch('/api/appeals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(data.error || 'Could not create challenge.')
      return
    }

    router.push(`/challenges/${data.id}`)
  }

  return (
    <div className="space-y-6">
      <Header
        title="Create challenge"
        eyebrow="Challenge setup"
        description="Capture the exclusion facts, deadline, and first draft while the procurement trail is still fresh."
        meta={[
          { label: 'Linked pursuit', value: form.tenderId ? 'Attached' : 'Optional' },
          { label: 'Type', value: form.challengeType },
          { label: 'Status', value: form.status },
        ]}
      />

      <div className="app-page space-y-6">
        <Link href="/challenges" className="app-button-secondary">
          Back to challenges
        </Link>

        {error ? (
          <div className="rounded-[28px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          <section className="app-surface rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <p className="app-kicker">Challenge record</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Matter details</h2>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Challenge summary</label>
                <input
                  required
                  value={form.reason}
                  onChange={event => setForm({ ...form, reason: event.target.value })}
                  placeholder="Excluded for allegedly missing mandatory returnable"
                  className="app-input"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Challenge type</label>
                  <select value={form.challengeType} onChange={event => setForm({ ...form, challengeType: event.target.value })} className="app-select">
                    {CHALLENGE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
                  <select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} className="app-select">
                    {STATUSES.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Exclusion date</label>
                  <input type="date" value={form.exclusionDate} onChange={event => setForm({ ...form, exclusionDate: event.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Challenge deadline</label>
                  <input type="date" value={form.deadline} onChange={event => setForm({ ...form, deadline: event.target.value })} className="app-input" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Exclusion reason given by the entity</label>
                <textarea rows={3} value={form.exclusionReason} onChange={event => setForm({ ...form, exclusionReason: event.target.value })} className="app-textarea" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Requested relief</label>
                <textarea rows={3} value={form.requestedRelief} onChange={event => setForm({ ...form, requestedRelief: event.target.value })} className="app-textarea" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Immediate next step</label>
                <textarea rows={2} value={form.nextStep} onChange={event => setForm({ ...form, nextStep: event.target.value })} className="app-textarea" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Internal notes</label>
                <textarea rows={4} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className="app-textarea" />
              </div>

              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Starter draft</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Use the template as a starting point, then replace placeholders with the actual tender reference, facts, and requested relief.
                </p>
                <button
                  type="button"
                  onClick={() => setForm(current => ({ ...current, template: current.template || INTENTION_TEMPLATE }))}
                  className="app-button-secondary mt-4"
                >
                  Insert starter draft
                </button>
              </div>
            </div>
          </section>

          <section className="app-surface rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <p className="app-kicker">Draft correspondence</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Working challenge text</h2>
            </div>

            <div className="mt-5 space-y-4">
              <textarea
                rows={22}
                value={form.template}
                onChange={event => setForm({ ...form, template: event.target.value })}
                placeholder="Write or paste your challenge draft here..."
                className="app-textarea app-data"
              />
              <p className="text-xs text-slate-500">
                Replace placeholders with the correct names, dates, references, and relief sought before sending anything externally.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="submit" disabled={loading} className="app-button-primary disabled:translate-y-0 disabled:opacity-60">
                {loading ? 'Saving...' : 'Create challenge'}
              </button>
              <Link href="/challenges" className="app-button-secondary">
                Cancel
              </Link>
            </div>
          </section>
        </form>
      </div>
    </div>
  )
}

export default function NewAppealPage() {
  return (
    <Suspense fallback={<div className="app-page py-12 text-slate-500">Loading...</div>}>
      <NewAppealForm />
    </Suspense>
  )
}
