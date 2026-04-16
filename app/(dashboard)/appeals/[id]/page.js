'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'

const CHALLENGE_TYPES = ['Administrative Appeal', 'Bid Protest', 'Review']
const STATUSES = ['Pending', 'Submitted', 'Won', 'Lost']
const DOCUMENT_TYPES = ['Evidence', 'Letter', 'Notice', 'Outcome', 'Other']

function formatDate(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-ZA')
}

function parseChecklist(value) {
  if (!Array.isArray(value)) return []
  return value
}

function seedForm(data) {
  return {
    reason: data.reason || '',
    challengeType: data.challengeType || 'Administrative Appeal',
    exclusionReason: data.exclusionReason || '',
    exclusionDate: data.exclusionDate ? data.exclusionDate.substring(0, 10) : '',
    deadline: data.deadline ? data.deadline.substring(0, 10) : '',
    status: data.status || 'Pending',
    submittedAt: data.submittedAt ? data.submittedAt.substring(0, 10) : '',
    resolvedAt: data.resolvedAt ? data.resolvedAt.substring(0, 10) : '',
    requestedRelief: data.requestedRelief || '',
    nextStep: data.nextStep || '',
    notes: data.notes || '',
    template: data.template || '',
    evidenceChecklistText: parseChecklist(data.evidenceChecklist).join('\n'),
  }
}

export default function AppealDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [challenge, setChallenge] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [documentType, setDocumentType] = useState('Evidence')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [deletingDocumentId, setDeletingDocumentId] = useState(null)

  async function fetchChallenge() {
    const res = await fetch(`/api/appeals/${id}`)
    if (!res.ok) {
      router.push('/challenges')
      return
    }

    const data = await res.json()
    setChallenge(data)
    setForm(seedForm(data))
  }

  useEffect(() => {
    fetchChallenge()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    await fetch(`/api/appeals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        evidenceChecklist: form.evidenceChecklistText
          .split('\n')
          .map(item => item.trim())
          .filter(Boolean),
      }),
    })
    setSaving(false)
    setEditing(false)
    fetchChallenge()
  }

  async function handleDelete() {
    if (!confirm('Delete this challenge? This cannot be undone.')) return
    await fetch(`/api/appeals/${id}`, { method: 'DELETE' })
    router.push('/challenges')
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadError('')
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentType', documentType)

    try {
      const response = await fetch(`/api/appeals/${id}/documents`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()
      if (!response.ok) {
        setUploadError(data.error || 'Document upload failed.')
        setUploading(false)
        return
      }

      await fetchChallenge()
    } catch {
      setUploadError('Document upload failed. Please try again.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function deleteDocument(docId) {
    if (!confirm('Remove this challenge document?')) return
    setDeletingDocumentId(docId)

    try {
      await fetch(`/api/appeals/${id}/documents/${docId}`, { method: 'DELETE' })
      await fetchChallenge()
    } finally {
      setDeletingDocumentId(null)
    }
  }

  const daysLeft = challenge?.deadline
    ? Math.ceil((new Date(challenge.deadline) - new Date()) / (1000 * 60 * 60 * 24))
    : null
  const evidenceChecklist = parseChecklist(challenge?.evidenceChecklist)

  return (
    <div className="space-y-6">
      <Header
        title={challenge?.reason || 'Challenge workspace'}
        eyebrow="Challenge detail"
        description="Keep the exclusion facts, deadline, evidence, and draft correspondence together while the challenge is active."
        meta={challenge ? [
          { label: 'Type', value: challenge.challengeType || 'Administrative Appeal' },
          { label: 'Status', value: challenge.status || 'Pending' },
          { label: 'Deadline', value: formatDate(challenge.deadline) },
          { label: 'Linked pursuit', value: challenge.tender?.title || 'Not linked' },
        ] : []}
      />

      <div className="app-page space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/challenges" className="app-button-secondary">
            Back to challenges
          </Link>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setEditing(!editing)} className="app-button-secondary">
              {editing ? 'Cancel edit' : 'Edit challenge'}
            </button>
            <button onClick={handleDelete} className="app-button-danger">
              Delete
            </button>
          </div>
        </div>

        {daysLeft !== null && daysLeft <= 7 ? (
          <div className={`app-surface rounded-[28px] p-5 ${daysLeft <= 0 ? 'border-red-200 bg-red-50/90' : 'border-amber-200 bg-amber-50/90'}`}>
            <p className="app-kicker">{daysLeft <= 0 ? 'Deadline passed' : 'Urgent timeline'}</p>
            <p className={`mt-2 text-lg font-semibold ${daysLeft <= 0 ? 'text-red-800' : 'text-amber-800'}`}>
              {daysLeft <= 0
                ? 'This challenge is now past deadline.'
                : `This challenge deadline is in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`}
            </p>
          </div>
        ) : null}

        {!challenge ? (
          <div className="app-surface rounded-[30px] px-6 py-16 text-center text-slate-500">
            Loading challenge...
          </div>
        ) : editing ? (
          <section className="app-surface rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <p className="app-kicker">Edit challenge</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Challenge details</h2>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Challenge summary</label>
                <input value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} className="app-input" />
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
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Deadline</label>
                  <input type="date" value={form.deadline} onChange={event => setForm({ ...form, deadline: event.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Submitted at</label>
                  <input type="date" value={form.submittedAt} onChange={event => setForm({ ...form, submittedAt: event.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Resolved at</label>
                  <input type="date" value={form.resolvedAt} onChange={event => setForm({ ...form, resolvedAt: event.target.value })} className="app-input" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Exclusion reason given</label>
                <textarea rows={3} value={form.exclusionReason} onChange={event => setForm({ ...form, exclusionReason: event.target.value })} className="app-textarea" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Requested relief</label>
                <textarea rows={3} value={form.requestedRelief} onChange={event => setForm({ ...form, requestedRelief: event.target.value })} className="app-textarea" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Next step</label>
                <textarea rows={2} value={form.nextStep} onChange={event => setForm({ ...form, nextStep: event.target.value })} className="app-textarea" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Evidence checklist</label>
                <textarea rows={4} value={form.evidenceChecklistText} onChange={event => setForm({ ...form, evidenceChecklistText: event.target.value })} className="app-textarea" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Notes</label>
                <textarea rows={4} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className="app-textarea" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Draft correspondence</label>
                <textarea rows={14} value={form.template} onChange={event => setForm({ ...form, template: event.target.value })} className="app-textarea app-data" />
              </div>

              <button type="submit" disabled={saving} className="app-button-primary disabled:translate-y-0 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </section>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
              <section className="app-surface rounded-[30px] p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <p className="app-kicker">Challenge summary</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Case context</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={challenge.challengeType || 'Administrative Appeal'} />
                    <StatusBadge status={challenge.status || 'Pending'} />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <InfoCard label="Deadline" value={formatDate(challenge.deadline)} />
                  <InfoCard label="Exclusion date" value={formatDate(challenge.exclusionDate)} />
                  <InfoCard label="Submitted at" value={formatDate(challenge.submittedAt)} />
                  <InfoCard label="Resolved at" value={formatDate(challenge.resolvedAt)} />
                </div>

                {challenge.exclusionReason ? (
                  <NoteCard label="Exclusion reason given" value={challenge.exclusionReason} />
                ) : null}
                {challenge.requestedRelief ? (
                  <NoteCard label="Requested relief" value={challenge.requestedRelief} />
                ) : null}
                {challenge.nextStep ? (
                  <NoteCard label="Next step" value={challenge.nextStep} />
                ) : null}
                {challenge.notes ? (
                  <NoteCard label="Internal notes" value={challenge.notes} />
                ) : null}
              </section>

              <section className="space-y-6">
                <div className="app-surface rounded-[30px] p-5 sm:p-6">
                  <p className="app-kicker">Linked pursuit</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Origin matter</h2>
                  {challenge.tender ? (
                    <div className="mt-5 rounded-[24px] bg-slate-50 p-5">
                      <p className="text-sm font-semibold text-slate-900">{challenge.tender.title}</p>
                      <p className="mt-2 text-sm text-slate-500">{challenge.tender.entity}</p>
                      <Link href={`/pursuits/${challenge.tender.id}`} className="app-button-secondary mt-5">
                        Open pursuit
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[24px] bg-slate-50 p-5 text-sm leading-7 text-slate-500">
                      This challenge is not linked to a pursuit yet.
                    </div>
                  )}
                </div>

                <div className="app-surface rounded-[30px] p-5 sm:p-6">
                  <p className="app-kicker">Evidence checklist</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">What still needs to be assembled</h2>
                  {evidenceChecklist.length > 0 ? (
                    <div className="mt-5 space-y-2">
                      {evidenceChecklist.map(item => (
                        <div key={item} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[24px] bg-slate-50 p-5 text-sm leading-7 text-slate-500">
                      No evidence checklist has been captured yet.
                    </div>
                  )}
                </div>
              </section>
            </div>

            {challenge.template ? (
              <section className="app-surface rounded-[30px] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="app-kicker">Draft correspondence</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Challenge draft</h2>
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(challenge.template)} className="app-button-secondary">
                    Copy draft
                  </button>
                </div>
                <pre className="app-data mt-5 max-h-96 overflow-auto rounded-[24px] bg-slate-50 p-5 text-sm leading-7 whitespace-pre-wrap text-slate-700">
                  {challenge.template}
                </pre>
              </section>
            ) : null}

            <section className="app-surface rounded-[30px] p-5 sm:p-6">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="app-kicker">Challenge documents</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Evidence and correspondence</h2>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <select
                    value={documentType}
                    onChange={event => setDocumentType(event.target.value)}
                    className="app-select min-w-[12rem]"
                  >
                    {DOCUMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>

                  <label className="app-button-primary cursor-pointer whitespace-nowrap">
                    {uploading ? 'Uploading...' : 'Upload file'}
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>
              </div>

              {uploadError ? (
                <div className="mt-5 rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {uploadError}
                </div>
              ) : null}

              {challenge.documents?.length ? (
                <div className="mt-5 space-y-3">
                  {challenge.documents.map(document => (
                    <div key={document.id} className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white/80 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                            {document.documentType}
                          </span>
                          <a href={document.filepath} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-semibold text-slate-900 hover:text-[var(--brand-500)]">
                            {document.filename}
                          </a>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Uploaded {formatDate(document.uploadedAt)}</p>
                      </div>

                      <div className="flex gap-2">
                        <a href={document.filepath} target="_blank" rel="noopener noreferrer" className="app-button-secondary">
                          Open
                        </a>
                        <button
                          onClick={() => deleteDocument(document.id)}
                          disabled={deletingDocumentId === document.id}
                          className="app-button-danger disabled:opacity-60"
                        >
                          {deletingDocumentId === document.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[24px] bg-slate-50 px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-800">No challenge documents yet.</p>
                </div>
              )}
            </section>
          </>
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

function NoteCard({ label, value }) {
  return (
    <div className="mt-5 rounded-[24px] bg-slate-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-sm leading-7 text-slate-700">{value}</p>
    </div>
  )
}
