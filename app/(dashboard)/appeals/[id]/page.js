'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'

const STATUSES = ['Pending', 'Submitted', 'Won', 'Lost']

export default function AppealDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [appeal, setAppeal] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const fetchAppeal = useCallback(async () => {
    const res = await fetch(`/api/appeals/${id}`)
    if (!res.ok) { router.push('/appeals'); return }
    const data = await res.json()
    setAppeal(data)
    setForm({
      reason: data.reason || '',
      deadline: data.deadline ? data.deadline.substring(0, 10) : '',
      status: data.status || 'Pending',
      notes: data.notes || '',
      template: data.template || '',
    })
  }, [id, router])

  useEffect(() => { fetchAppeal() }, [fetchAppeal])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/appeals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setEditing(false)
    fetchAppeal()
  }

  async function handleDelete() {
    if (!confirm('Delete this appeal? This cannot be undone.')) return
    await fetch(`/api/appeals/${id}`, { method: 'DELETE' })
    router.push('/appeals')
  }

  if (!appeal) return <div className="p-6 text-slate-400">Loading…</div>

  const daysLeft = appeal.deadline
    ? Math.ceil((new Date(appeal.deadline) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div>
      <Header title="Appeal" />
      <div className="p-6 max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/appeals" className="text-slate-400 hover:text-slate-600 text-sm">← Appeals</Link>
          <div className="flex gap-2">
            <button onClick={() => setEditing(!editing)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button onClick={handleDelete}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 border border-red-200 text-red-600 hover:bg-red-100">
              Delete
            </button>
          </div>
        </div>

        {daysLeft !== null && daysLeft <= 7 && (
          <div className={`p-4 rounded-xl border ${daysLeft <= 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
            <p className={`text-sm font-medium ${daysLeft <= 0 ? 'text-red-700' : 'text-orange-700'}`}>
              {daysLeft <= 0
                ? '⚠ Appeal deadline has passed.'
                : `⚠ Appeal deadline is in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`}
            </p>
          </div>
        )}

        {editing ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reason</label>
                <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]">
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Appeal Letter</label>
                <textarea rows={14} value={form.template} onChange={e => setForm({ ...form, template: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
              </div>
              <button type="submit" disabled={saving}
                className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: '#185FA5' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">{appeal.reason}</h2>
                <StatusBadge status={appeal.status} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {appeal.deadline && (
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-0.5">Deadline</p>
                    <p className="text-slate-800">{new Date(appeal.deadline).toLocaleDateString('en-ZA')}</p>
                  </div>
                )}
                {appeal.tender && (
                  <div>
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-0.5">Linked Tender</p>
                    <Link href={`/tenders/${appeal.tender.id}`} className="text-[#185FA5] hover:underline">
                      {appeal.tender.title}
                    </Link>
                  </div>
                )}
                {appeal.notes && (
                  <div className="col-span-2">
                    <p className="text-slate-400 text-xs uppercase tracking-wider mb-0.5">Notes</p>
                    <p className="text-slate-700">{appeal.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {appeal.template && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-800">Appeal Letter</h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(appeal.template)
                      alert('Copied to clipboard!')
                    }}
                    className="text-sm text-[#185FA5] hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono bg-slate-50 p-4 rounded-lg overflow-auto max-h-96">
                  {appeal.template}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
