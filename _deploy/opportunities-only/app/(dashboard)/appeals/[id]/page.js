'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'

const STATUSES = ['Pending', 'Submitted', 'Won', 'Lost']

function formatDate(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-ZA')
}

export default function AppealDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [appeal, setAppeal] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  async function fetchAppeal() {
    const res = await fetch(`/api/appeals/${id}`)
    if (!res.ok) {
      router.push('/appeals')
      return
    }

    const data = await res.json()
    setAppeal(data)
    setForm({
      reason: data.reason || '',
      deadline: data.deadline ? data.deadline.substring(0, 10) : '',
      status: data.status || 'Pending',
      notes: data.notes || '',
      template: data.template || '',
    })
  }

  useEffect(() => {
    let isMounted = true

    async function loadAppeal() {
      const res = await fetch(`/api/appeals/${id}`)
      if (!res.ok) {
        router.push('/appeals')
        return
      }

      const data = await res.json()
      if (!isMounted) return

      setAppeal(data)
      setForm({
        reason: data.reason || '',
        deadline: data.deadline ? data.deadline.substring(0, 10) : '',
        status: data.status || 'Pending',
        notes: data.notes || '',
        template: data.template || '',
      })
    }

    loadAppeal()

    return () => {
      isMounted = false
    }
  }, [id, router])

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

  const daysLeft = appeal?.deadline
    ? Math.ceil((new Date(appeal.deadline) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="space-y-6">
      <Header
        title={appeal?.reason || 'Appeal workspace'}
        eyebrow="Appeal detail"
        description="Keep filing deadlines, supporting notes, and the working draft in one place while the dispute is active."
        meta={appeal ? [
          { label: 'Status', value: appeal.status || 'Pending' },
          { label: 'Deadline', value: formatDate(appeal.deadline) },
          { label: 'Linked tender', value: appeal.tender?.title || 'Not linked' },
        ] : []}
      />

      <div className="app-page space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/appeals" className="app-button-secondary">
            Back to appeals
          </Link>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setEditing(!editing)} className="app-button-secondary">
              {editing ? 'Cancel edit' : 'Edit appeal'}
            </button>
            <button onClick={handleDelete} className="app-button-danger">
              Delete
            </button>
          </div>
        </div>

        {daysLeft !== null && daysLeft <= 7 && (
          <div className={`app-surface rounded-[28px] p-5 ${daysLeft <= 0 ? 'border-red-200 bg-red-50/90' : 'border-amber-200 bg-amber-50/90'}`}>
            <p className="app-kicker">{daysLeft <= 0 ? 'Deadline passed' : 'Urgent timeline'}</p>
            <p className={`mt-2 text-lg font-semibold ${daysLeft <= 0 ? 'text-red-800' : 'text-amber-800'}`}>
              {daysLeft <= 0
                ? 'This appeal is now past deadline.'
                : `This appeal deadline is in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Make sure the next action is visible and the supporting draft is ready for whoever picks it up.
            </p>
          </div>
        )}

        {!appeal ? (
          <div className="app-surface rounded-[30px] px-6 py-16 text-center text-slate-500">
            Loading appeal...
          </div>
        ) : editing ? (
          <section className="app-surface rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <p className="app-kicker">Edit appeal</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Appeal details</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Keep the dispute summary, deadline, and draft language current so the case can move without friction.
              </p>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Reason</label>
                <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="app-input" />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="app-select">
                    {STATUSES.map(status => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Notes</label>
                <textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="app-textarea" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Appeal letter</label>
                <textarea rows={14} value={form.template} onChange={e => setForm({ ...form, template: e.target.value })} className="app-textarea app-data" />
              </div>

              <button type="submit" disabled={saving} className="app-button-primary disabled:translate-y-0 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </section>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
            <section className="app-surface rounded-[30px] p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <p className="app-kicker">Appeal summary</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Case context</h2>
                </div>
                <StatusBadge status={appeal.status} />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <InfoCard label="Deadline" value={formatDate(appeal.deadline)} />
                <InfoCard label="Status" value={appeal.status} />
              </div>

              {appeal.notes && (
                <div className="mt-5 rounded-[24px] bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Notes</p>
                  <p className="mt-3 text-sm leading-7 text-slate-700">{appeal.notes}</p>
                </div>
              )}
            </section>

            <section className="space-y-6">
              <div className="app-surface rounded-[30px] p-5 sm:p-6">
                <p className="app-kicker">Linked tender</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Origin matter</h2>
                {appeal.tender ? (
                  <div className="mt-5 rounded-[24px] bg-slate-50 p-5">
                    <p className="text-sm font-semibold text-slate-900">{appeal.tender.title}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      Keep the dispute attached to the tender so context, entity history, and outcome all stay together.
                    </p>
                    <Link href={`/tenders/${appeal.tender.id}`} className="app-button-secondary mt-5">
                      Open tender
                    </Link>
                  </div>
                ) : (
                  <div className="mt-5 rounded-[24px] bg-slate-50 p-5 text-sm leading-7 text-slate-500">
                    This appeal is not linked to a tender yet.
                  </div>
                )}
              </div>

              {appeal.template && (
                <div className="app-surface rounded-[30px] p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="app-kicker">Draft letter</p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Appeal draft</h2>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(appeal.template)}
                      className="app-button-secondary"
                    >
                      Copy draft
                    </button>
                  </div>
                  <pre className="app-data mt-5 max-h-96 overflow-auto rounded-[24px] bg-slate-50 p-5 text-sm leading-7 text-slate-700 whitespace-pre-wrap">
                    {appeal.template}
                  </pre>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-[24px] bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value || 'Not set'}</p>
    </div>
  )
}
