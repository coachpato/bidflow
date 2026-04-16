'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import StatusBadge from '@/app/components/StatusBadge'
import Header from '@/app/components/Header'

const STATUSES = ['New', 'Under Review', 'In Progress', 'Submitted', 'Awarded', 'Lost', 'Cancelled']
const DEADLINE_WARNING_DAYS = 14

function formatDateTime(value) {
  if (!value) return 'Not scheduled'
  return new Date(value).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDate(value) {
  if (!value) return 'No date set'
  return new Date(value).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
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
  const [uploadError, setUploadError] = useState('')
  const [parsedFields, setParsedFields] = useState(null)
  const [parsingPdf, setParsingPdf] = useState(false)

  const fetchTender = useCallback(async () => {
    const res = await fetch(`/api/tenders/${id}`)
    if (!res.ok) {
      router.push('/tenders')
      return
    }
    const data = await res.json()
    setTender(data)
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
    fetchTender()
  }

  async function addChecklistItem(e) {
    e.preventDefault()
    if (!newItem.trim()) return
    setAddingItem(true)
    await fetch(`/api/tenders/${id}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newItem }),
    })
    setNewItem('')
    setAddingItem(false)
    fetchTender()
  }

  async function deleteChecklistItem(itemId) {
    await fetch(`/api/tenders/${id}/checklist/${itemId}`, { method: 'DELETE' })
    fetchTender()
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadError('')
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('tenderId', id)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      setUploading(false)

      if (!res.ok) {
        setUploadError(data.error || 'Document upload failed.')
        return
      }

      fetchTender()

      if (file.name.toLowerCase().endsWith('.pdf')) {
        setParsingPdf(true)
        const parseRes = await fetch('/api/parse-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenderId: id }),
        })
        if (parseRes.ok) {
          const parsed = await parseRes.json()
          if (parsed.fields) setParsedFields(parsed.fields)
        }
        setParsingPdf(false)
      }
    } catch {
      setUploading(false)
      setUploadError('Document upload failed. Please try again.')
    } finally {
      e.target.value = ''
    }
  }

  async function deleteDocument(docId) {
    if (!confirm('Remove this document from the tender?')) return
    await fetch(`/api/tenders/${id}/documents/${docId}`, { method: 'DELETE' })
    fetchTender()
  }

  async function deleteTender() {
    if (!confirm('Are you sure you want to delete this tender? This cannot be undone.')) return
    await fetch(`/api/tenders/${id}`, { method: 'DELETE' })
    router.push('/tenders')
  }

  function jumpTo(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (loading) {
    return (
      <div>
        <Header
          title="Tender workspace"
          eyebrow="Tender detail"
          description="Loading the tender context, checklist, and related documents..."
        />
        <div className="app-page py-8 text-slate-500">Loading tender workspace...</div>
      </div>
    )
  }

  const doneCount = tender.checklistItems.filter(item => item.done).length
  const totalCount = tender.checklistItems.length
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const documentsCount = tender.documents.length
  const daysRemaining = getDaysRemaining(tender.deadline)
  const orderedChecklistItems = [...tender.checklistItems].sort((a, b) => Number(a.done) - Number(b.done) || a.id - b.id)
  const createContractParams = new URLSearchParams({
    tenderId: String(tender.id),
    title: tender.title,
    client: tender.entity,
  })

  if (tender.assignedUserId) {
    createContractParams.set('assignedUserId', String(tender.assignedUserId))
    createContractParams.set('assignedTo', getAssignedLabel(tender))
  }

  const createContractHref = `/contracts/new?${createContractParams.toString()}`

  const nextStep = tender.status === 'Awarded' && !tender.contract
    ? { title: 'Turn this win into a contract', body: 'The tender is awarded and ready to become an active contract.', href: createContractHref, cta: 'Create Contract' }
    : documentsCount === 0
      ? { title: 'Upload the source pack', body: 'No supporting files are attached yet, so this workspace still feels empty for the team.', target: 'documents-section', cta: 'Go to Documents' }
      : totalCount > 0 && doneCount < totalCount
        ? { title: 'Finish the compliance checklist', body: `${totalCount - doneCount} checklist item${totalCount - doneCount === 1 ? '' : 's'} still need attention.`, target: 'checklist-section', cta: 'Review Checklist' }
        : tender.status === 'New'
          ? { title: 'Move the tender into active review', body: 'The core details are in place, so the next step is to move it out of backlog mode.', status: 'Under Review', cta: 'Set to Under Review' }
          : { title: 'Tender is on track', body: 'Use this page to keep files, ownership, and progress aligned as the work continues.' }

  return (
    <div>
      <Header
        title={tender.title}
        eyebrow="Tender detail"
        description="Drive the matter from intake through compliance, submission, and award follow-through."
        meta={[
          { label: 'Status', value: tender.status },
          { label: 'Documents', value: `${documentsCount}` },
          { label: 'Checklist', value: `${doneCount}/${totalCount || 0}` },
        ]}
      />
      <div className="app-page space-y-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/tenders" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800">
            <span aria-hidden="true">←</span>
            Back to Tenders
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link href={`/tenders/${id}/edit`} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Edit Tender
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
                  {tender.reference && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      Ref: {tender.reference}
                    </span>
                  )}
                </div>
                <div className="max-w-3xl">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{tender.title}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    {tender.description || 'Capture the working context, important notes, and supporting files here so everyone can step into the tender without friction.'}
                  </p>
                </div>
              </div>

              {tender.status === 'Awarded' && !tender.contract && (
                <Link
                  href={createContractHref}
                  className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm hover:-translate-y-0.5"
                  style={{ backgroundColor: '#185FA5' }}
                >
                  Create Contract
                </Link>
              )}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Deadline</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(tender.deadline)}</p>
                <p className={`mt-1 text-xs font-medium ${getCountdownTone(daysRemaining)}`}>{getCountdownLabel(daysRemaining)}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Assigned To</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{getAssignedLabel(tender)}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{tender.contactEmail || 'No contact email saved'}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Documents</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{documentsCount} file{documentsCount === 1 ? '' : 's'}</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{documentsCount > 0 ? 'Tender pack attached' : 'Nothing uploaded yet'}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Checklist</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{doneCount}/{totalCount || 0} complete</p>
                <p className="mt-1 text-xs font-medium text-slate-500">{progressPct}% ready</p>
              </div>
            </div>
          </div>
        </section>

        {tender.opportunity && (
          <section className="rounded-[24px] border border-teal-200 bg-teal-50/80 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Origin opportunity</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">{tender.opportunity.title}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  This tender was converted from the opportunity review queue.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={tender.opportunity.status} />
                <Link href={`/opportunities/${tender.opportunity.id}`} className="app-button-secondary">
                  Open opportunity
                </Link>
                {tender.opportunity.sourceUrl ? (
                  <a
                    href={tender.opportunity.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="app-button-secondary"
                  >
                    Open source
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        )}

        {parsedFields && (
          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">PDF Insight</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">Fields were extracted from the uploaded PDF</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Object.entries(parsedFields).map(([key, value]) => value ? (
                <div key={key} className="rounded-xl bg-white/80 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{String(value)}</p>
                </div>
              ) : null)}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  await fetch(`/api/tenders/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parsedFields),
                  })
                  setParsedFields(null)
                  fetchTender()
                }}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: '#185FA5' }}
              >
                Apply Extracted Fields
              </button>
              <button onClick={() => setParsedFields(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Dismiss
              </button>
            </div>
          </section>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Overview</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Tender snapshot</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">The key working details below should give any team member enough context to continue without asking around.</p>
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
                <NoteCard label="Description" value={tender.description || 'No tender summary captured yet.'} />
                <NoteCard label="Internal Notes" value={tender.notes || 'No internal notes have been added yet.'} />
              </div>
            </section>

            <section id="documents-section" className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Documents</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Tender documents</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Keep every source file in one place so the team is always working from the latest pack.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{documentsCount} file{documentsCount === 1 ? '' : 's'}</span>
              </div>
              <div className="pt-5">
                {uploadError && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{uploadError}</div>
                )}
                <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{uploading ? 'Uploading document...' : parsingPdf ? 'Reading PDF fields...' : 'Add a new document'}</p>
                    <p className="mt-1 text-sm text-slate-500">PDF, DOCX, DOC, and XLSX files are supported.</p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: '#185FA5' }}>
                    {uploading ? 'Uploading...' : parsingPdf ? 'Parsing PDF...' : 'Upload Document'}
                    <input type="file" accept=".pdf,.docx,.doc,.xlsx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>

                {documentsCount === 0 ? (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-center">
                    <p className="text-sm font-medium text-slate-700">No documents uploaded yet.</p>
                    <p className="mt-1 text-sm text-slate-500">Add the tender pack, pricing sheets, or supporting material to keep the workspace complete.</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {tender.documents.map(doc => (
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
                          <button onClick={() => deleteDocument(doc.id)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Appeals</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Appeals linked to this tender</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Track challenges or disputes without losing the main tender context.</p>
                </div>
                <Link href={`/appeals/new?tenderId=${tender.id}`} className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Log an Appeal
                </Link>
              </div>
              <div className="pt-5">
                {tender.appeals.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-6 text-center">
                    <p className="text-sm font-medium text-slate-700">No appeals linked yet.</p>
                    <p className="mt-1 text-sm text-slate-500">If a decision needs to be challenged, capture it here so the history stays with the tender.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tender.appeals.map(appeal => (
                      <Link key={appeal.id} href={`/appeals/${appeal.id}`}>
                        <div className="rounded-2xl border border-slate-200 p-4 hover:bg-slate-50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800">{appeal.reason}</p>
                              <p className="mt-1 text-xs text-slate-500">Created {formatDate(appeal.createdAt)}</p>
                            </div>
                            <StatusBadge status={appeal.status} />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
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
                {nextStep.cta && (
                  <div className="mt-4">
                    {nextStep.href && (
                      <Link href={nextStep.href} className="inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: '#185FA5' }}>
                        {nextStep.cta}
                      </Link>
                    )}
                    {nextStep.target && (
                      <button onClick={() => jumpTo(nextStep.target)} className="inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: '#185FA5' }}>
                        {nextStep.cta}
                      </button>
                    )}
                    {nextStep.status && (
                      <button onClick={() => updateStatus(nextStep.status)} disabled={statusUpdating} className="inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: '#185FA5' }}>
                        {nextStep.cta}
                      </button>
                    )}
                  </div>
                )}

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <MetricCard label="Current status" value={tender.status} />
                  <MetricCard label="Appeals" value={String(tender.appeals.length)} />
                  <MetricCard label="Documents" value={String(documentsCount)} />
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
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Compliance readiness</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Use the checklist as the live definition of done for this tender.</p>
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
                  {orderedChecklistItems.map(item => (
                    <div key={item.id} className="group rounded-2xl border border-slate-200 p-3 hover:border-slate-300 hover:bg-slate-50">
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={item.done} onChange={() => toggleChecklistItem(item.id, item.done)} className="mt-1 h-4 w-4 rounded accent-[#185FA5]" />
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.label}</p>
                          {(item.responsible || item.dueDate || item.notes) && (
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              {item.responsible && <span>Owner: {item.responsible}</span>}
                              {item.dueDate && <span>Due: {formatDate(item.dueDate)}</span>}
                              {item.notes && <span>{item.notes}</span>}
                            </div>
                          )}
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

function InfoCard({ label, value, tone = 'text-slate-800' }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 text-sm font-medium ${tone}`}>{value}</p>
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
