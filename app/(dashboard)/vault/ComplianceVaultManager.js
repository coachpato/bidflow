'use client'

import { useMemo, useState } from 'react'
import { COMPLIANCE_DOCUMENT_TYPES, getComplianceStatus } from '@/lib/compliance-status'

const EMPTY_UPLOAD_FORM = {
  documentType: COMPLIANCE_DOCUMENT_TYPES[0],
  description: '',
  issueDate: '',
  expiryDate: '',
  notes: '',
  isDefault: true,
}

function formatDateInput(value) {
  if (!value) return ''
  return new Date(value).toISOString().slice(0, 10)
}

function formatDisplayDate(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-ZA', {
    dateStyle: 'medium',
  })
}

function toneStyles(tone) {
  if (tone === 'danger') return 'bg-rose-50 text-rose-700'
  if (tone === 'warning') return 'bg-amber-50 text-amber-700'
  if (tone === 'good') return 'bg-emerald-50 text-emerald-700'
  return 'bg-slate-100 text-slate-600'
}

function toEditForm(document) {
  return {
    documentType: document.documentType,
    description: document.description || '',
    issueDate: formatDateInput(document.issueDate),
    expiryDate: formatDateInput(document.expiryDate),
    notes: document.notes || '',
    isDefault: document.isDefault,
  }
}

export default function ComplianceVaultManager({ initialDocuments }) {
  const [documents, setDocuments] = useState(initialDocuments)
  const [form, setForm] = useState(EMPTY_UPLOAD_FORM)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForms, setEditForms] = useState(() => Object.fromEntries(
    initialDocuments.map(document => [document.id, toEditForm(document)])
  ))
  const [savingId, setSavingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const summary = useMemo(() => {
    const expiringSoon = documents.filter(document => {
      const statusInfo = getComplianceStatus(document)
      return statusInfo.tone === 'warning' || statusInfo.tone === 'danger'
    }).length

    const defaults = documents.filter(document => document.isDefault).length

    return { expiringSoon, defaults }
  }, [documents])

  function updateField(name, value) {
    setForm(current => ({
      ...current,
      [name]: value,
    }))
  }

  function updateEditField(documentId, name, value) {
    setEditForms(current => ({
      ...current,
      [documentId]: {
        ...current[documentId],
        [name]: value,
      },
    }))
  }

  function upsertDocument(nextDocument, options = {}) {
    const clearDefaultType = options.clearDefaultType || false

    setDocuments(current => {
      const normalizedCurrent = clearDefaultType
        ? current.map(document => (
            document.documentType === nextDocument.documentType
              ? { ...document, isDefault: document.id === nextDocument.id }
              : document
          ))
        : current
      const filtered = normalizedCurrent.filter(document => document.id !== nextDocument.id)
      return [nextDocument, ...filtered].sort((left, right) => {
        const leftTime = left.expiryDate ? new Date(left.expiryDate).getTime() : Number.MAX_SAFE_INTEGER
        const rightTime = right.expiryDate ? new Date(right.expiryDate).getTime() : Number.MAX_SAFE_INTEGER
        return leftTime - rightTime
      })
    })
    setEditForms(current => ({
      ...current,
      [nextDocument.id]: toEditForm(nextDocument),
    }))
  }

  async function handleUpload(event) {
    event.preventDefault()
    if (!file) {
      setStatus('Choose a file before uploading to the vault.')
      return
    }

    setIsUploading(true)
    setStatus('')

    try {
      const payload = new FormData()
      payload.set('file', file)
      payload.set('documentType', form.documentType)
      payload.set('description', form.description)
      payload.set('issueDate', form.issueDate)
      payload.set('expiryDate', form.expiryDate)
      payload.set('notes', form.notes)
      payload.set('isDefault', form.isDefault ? 'true' : 'false')

      const response = await fetch('/api/vault', {
        method: 'POST',
        body: payload,
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Upload failed.')

      upsertDocument(result, { clearDefaultType: form.isDefault })
      setFile(null)
      setForm(EMPTY_UPLOAD_FORM)
      setStatus('Document added to the vault.')
    } catch (error) {
      setStatus(error.message || 'Upload failed.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleSave(documentId) {
    setSavingId(documentId)
    setStatus('')

    try {
      const response = await fetch(`/api/vault/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForms[documentId]),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not update document.')

      upsertDocument(result, { clearDefaultType: editForms[documentId].isDefault })
      setEditingId(null)
    } catch (error) {
      setStatus(error.message || 'Could not update document.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleDelete(documentId) {
    setDeletingId(documentId)
    setStatus('')

    try {
      const response = await fetch(`/api/vault/${documentId}`, {
        method: 'DELETE',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not delete document.')

      setDocuments(current => current.filter(document => document.id !== documentId))
      setEditingId(current => (current === documentId ? null : current))
    } catch (error) {
      setStatus(error.message || 'Could not delete document.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-[24px] p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Upload compliance document</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
          Add the reusable documents your firm relies on in submissions, and tell Bid360 when they expire.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-[16px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{documents.length}</span> documents
            </div>
            <div className="rounded-[16px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <span className="font-semibold text-amber-700">{summary.expiringSoon}</span> expiring soon
            </div>
            <div className="rounded-[16px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <span className="font-semibold text-emerald-700">{summary.defaults}</span> defaults set
            </div>
          </div>
        </div>

        <form onSubmit={handleUpload} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Document type</span>
            <select value={form.documentType} onChange={event => updateField('documentType', event.target.value)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
              {COMPLIANCE_DOCUMENT_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Issue date</span>
            <input type="date" value={form.issueDate} onChange={event => updateField('issueDate', event.target.value)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Expiry date</span>
            <input type="date" value={form.expiryDate} onChange={event => updateField('expiryDate', event.target.value)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
          </label>
          <label className="space-y-2 xl:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Description</span>
            <input value={form.description} onChange={event => updateField('description', event.target.value)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" placeholder="Current SARS pin, annual PI cover, latest certificate" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">File</span>
            <input type="file" onChange={event => setFile(event.target.files?.[0] || null)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
          </label>
          <label className="space-y-2 xl:col-span-3">
            <span className="text-sm font-semibold text-slate-700">Notes</span>
            <textarea value={form.notes} onChange={event => updateField('notes', event.target.value)} rows={3} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" placeholder="Mention any tender-specific usage guidance or caveats." />
          </label>
          <label className="xl:col-span-3 inline-flex items-center gap-3 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={form.isDefault} onChange={event => updateField('isDefault', event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Mark as the default document for this type
          </label>

          <div className="xl:col-span-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className={`text-sm ${status && (status.includes('failed') || status.includes('Could not') || status.includes('Choose')) ? 'text-rose-700' : 'text-slate-500'}`}>
              {status || 'The vault will drive expiry reminders and, later, submission readiness checks.'}
            </p>
            <button type="submit" disabled={isUploading} className="app-button-primary disabled:cursor-not-allowed disabled:opacity-70">
              {isUploading ? 'Uploading...' : 'Add to vault'}
            </button>
          </div>
        </form>
      </section>

      <section className="app-surface rounded-[24px] p-5 sm:p-6">
        <div className="mb-5 border-b border-slate-100 pb-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Vault documents</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Review what is current, what is default, and what needs replacement before it blocks a live pursuit.
          </p>
        </div>

        <div className="space-y-4">
          {documents.length === 0 ? (
            <div className="rounded-[20px] bg-slate-50 px-5 py-10 text-center text-sm font-semibold text-slate-600">
              No compliance documents have been uploaded yet.
            </div>
          ) : documents.map(document => {
            const statusInfo = getComplianceStatus(document)
            const isEditing = editingId === document.id
            const editForm = editForms[document.id] || toEditForm(document)

            return (
              <div key={document.id} className="rounded-[20px] border border-slate-200 bg-white/90 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{document.filename}</p>
                      {document.isDefault ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Default</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{document.documentType}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneStyles(statusInfo.tone)}`}>
                      {statusInfo.label}
                    </span>
                    <a href={document.filepath} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                      Open
                    </a>
                    <button type="button" onClick={() => setEditingId(current => current === document.id ? null : document.id)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                      {isEditing ? 'Close' : 'Edit'}
                    </button>
                    <button type="button" onClick={() => handleDelete(document.id)} disabled={deletingId === document.id} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                      {deletingId === document.id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">Issued:</span> {formatDisplayDate(document.issueDate)}
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">Expires:</span> {formatDisplayDate(document.expiryDate)}
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">Uploaded by:</span> {document.uploadedBy?.name || 'Unknown'}
                  </p>
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">Added:</span> {formatDisplayDate(document.createdAt)}
                  </p>
                </div>

                {document.description ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600">{document.description}</p>
                ) : null}
                {document.notes ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">{document.notes}</p>
                ) : null}

                {isEditing ? (
                  <div className="mt-4 rounded-[18px] border border-slate-200 bg-slate-50/80 p-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Document type</span>
                        <select value={editForm.documentType} onChange={event => updateEditField(document.id, 'documentType', event.target.value)} className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
                          {COMPLIANCE_DOCUMENT_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Issue date</span>
                        <input type="date" value={editForm.issueDate} onChange={event => updateEditField(document.id, 'issueDate', event.target.value)} className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                      </label>
                      <label className="space-y-2">
                        <span className="text-sm font-semibold text-slate-700">Expiry date</span>
                        <input type="date" value={editForm.expiryDate} onChange={event => updateEditField(document.id, 'expiryDate', event.target.value)} className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                      </label>
                      <label className="space-y-2 xl:col-span-2">
                        <span className="text-sm font-semibold text-slate-700">Description</span>
                        <input value={editForm.description} onChange={event => updateEditField(document.id, 'description', event.target.value)} className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                      </label>
                      <label className="space-y-2 xl:col-span-3">
                        <span className="text-sm font-semibold text-slate-700">Notes</span>
                        <textarea value={editForm.notes} onChange={event => updateEditField(document.id, 'notes', event.target.value)} rows={3} className="w-full rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
                      </label>
                      <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-700 xl:col-span-3">
                        <input type="checkbox" checked={editForm.isDefault} onChange={event => updateEditField(document.id, 'isDefault', event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                        Mark as the default document for this type
                      </label>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <button type="button" onClick={() => handleSave(document.id)} disabled={savingId === document.id} className="app-button-primary disabled:cursor-not-allowed disabled:opacity-70">
                        {savingId === document.id ? 'Saving...' : 'Save document details'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
