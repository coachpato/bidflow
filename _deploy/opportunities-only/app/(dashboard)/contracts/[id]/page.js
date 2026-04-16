'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'
import UserSelect from '@/app/components/UserSelect'

const DOCUMENT_TYPES = ['Signed Contract', 'SLA', 'Rate Card', 'Addendum', 'Other']

function formatDate(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-ZA')
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return 'Not set'
  return `R ${Number(value).toLocaleString('en-ZA')}`
}

function getAssignedLabel(record) {
  return record?.assignedUser?.name || record?.assignedTo || 'Unassigned'
}

export default function ContractDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [contract, setContract] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [documentType, setDocumentType] = useState('Signed Contract')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [deletingDocumentId, setDeletingDocumentId] = useState(null)

  async function fetchContract() {
    const res = await fetch(`/api/contracts/${id}`)
    if (!res.ok) {
      router.push('/contracts')
      return
    }

    const data = await res.json()
    setContract(data)
    setForm({
      title: data.title || '',
      client: data.client || '',
      assignedUserId: data.assignedUserId ? String(data.assignedUserId) : '',
      assignedTo: data.assignedUser?.name || data.assignedTo || '',
      value: data.value || '',
      startDate: data.startDate ? data.startDate.substring(0, 10) : '',
      endDate: data.endDate ? data.endDate.substring(0, 10) : '',
      renewalDate: data.renewalDate ? data.renewalDate.substring(0, 10) : '',
      cancelDate: data.cancelDate ? data.cancelDate.substring(0, 10) : '',
      notes: data.notes || '',
    })
  }

  useEffect(() => {
    let isMounted = true

    async function loadContract() {
      const res = await fetch(`/api/contracts/${id}`)
      if (!res.ok) {
        router.push('/contracts')
        return
      }

      const data = await res.json()
      if (!isMounted) return

      setContract(data)
      setForm({
        title: data.title || '',
        client: data.client || '',
        assignedUserId: data.assignedUserId ? String(data.assignedUserId) : '',
        assignedTo: data.assignedUser?.name || data.assignedTo || '',
        value: data.value || '',
        startDate: data.startDate ? data.startDate.substring(0, 10) : '',
        endDate: data.endDate ? data.endDate.substring(0, 10) : '',
        renewalDate: data.renewalDate ? data.renewalDate.substring(0, 10) : '',
        cancelDate: data.cancelDate ? data.cancelDate.substring(0, 10) : '',
        notes: data.notes || '',
      })
    }

    loadContract()

    return () => {
      isMounted = false
    }
  }, [id, router])

  function handleAssignedUserChange(assignedUserId, assignedUser) {
    setForm(current => ({
      ...current,
      assignedUserId,
      assignedTo: assignedUser?.name || assignedUser?.email || '',
    }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/contracts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setEditing(false)
    fetchContract()
  }

  async function handleDelete() {
    if (!confirm('Delete this contract? This cannot be undone.')) return
    await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
    router.push('/contracts')
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadError('')
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentType', documentType)

    try {
      const response = await fetch(`/api/contracts/${id}/documents`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setUploadError(data.error || 'Document upload failed.')
        setUploading(false)
        return
      }

      await fetchContract()
    } catch {
      setUploadError('Document upload failed. Please try again.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function deleteDocument(docId) {
    if (!confirm('Remove this document from the contract?')) return

    setDeletingDocumentId(docId)

    try {
      await fetch(`/api/contracts/${id}/documents/${docId}`, { method: 'DELETE' })
      await fetchContract()
    } finally {
      setDeletingDocumentId(null)
    }
  }

  const daysUntilEnd = contract?.endDate
    ? Math.ceil((new Date(contract.endDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="space-y-6">
      <Header
        title={contract?.title || 'Contract workspace'}
        eyebrow="Contract detail"
        description="Keep commercial terms, renewal timing, and the tender origin visible in one place."
        meta={contract ? [
          { label: 'Client', value: contract.client || 'Not set' },
          { label: 'Allocated to', value: getAssignedLabel(contract) },
          { label: 'Value', value: formatMoney(contract.value) },
          { label: 'Ends', value: formatDate(contract.endDate) },
          { label: 'Files', value: `${contract.documents?.length || 0}` },
        ] : []}
      />

      <div className="app-page space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/contracts" className="app-button-secondary">
            Back to contracts
          </Link>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setEditing(!editing)} className="app-button-secondary">
              {editing ? 'Cancel edit' : 'Edit contract'}
            </button>
            <button onClick={handleDelete} className="app-button-danger">
              Delete
            </button>
          </div>
        </div>

        {daysUntilEnd !== null && daysUntilEnd <= 30 && (
          <div className={`app-surface rounded-[28px] p-5 ${daysUntilEnd <= 0 ? 'border-red-200 bg-red-50/90' : 'border-amber-200 bg-amber-50/90'}`}>
            <p className="app-kicker">{daysUntilEnd <= 0 ? 'Expired contract' : 'Upcoming deadline'}</p>
            <p className={`mt-2 text-lg font-semibold ${daysUntilEnd <= 0 ? 'text-red-800' : 'text-amber-800'}`}>
              {daysUntilEnd <= 0
                ? 'This contract has passed its end date.'
                : `This contract expires in ${daysUntilEnd} day${daysUntilEnd === 1 ? '' : 's'}.`}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Consider renewal planning, closeout work, or confirmation that the record should remain active.
            </p>
          </div>
        )}

        {!contract ? (
          <div className="app-surface rounded-[30px] px-6 py-16 text-center text-slate-500">
            Loading contract...
          </div>
        ) : editing ? (
          <section className="app-surface rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <p className="app-kicker">Edit contract</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Contract details</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Update key dates, value, and context so the delivery record stays trustworthy.
              </p>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Title</label>
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Client</label>
                  <input value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} className="app-input" />
                </div>
                <div>
                  <UserSelect
                    label="Allocated to"
                    value={form.assignedUserId}
                    onChange={handleAssignedUserChange}
                    helperText="This controls who sees the contract in My Work."
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Value (ZAR)</label>
                  <input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Start date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">End date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Renewal date</label>
                  <input type="date" value={form.renewalDate} onChange={e => setForm({ ...form, renewalDate: e.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Cancellation date</label>
                  <input type="date" value={form.cancelDate} onChange={e => setForm({ ...form, cancelDate: e.target.value })} className="app-input" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Notes</label>
                  <textarea rows={4} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="app-textarea" />
                </div>
              </div>

              <button type="submit" disabled={saving} className="app-button-primary disabled:translate-y-0 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </form>
          </section>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.85fr)]">
              <section className="app-surface rounded-[30px] p-5 sm:p-6">
                <div className="border-b border-slate-100 pb-5">
                  <p className="app-kicker">Contract summary</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Key record details</h2>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <InfoCard label="Client" value={contract.client} />
                  <InfoCard label="Allocated to" value={getAssignedLabel(contract)} />
                  <InfoCard label="Value" value={formatMoney(contract.value)} />
                  <InfoCard label="Start date" value={formatDate(contract.startDate)} />
                  <InfoCard label="End date" value={formatDate(contract.endDate)} />
                  <InfoCard label="Renewal date" value={formatDate(contract.renewalDate)} />
                  <InfoCard label="Cancellation date" value={formatDate(contract.cancelDate)} />
                </div>

                {contract.notes && (
                  <div className="mt-5 rounded-[24px] bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Notes</p>
                    <p className="mt-3 text-sm leading-7 text-slate-700">{contract.notes}</p>
                  </div>
                )}
              </section>

              <div className="space-y-6">
                <section className="app-surface rounded-[30px] p-5 sm:p-6">
                  <p className="app-kicker">Tender origin</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Linked tender context</h2>
                  {contract.tender ? (
                    <div className="mt-5 rounded-[24px] bg-slate-50 p-5">
                      <p className="text-sm font-semibold text-slate-900">{contract.tender.title}</p>
                      <Link href={`/tenders/${contract.tender.id}`} className="app-button-secondary mt-5">
                        Open tender
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[24px] bg-slate-50 p-5 text-sm leading-7 text-slate-500">
                      No tender is linked to this contract yet.
                    </div>
                  )}
                </section>

                <section className="app-surface rounded-[30px] p-5 sm:p-6">
                  <p className="app-kicker">Renewal watch</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Next step</h2>
                  <div className="mt-5 rounded-[24px] bg-slate-50 p-5">
                    <p className="text-sm font-semibold text-slate-900">
                      {daysUntilEnd !== null && daysUntilEnd <= 30
                        ? 'Review renewal or closeout timing'
                        : 'Keep the commercial details current'}
                    </p>
                  </div>
                </section>
              </div>
            </div>

            <section className="app-surface rounded-[30px] p-5 sm:p-6">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="app-kicker">Contract documents</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">SLA, rates, addendums</h2>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <select
                    value={documentType}
                    onChange={e => setDocumentType(e.target.value)}
                    className="app-select min-w-[12rem]"
                  >
                    {DOCUMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>

                  <label className="app-button-primary cursor-pointer whitespace-nowrap">
                    {uploading ? 'Uploading...' : 'Upload file'}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>
              </div>

              {uploadError && (
                <div className="mt-5 rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {uploadError}
                </div>
              )}

              {contract.documents?.length ? (
                <div className="mt-5 space-y-3">
                  {contract.documents.map(document => (
                    <div key={document.id} className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-white/80 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                            {document.documentType}
                          </span>
                          <a
                            href={document.filepath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-sm font-semibold text-slate-900 hover:text-[var(--brand-500)]"
                          >
                            {document.filename}
                          </a>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Uploaded {formatDate(document.uploadedAt)}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <a
                          href={document.filepath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="app-button-secondary"
                        >
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
                  <p className="text-sm font-semibold text-slate-800">No contract documents yet.</p>
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
