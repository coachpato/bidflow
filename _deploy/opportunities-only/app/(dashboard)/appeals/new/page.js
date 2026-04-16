'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'

const INTENTION_TEMPLATE = `[Date]

[Entity Name]
[Entity Address]

Dear Sir/Madam,

RE: INTENTION TO APPEAL - [TENDER NUMBER]

We, [COMPANY NAME], hereby give formal notice of our intention to appeal the award or decision made in respect of [TENDER TITLE] (Reference: [TENDER NUMBER]).

We believe the decision was not made in accordance with the applicable supply chain management policy and or the Preferential Procurement Policy Framework Act.

We respectfully request that implementation of the award be placed on hold pending the outcome of this appeal process.

Yours faithfully,

[NAME]
[DESIGNATION]
[COMPANY NAME]
[CONTACT]`

const FORMAL_TEMPLATE = `[Date]

[Entity Name]
[Entity Address]

Dear Sir/Madam,

RE: FORMAL APPEAL - [TENDER NUMBER]: [TENDER TITLE]

1. INTRODUCTION
We, [COMPANY NAME], hereby formally appeal against the decision or award made in respect of [TENDER TITLE] (Reference: [TENDER NUMBER]).

2. GROUNDS FOR APPEAL
[State your specific grounds here. For example:]
- The scoring methodology was not applied consistently
- Preference points were incorrectly allocated
- The evaluation criteria were changed post-submission
- A conflict of interest existed in the evaluation committee

3. SUPPORTING DOCUMENTS
[List any supporting evidence attached]

4. RELIEF SOUGHT
We respectfully request that the Adjudicating Authority:
- Review and set aside the award decision
- Re-evaluate all bids objectively and transparently
- [Any other specific relief requested]

5. CONCLUSION
We trust that this appeal will be given the urgent consideration it deserves within the prescribed timeframes.

Yours faithfully,

[NAME]
[DESIGNATION]
[COMPANY NAME]
[DATE]`

function NewAppealForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [form, setForm] = useState({
    reason: '',
    deadline: '',
    status: 'Pending',
    notes: '',
    template: '',
    tenderId: searchParams.get('tenderId') || '',
  })
  const [templateType, setTemplateType] = useState('none')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function applyTemplate(type) {
    setForm({ ...form, template: type === 'intention' ? INTENTION_TEMPLATE : FORMAL_TEMPLATE })
    setTemplateType(type)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/appeals', {
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

    router.push(`/appeals/${data.id}`)
  }

  return (
    <div className="space-y-6">
      <Header
        title="Create appeal"
        eyebrow="Dispute setup"
        description="Log the challenge, capture the deadline, and start a usable draft while the facts are still fresh."
        meta={[
          { label: 'Linked tender', value: form.tenderId ? 'Attached' : 'Optional' },
          { label: 'Status', value: form.status },
          { label: 'Template', value: templateType === 'none' ? 'Custom' : templateType },
        ]}
      />

      <div className="app-page space-y-6">
        <Link href="/appeals" className="app-button-secondary">
          Back to appeals
        </Link>

        {error && (
          <div className="rounded-[28px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
          <section className="app-surface rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <p className="app-kicker">Appeal record</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Matter details
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Capture the argument in plain language first, then layer on timing and supporting notes.
              </p>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Reason or summary</label>
                <input
                  required
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  placeholder="Incorrectly scored on preference points"
                  className="app-input"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Appeal deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="app-select">
                    <option>Pending</option>
                    <option>Submitted</option>
                    <option>Won</option>
                    <option>Lost</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Notes</label>
                <textarea rows={4} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes, evidence to gather, stakeholders..." className="app-textarea" />
              </div>

              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Template shortcuts</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Start from a South African tender appeal template and edit the draft to match your case.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => applyTemplate('intention')} className={templateType === 'intention' ? 'app-button-primary' : 'app-button-secondary'}>
                    Intention to appeal
                  </button>
                  <button type="button" onClick={() => applyTemplate('formal')} className={templateType === 'formal' ? 'app-button-primary' : 'app-button-secondary'}>
                    Formal appeal
                  </button>
                  {templateType !== 'none' && (
                    <button
                      type="button"
                      onClick={() => {
                        setForm({ ...form, template: '' })
                        setTemplateType('none')
                      }}
                      className="app-button-secondary"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="app-surface rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <p className="app-kicker">Draft letter</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Working appeal text
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Replace the placeholders with actual facts and relief sought before you send anything externally.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <textarea
                rows={18}
                value={form.template}
                onChange={e => setForm({ ...form, template: e.target.value })}
                placeholder="Write or paste your appeal draft here..."
                className="app-textarea app-data"
              />
              <p className="text-xs text-slate-500">
                Replace every placeholder in square brackets with the correct names, dates, tender numbers, and requested relief.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="submit" disabled={loading} className="app-button-primary disabled:translate-y-0 disabled:opacity-60">
                {loading ? 'Saving...' : 'Create appeal'}
              </button>
              <Link href="/appeals" className="app-button-secondary">
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
