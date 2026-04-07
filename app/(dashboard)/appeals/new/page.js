'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'

// Default appeal templates (SA tender appeal context)
const INTENTION_TEMPLATE = `[Date]

[Entity Name]
[Entity Address]

Dear Sir/Madam,

RE: INTENTION TO APPEAL — [TENDER NUMBER]

We, [COMPANY NAME], hereby give formal notice of our intention to appeal the award/decision made in respect of [TENDER TITLE] (Reference: [TENDER NUMBER]).

We believe the decision was not made in accordance with the applicable supply chain management policy and/or the Preferential Procurement Policy Framework Act.

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

RE: FORMAL APPEAL — [TENDER NUMBER]: [TENDER TITLE]

1. INTRODUCTION
We, [COMPANY NAME], hereby formally appeal against the decision/award made in respect of [TENDER TITLE] (Reference: [TENDER NUMBER]).

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
    const text = type === 'intention' ? INTENTION_TEMPLATE : FORMAL_TEMPLATE
    setForm({ ...form, template: text })
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

    if (!res.ok) { setError(data.error); return }
    router.push(`/appeals/${data.id}`)
  }

  return (
    <div>
      <Header title="New Appeal" />
      <div className="p-6 max-w-3xl">
        <Link href="/appeals" className="text-slate-400 hover:text-slate-600 text-sm mb-6 inline-block">
          ← Back to Appeals
        </Link>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Appeal Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason / Summary <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Incorrectly scored on B-BBEE criteria"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Appeal Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]">
                    <option>Pending</option>
                    <option>Submitted</option>
                    <option>Won</option>
                    <option>Lost</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Internal notes about this appeal…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-2">Appeal Letter Template</h2>
            <p className="text-slate-500 text-sm mb-4">
              Start with one of our SA tender appeal templates and edit it to match your case.
            </p>

            <div className="flex gap-2 mb-4">
              <button type="button"
                onClick={() => applyTemplate('intention')}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  templateType === 'intention' ? 'border-[#185FA5] text-[#185FA5] bg-blue-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                Intention to Appeal
              </button>
              <button type="button"
                onClick={() => applyTemplate('formal')}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  templateType === 'formal' ? 'border-[#185FA5] text-[#185FA5] bg-blue-50' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                Formal Appeal Letter
              </button>
              {templateType !== 'none' && (
                <button type="button" onClick={() => { setForm({ ...form, template: '' }); setTemplateType('none') }}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-600">
                  Clear
                </button>
              )}
            </div>

            <textarea
              rows={16}
              value={form.template}
              onChange={e => setForm({ ...form, template: e.target.value })}
              placeholder="Select a template above, or write your appeal letter here. Replace all [PLACEHOLDERS] with actual information."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
            />
            <p className="text-xs text-slate-400 mt-1">Replace all text in [BRACKETS] with the actual information.</p>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading}
              className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: '#185FA5' }}>
              {loading ? 'Saving…' : 'Create Appeal'}
            </button>
            <Link href="/appeals">
              <button type="button" className="px-6 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">
                Cancel
              </button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function NewAppealPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
      <NewAppealForm />
    </Suspense>
  )
}
