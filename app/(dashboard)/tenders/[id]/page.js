'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'
import {
  isSubmissionBackupDocumentCategory,
  SUBMISSION_BACKUP_DOCUMENT_CATEGORY,
  TENDER_SOURCE_DOCUMENT_CATEGORY,
} from '@/lib/tender-document-categories'

const STATUSES = ['New', 'Under Review', 'In Progress', 'Submitted', 'Awarded', 'Lost', 'Cancelled']
const DEADLINE_WARNING_DAYS = 14

function formatDate(value) {
  if (!value) return 'No date set'
  return new Date(value).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
}

function getDaysRemaining(value) {
  if (!value) return null
  const diff = new Date(value).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getCountdownLabel(daysRemaining) {
  if (daysRemaining == null) return 'Deadline missing'
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} overdue`
  if (daysRemaining === 0) return 'Due today'
  return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
}

function getCountdownTone(daysRemaining) {
  if (daysRemaining == null) return 'text-slate-500'
  if (daysRemaining < 0 || daysRemaining <= 3) return 'text-red-600'
  if (daysRemaining <= DEADLINE_WARNING_DAYS) return 'text-amber-600'
  return 'text-emerald-700'
}

function getAssignedLabel(tender) {
  return tender?.assignedUser?.name || tender?.assignedTo || 'Unassigned'
}

export default function TenderDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [tender, setTender] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [newItem, setNewItem] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadCategory, setUploadCategory] = useState(null)
  const [uploadError, setUploadError] = useState('')

  const fetchTender = useCallback(async () => {
    const res = await fetch(`/api/tenders/${id}`)
    if (!res.ok) {
      router.push('/pursuits')
      return
    }

    setTender(await res.json())
    setLoading(false)
  }, [id, router])

  useEffect(() => {
    fetchTender()
  }, [fetchTender])

  async function updateStatus(newStatus) {
    setStatusUpdating(true)
    await fetch(`/api/tenders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    await fetchTender()
    setStatusUpdating(false)
  }

  async function toggleChecklistItem(itemId, done) {
    await fetch(`/api/tenders/${id}/checklist/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !done }),
    })
    await fetchTender()
  }

  async function addChecklistItem(event) {
    event.preventDefault()
    if (!newItem.trim()) return

    setAddingItem(true)
    await fetch(`/api/tenders/${id}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newItem }),
    })
    setNewItem('')
    setAddingItem(false)
    await fetchTender()
  }

  async function deleteChecklistItem(itemId) {
    await fetch(`/api/tenders/${id}/checklist/${itemId}`, { method: 'DELETE' })
    await fetchTender()
  }

  async function handleFileUpload(documentCategory, event) {
    const file = event.target.files[0]
    if (!file) return

    setUploadError('')
    setUploading(true)
    setUploadCategory(documentCategory)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('tenderId', id)
    formData.append('documentCategory', documentCategory)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setUploadError(data.error || 'Document upload failed.')
      } else {
        await fetchTender()
      }
    } catch {
      setUploadError('Document upload failed. Please try again.')
    } finally {
      setUploading(false)
      setUploadCategory(null)
      event.target.value = ''
    }
  }

  async function deleteDocument(docId) {
    if (!confirm('Remove this document from the pursuit?')) return
    await fetch(`/api/tenders/${id}/documents/${docId}`, { method: 'DELETE' })
    await fetchTender()
  }

  async function deleteTender() {
    if (!confirm('Are you sure you want to delete this pursuit? This cannot be undone.')) return
    await fetch(`/api/tenders/${id}`, { method: 'DELETE' })
    router.push('/pursuits')
  }

  function jumpTo(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) {
    return (
      <div>
        <Header
          title="Pursuit workspace"
          eyebrow="Pursuit detail"
          description="Loading the core pursuit details, dates, documents, and reminders..."
        />
        <div className="app-page py-8 text-slate-500">Loading pursuit workspace...</div>
      </div>
    )
  }

  const doneCount = tender.checklistItems.filter(item => item.done).length
  const totalCount = tender.checklistItems.length
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const daysRemaining = getDaysRemaining(tender.deadline)
  const sourceDocuments = tender.documents.filter(
    document => !isSubmissionBackupDocumentCategory(document.documentCategory)
  )
  const submissionBackupDocuments = tender.documents.filter(
    document => isSubmissionBackupDocumentCategory(document.documentCategory)
  )
  const createContractParams = new URLSearchParams({
    tenderId: String(tender.id),
    title: tender.title,
    client: tender.entity,
  })

  if (tender.assignedUserId) {
    createContractParams.set('assignedUserId', String(tender.assignedUserId))
    createContractParams.set('assignedTo', getAssignedLabel(tender))
  }

  const createContractHref = `/appointments/new?${createContractParams.toString()}`
  const nextStep = tender.status === 'Awarded' && !tender.contract
    ? { title: 'Turn this win into an appointment', body: 'The pursuit is awarded and ready to move into the appointment tracker.', href: createContractHref, cta: 'Create Appointment' }
    : ['Submitted', 'Awarded'].includes(tender.status) && submissionBackupDocuments.length === 0
      ? { title: 'Back up the final submission', body: 'Store the exact files that were submitted so the firm has a reliable record of what went out.', target: 'submission-pack-section', cta: 'Open Submission Backup' }
      : sourceDocuments.length === 0
        ? { title: 'Upload the source pack', body: 'Add the tender notice, clarifications, and source files so the pursuit record is complete.', target: 'documents-section', cta: 'Go to Documents' }
        : totalCount > 0 && doneCount < totalCount
          ? { title: 'Work through the checklist', body: `${totalCount - doneCount} checklist item${totalCount - doneCount === 1 ? '' : 's'} still need attention.`, target: 'checklist-section', cta: 'Review Checklist' }
          : tender.status === 'New'
            ? { title: 'Move the pursuit into active review', body: 'The key details are in place, so the next step is to start working it.', status: 'Under Review', cta: 'Set to Under Review' }
            : { title: 'Pursuit is on track', body: 'Use this page to manage dates, documents, reminders, appeals, and appointments.' }

  return (
    <div>
      <Header
        title={tender.title}
        eyebrow="Pursuit detail"
        description="Manage the pursuit simply: dates, status, documents, reminders, challenges, and post-award follow-through."
        meta={[
          { label: 'Status', value: tender.status },
          { label: 'Documents', value: `${tender.documents.length}` },
          { label: 'Checklist', value: `${doneCount}/${totalCount || 0}` },
        ]}
      />

      <div className="app-page space-y-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/pursuits" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800">
            <span aria-hidden="true">&larr;</span>
            Back to Pursuits
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href={`/tenders/${id}/edit`} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Edit Pursuit
            </Link>
            <button onClick={deleteTender} className="inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
              Delete
            </button>
          </div>
        </div>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(24,95,165,0.14),_transparent_40%),linear-gradient(135deg,_rgba(15,23,42,0.02),_rgba(24,95,165,0.07))] p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {tender.entity}
                  </span>
                  <StatusBadge status={tender.status} />
                  {tender.reference ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      Ref: {tender.reference}
                    </span>
                  ) : null}
                </div>

                <div className="max-w-3xl">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{tender.title}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    {tender.description || 'Keep the pursuit record practical and current so anyone in the firm can pick it up without extra context.'}
                  </p>
                </div>
              </div>

              {tender.status === 'Awarded' && !tender.contract ? (
                <Link
                  href={createContractHref}
                  className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm hover:-translate-y-0.5"
                  style={{ backgroundColor: '#185FA5' }}
                >
                  Create Appointment
                </Link>
              ) : null}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <InfoCard label="Deadline" value={formatDateTime(tender.deadline)} tone={getCountdownTone(daysRemaining)} helper={getCountdownLabel(daysRemaining)} />
              <InfoCard label="Assigned To" value={getAssignedLabel(tender)} helper={tender.contactEmail || 'No contact email saved'} />
              <InfoCard label="Source docs" value={`${sourceDocuments.length} file${sourceDocuments.length === 1 ? '' : 's'}`} helper={sourceDocuments.length > 0 ? 'Source pack attached' : 'No source files yet'} />
              <InfoCard label="Submission backup" value={`${submissionBackupDocuments.length} file${submissionBackupDocuments.length === 1 ? '' : 's'}`} helper={submissionBackupDocuments.length > 0 ? 'Final pack stored' : 'No final submission backup yet'} />
              <InfoCard label="Checklist" value={`${doneCount}/${totalCount || 0} complete`} helper={`${progressPct}% ready`} />
            </div>
          </div>
        </section>

        {tender.opportunity ? (
          <section className="rounded-[24px] border border-teal-200 bg-teal-50/80 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Origin opportunity</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">{tender.opportunity.title}</h2>
                <p className="mt-1 text-sm text-slate-600">This pursuit was created from the opportunity review queue.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={tender.opportunity.status} />
                <Link href={`/opportunities/${tender.opportunity.id}`} className="app-button-secondary">
                  Open opportunity
                </Link>
                {tender.opportunity.sourceUrl ? (
                  <a href={tender.opportunity.sourceUrl} target="_blank" rel="noopener noreferrer" className="app-button-secondary">
                    Open source
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Overview</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Pursuit snapshot</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">The key details below should be enough to keep the work moving without extra digging.</p>
              </div>
              <div className="grid gap-4 pt-5 sm:grid-cols-2">
                <InfoCard label="Reference" value={tender.reference || 'Not set'} />
                <InfoCard label="Status" value={tender.status} />
                <InfoCard label="Deadline" value={formatDateTime(tender.deadline)} tone={getCountdownTone(daysRemaining)} />
                <InfoCard label="Briefing Date" value={formatDateTime(tender.briefingDate)} />
                <InfoCard label="Contact Person" value={tender.contactPerson || 'Not set'} />
                <InfoCard label="Contact Email" value={tender.contactEmail || 'Not set'} />
                <InfoCard label="Assigned To" value={getAssignedLabel(tender)} />
                <InfoCard label="Created" value={formatDate(tender.createdAt)} />
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <NoteCard label="Description" value={tender.description || 'No pursuit summary captured yet.'} />
                <NoteCard label="Internal Notes" value={tender.notes || 'No internal notes have been added yet.'} />
              </div>
            </section>

            <section id="documents-section" className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader
                eyebrow="Documents"
                title="Source documents"
                description="Keep the original tender pack, clarifications, and working source files together."
                badge={`${sourceDocuments.length} file${sourceDocuments.length === 1 ? '' : 's'}`}
              />

              <DocumentUploadCard
                uploading={uploading && uploadCategory === TENDER_SOURCE_DOCUMENT_CATEGORY}
                label="Upload source document"
                description="Tender notice PDFs, pricing sheets, clarifications, and other source files belong here."
                accept=".pdf,.docx,.doc,.xlsx"
                onChange={event => handleFileUpload(TENDER_SOURCE_DOCUMENT_CATEGORY, event)}
              />

              {uploadError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{uploadError}</div>
              ) : null}

              <DocumentList
                documents={sourceDocuments}
                emptyTitle="No source documents uploaded yet."
                emptyBody="Add the tender pack and other working files so the pursuit stays complete."
                onDelete={deleteDocument}
              />
            </section>

            <section id="submission-pack-section" className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader
                eyebrow="Submission Pack"
                title="Submitted tender backup"
                description="Store the exact files that were finally submitted. No automated drafting, just a clean record."
                badge={`${submissionBackupDocuments.length} file${submissionBackupDocuments.length === 1 ? '' : 's'}`}
              />

              <DocumentUploadCard
                uploading={uploading && uploadCategory === SUBMISSION_BACKUP_DOCUMENT_CATEGORY}
                label="Upload submitted files"
                description="Upload the final PDF bundle, signed forms, pricing sheets, or email-ready pack that actually went out."
                accept=".pdf,.docx,.doc,.xlsx,.zip"
                onChange={event => handleFileUpload(SUBMISSION_BACKUP_DOCUMENT_CATEGORY, event)}
              />

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  {submissionBackupDocuments.length > 0
                  ? `Bid360 is storing ${submissionBackupDocuments.length} submitted file${submissionBackupDocuments.length === 1 ? '' : 's'} for this pursuit.`
                  : 'Once the tender goes out, upload the exact files here so the firm can always recover the final submission set.'}
                </div>

              <DocumentList
                documents={submissionBackupDocuments}
                emptyTitle="No submitted files backed up yet."
                emptyBody="Add the final submission set here after the bid goes out."
                onDelete={deleteDocument}
              />
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionHeader
                eyebrow="Challenges"
                title="Challenges linked to this pursuit"
                description="Track any rejection, challenge, or appeal without losing the main pursuit context."
              />

              {tender.appeals.length === 0 ? (
                <EmptyPanel
                  title="No challenges linked yet."
                  body="If the outcome needs to be challenged, capture it here so the history stays with the pursuit."
                  actionHref={`/challenges/new?tenderId=${tender.id}`}
                  actionLabel="Log challenge"
                />
              ) : (
                <div className="space-y-3 pt-5">
                  {tender.appeals.map(appeal => (
                    <Link key={appeal.id} href={`/challenges/${appeal.id}`} className="block rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{appeal.reason}</p>
                          <p className="mt-1 text-xs text-slate-500">Created {formatDate(appeal.createdAt)}</p>
                        </div>
                        <StatusBadge status={appeal.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workflow</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{nextStep.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{nextStep.body}</p>
              </div>

              <div className="pt-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">{nextStep.body}</p>
                </div>

                {nextStep.cta ? (
                  <div className="mt-4">
                    {nextStep.href ? (
                      <Link href={nextStep.href} className="inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: '#185FA5' }}>
                        {nextStep.cta}
                      </Link>
                    ) : null}
                    {nextStep.target ? (
                      <button onClick={() => jumpTo(nextStep.target)} className="inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: '#185FA5' }}>
                        {nextStep.cta}
                      </button>
                    ) : null}
                    {nextStep.status ? (
                      <button onClick={() => updateStatus(nextStep.status)} disabled={statusUpdating} className="inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: '#185FA5' }}>
                        {nextStep.cta}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <MetricCard label="Current status" value={tender.status} />
                  <MetricCard label="Challenges" value={String(tender.appeals.length)} />
                  <MetricCard label="Documents" value={String(tender.documents.length)} />
                  <MetricCard label="Owner" value={getAssignedLabel(tender)} />
                </div>

                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Update status</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {STATUSES.map(status => (
                      <button
                        key={status}
                        disabled={statusUpdating || tender.status === status}
                        onClick={() => updateStatus(status)}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                          tender.status === status ? 'border-transparent text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                        style={tender.status === status ? { backgroundColor: '#185FA5' } : {}}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section id="checklist-section" className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Checklist</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Simple submission checklist</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Use the checklist as a simple working list for this pursuit. Nothing automated, just the tasks that matter.</p>
              </div>

              <div className="pt-5">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">{doneCount} of {totalCount} complete</p>
                    <p className="text-sm font-medium text-slate-500">{progressPct}%</p>
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${progressPct}%`, backgroundColor: progressPct === 100 ? '#059669' : '#185FA5' }} />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {[...tender.checklistItems].sort((a, b) => Number(a.done) - Number(b.done) || a.id - b.id).map(item => (
                    <div key={item.id} className="group rounded-2xl border border-slate-200 p-3 hover:border-slate-300 hover:bg-slate-50">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={item.done} onChange={() => toggleChecklistItem(item.id, item.done)} className="mt-1 h-4 w-4 rounded accent-[#185FA5]" />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.label}</p>
                          {(item.responsible || item.dueDate || item.notes) ? (
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              {item.responsible ? <span>Owner: {item.responsible}</span> : null}
                              {item.dueDate ? <span>Due: {formatDate(item.dueDate)}</span> : null}
                              {item.notes ? <span>{item.notes}</span> : null}
                            </div>
                          ) : null}
                        </div>
                        <button onClick={() => deleteChecklistItem(item.id)} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-300 transition-colors group-hover:text-red-500">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={addChecklistItem} className="mt-4 flex gap-2">
                  <input
                    value={newItem}
                    onChange={event => setNewItem(event.target.value)}
                    placeholder="Add a checklist item..."
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                  />
                  <button type="submit" disabled={addingItem} className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: '#185FA5' }}>
                    Add
                  </button>
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ eyebrow, title, description, badge }) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {badge ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{badge}</span> : null}
    </div>
  )
}

function DocumentUploadCard({ uploading, label, description, accept, onChange }) {
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-800">{uploading ? 'Uploading document...' : label}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <label className="inline-flex cursor-pointer items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: '#185FA5' }}>
        {uploading ? 'Uploading...' : 'Upload'}
        <input type="file" accept={accept} className="hidden" onChange={onChange} disabled={uploading} />
      </label>
    </div>
  )
}

function DocumentList({ documents, emptyTitle, emptyBody, onDelete }) {
  if (documents.length === 0) {
    return (
      <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-center">
        <p className="text-sm font-medium text-slate-700">{emptyTitle}</p>
        <p className="mt-1 text-sm text-slate-500">{emptyBody}</p>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      {documents.map(doc => (
        <div key={doc.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <a href={doc.filepath.startsWith('http') ? doc.filepath : `/${doc.filepath}`} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-semibold text-slate-800 hover:text-[#185FA5]">
              {doc.filename}
            </a>
            <p className="mt-1 text-xs text-slate-500">Uploaded {formatDate(doc.uploadedAt)}</p>
          </div>
          <div className="flex gap-2">
            <a href={doc.filepath.startsWith('http') ? doc.filepath : `/${doc.filepath}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Open
            </a>
            <button onClick={() => onDelete(doc.id)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyPanel({ title, body, actionHref, actionLabel }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-6 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="app-button-primary mt-5">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}

function InfoCard({ label, value, tone = 'text-slate-800', helper }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 text-sm font-medium ${tone}`}>{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  )
}

function NoteCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  )
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}
