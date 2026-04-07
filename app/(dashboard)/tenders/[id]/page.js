'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import StatusBadge from '@/app/components/StatusBadge'
import Header from '@/app/components/Header'

const STATUSES = ['New', 'Under Review', 'In Progress', 'Submitted', 'Awarded', 'Lost', 'Cancelled']

export default function TenderDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [tender, setTender] = useState(null)
  const [loading, setLoading] = useState(true)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Checklist state
  const [newItem, setNewItem] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  // Document upload state
  const [uploading, setUploading] = useState(false)
  const [parsedFields, setParsedFields] = useState(null)
  const [parsingPdf, setParsingPdf] = useState(false)

  const fetchTender = useCallback(async () => {
    const res = await fetch(`/api/tenders/${id}`)
    if (!res.ok) { router.push('/tenders'); return }
    const data = await res.json()
    setTender(data)
    setLoading(false)
  }, [id, router])

  useEffect(() => { fetchTender() }, [fetchTender])

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
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('tenderId', id)

    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    setUploading(false)

    if (res.ok) {
      fetchTender()
      // Auto-parse if PDF
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
    }
  }

  async function deleteDocument(docId) {
    await fetch(`/api/tenders/${id}/documents/${docId}`, { method: 'DELETE' })
    fetchTender()
  }

  async function deleteTender() {
    if (!confirm('Are you sure you want to delete this tender? This cannot be undone.')) return
    await fetch(`/api/tenders/${id}`, { method: 'DELETE' })
    router.push('/tenders')
  }

  if (loading) {
    return (
      <div>
        <Header title="Tender" />
        <div className="p-6 text-slate-400">Loading…</div>
      </div>
    )
  }

  const doneCount = tender.checklistItems.filter(i => i.done).length
  const totalCount = tender.checklistItems.length
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <div>
      <Header title={tender.title} />
      <div className="p-6 space-y-6">

        {/* Back link + actions */}
        <div className="flex items-center justify-between">
          <Link href="/tenders" className="text-slate-400 hover:text-slate-600 text-sm">← Back to Tenders</Link>
          <div className="flex gap-2">
            <Link href={`/tenders/${id}/edit`}>
              <button className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
                Edit
              </button>
            </Link>
            <button
              onClick={deleteTender}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 border border-red-200 text-red-600 hover:bg-red-100"
            >
              Delete
            </button>
          </div>
        </div>

        {/* PDF parsed fields alert */}
        {parsedFields && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-blue-800 text-sm font-semibold mb-2">
              PDF fields extracted — review and apply if correct:
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              {Object.entries(parsedFields).map(([k, v]) => v ? (
                <div key={k}>
                  <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}: </span>
                  <span className="text-slate-800 font-medium">{v}</span>
                </div>
              ) : null)}
            </div>
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
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: '#185FA5' }}
            >
              Apply extracted fields
            </button>
            <button onClick={() => setParsedFields(null)} className="ml-2 text-sm text-slate-500 hover:text-slate-700">
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column: Tender info */}
          <div className="lg:col-span-2 space-y-6">

            {/* Info card */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">{tender.title}</h2>
                  <p className="text-slate-500 text-sm mt-0.5">{tender.entity}</p>
                </div>
                <StatusBadge status={tender.status} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <InfoField label="Reference" value={tender.reference} />
                <InfoField label="Deadline" value={tender.deadline ? new Date(tender.deadline).toLocaleString('en-ZA') : null} />
                <InfoField label="Briefing Date" value={tender.briefingDate ? new Date(tender.briefingDate).toLocaleString('en-ZA') : null} />
                <InfoField label="Contact Person" value={tender.contactPerson} />
                <InfoField label="Contact Email" value={tender.contactEmail} />
                <InfoField label="Assigned To" value={tender.assignedTo} />
                {tender.description && (
                  <div className="col-span-2">
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Description</p>
                    <p className="text-slate-700">{tender.description}</p>
                  </div>
                )}
                {tender.notes && (
                  <div className="col-span-2">
                    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-slate-700">{tender.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status update */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Update Status</h3>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map(s => (
                  <button
                    key={s}
                    disabled={statusUpdating || tender.status === s}
                    onClick={() => updateStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      tender.status === s
                        ? 'text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    style={tender.status === s ? { backgroundColor: '#185FA5' } : {}}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {tender.status === 'Awarded' && !tender.contract && (
                <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm">
                  <p className="text-green-800 font-medium">This tender was awarded!</p>
                  <Link href={`/contracts/new?tenderId=${tender.id}&title=${encodeURIComponent(tender.title)}&client=${encodeURIComponent(tender.entity)}`}>
                    <button className="mt-2 px-4 py-1.5 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700">
                      Create Contract from this Tender
                    </button>
                  </Link>
                </div>
              )}
            </div>

            {/* Documents */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-3">Documents</h3>

              <label className="flex items-center gap-2 cursor-pointer mb-4">
                <div
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer"
                  style={{ backgroundColor: '#185FA5' }}
                >
                  {uploading ? 'Uploading…' : parsingPdf ? 'Parsing PDF…' : '+ Upload Document'}
                </div>
                <input type="file" accept=".pdf,.docx,.doc,.xlsx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                <span className="text-xs text-slate-400">PDF, DOCX, XLSX accepted</span>
              </label>

              {tender.documents.length === 0 ? (
                <p className="text-slate-400 text-sm">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-2">
                  {tender.documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <a href={doc.filepath.startsWith('http') ? doc.filepath : `/${doc.filepath}`} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-[#185FA5] hover:underline">
                          {doc.filename}
                        </a>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">
                          {new Date(doc.uploadedAt).toLocaleDateString('en-ZA')}
                        </span>
                        <button onClick={() => deleteDocument(doc.id)} className="text-red-400 hover:text-red-600 text-xs">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Right column: Checklist */}
          <div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Compliance Checklist</h3>
                <span className="text-xs text-slate-500">{doneCount}/{totalCount}</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${progressPct}%`, backgroundColor: progressPct === 100 ? '#059669' : '#185FA5' }}
                />
              </div>

              <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
                {tender.checklistItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleChecklistItem(item.id, item.done)}
                      className="rounded accent-[#185FA5]"
                    />
                    <span className={`text-sm flex-1 ${item.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                      {item.label}
                    </span>
                    <button
                      onClick={() => deleteChecklistItem(item.id)}
                      className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={addChecklistItem} className="flex gap-2">
                <input
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  placeholder="Add checklist item…"
                  className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                />
                <button
                  type="submit" disabled={addingItem}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ backgroundColor: '#185FA5' }}
                >
                  Add
                </button>
              </form>
            </div>

            {/* Appeals linked to this tender */}
            {tender.appeals.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5 mt-4">
                <h3 className="font-semibold text-slate-800 mb-3">Appeals</h3>
                {tender.appeals.map(a => (
                  <Link key={a.id} href={`/appeals/${a.id}`}>
                    <div className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-700 truncate">{a.reason}</p>
                        <StatusBadge status={a.status} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="mt-4">
              <Link href={`/appeals/new?tenderId=${tender.id}`}>
                <button className="w-full px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50">
                  + Log an Appeal
                </button>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function InfoField({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-slate-800">{value}</p>
    </div>
  )
}
