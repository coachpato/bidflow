'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'
import UserSelect from '@/app/components/UserSelect'
import StatusBadge from '@/app/components/StatusBadge'

const DOCUMENT_TYPES = ['Appointment Letter', 'Work Order', 'SLA', 'Rate Card', 'Addendum', 'Other']
const APPOINTMENT_STATUSES = ['Appointed', 'Dormant', 'Active', 'Completed', 'Closed']
const INSTRUCTION_STATUSES = ['No Instruction', 'Instruction Received']

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

function seedForm(data) {
  return {
    title: data.title || '',
    client: data.client || '',
    assignedUserId: data.assignedUserId ? String(data.assignedUserId) : '',
    assignedTo: data.assignedUser?.name || data.assignedTo || '',
    appointmentStatus: data.appointmentStatus || 'Appointed',
    instructionStatus: data.instructionStatus || 'No Instruction',
    appointmentDate: data.appointmentDate ? data.appointmentDate.substring(0, 10) : '',
    firstInstructionDate: data.firstInstructionDate ? data.firstInstructionDate.substring(0, 10) : '',
    startDate: data.startDate ? data.startDate.substring(0, 10) : '',
    endDate: data.endDate ? data.endDate.substring(0, 10) : '',
    renewalDate: data.renewalDate ? data.renewalDate.substring(0, 10) : '',
    cancelDate: data.cancelDate ? data.cancelDate.substring(0, 10) : '',
    lastFollowUpAt: data.lastFollowUpAt ? data.lastFollowUpAt.substring(0, 10) : '',
    nextFollowUpAt: data.nextFollowUpAt ? data.nextFollowUpAt.substring(0, 10) : '',
    value: data.value || '',
    milestoneSummary: data.milestoneSummary || '',
    notes: data.notes || '',
  }
}

export default function ContractDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [appointment, setAppointment] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [documentType, setDocumentType] = useState('Appointment Letter')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [deletingDocumentId, setDeletingDocumentId] = useState(null)
  const [milestoneForm, setMilestoneForm] = useState({ title: '', dueDate: '', notes: '' })
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [deletingMilestoneId, setDeletingMilestoneId] = useState(null)

  async function fetchAppointment() {
    const res = await fetch(`/api/contracts/${id}`)
    if (!res.ok) {
      router.push('/appointments')
      return
    }

    const data = await res.json()
    setAppointment(data)
    setForm(seedForm(data))
  }

  useEffect(() => {
    fetchAppointment()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAssignedUserChange(assignedUserId, assignedUser) {
    setForm(current => ({
      ...current,
      assignedUserId,
      assignedTo: assignedUser?.name || assignedUser?.email || '',
    }))
  }

  async function handleSave(event) {
    event.preventDefault()
    setSaving(true)
    await fetch(`/api/contracts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setEditing(false)
    fetchAppointment()
  }

  async function handleDelete() {
    if (!confirm('Delete this appointment? This cannot be undone.')) return
    await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
    router.push('/appointments')
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

      await fetchAppointment()
    } catch {
      setUploadError('Document upload failed. Please try again.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function deleteDocument(docId) {
    if (!confirm('Remove this document from the appointment?')) return
    setDeletingDocumentId(docId)

    try {
      await fetch(`/api/contracts/${id}/documents/${docId}`, { method: 'DELETE' })
      await fetchAppointment()
    } finally {
      setDeletingDocumentId(null)
    }
  }

  async function addMilestone(event) {
    event.preventDefault()
    if (!milestoneForm.title.trim()) return

    setAddingMilestone(true)
    await fetch(`/api/contracts/${id}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(milestoneForm),
    })
    setMilestoneForm({ title: '', dueDate: '', notes: '' })
    setAddingMilestone(false)
    fetchAppointment()
  }

  async function toggleMilestone(milestone) {
    await fetch(`/api/contracts/${id}/milestones/${milestone.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completedAt: milestone.completedAt ? null : new Date().toISOString(),
      }),
    })
    fetchAppointment()
  }

  async function removeMilestone(milestoneId) {
    if (!confirm('Remove this milestone?')) return
    setDeletingMilestoneId(milestoneId)

    try {
      await fetch(`/api/contracts/${id}/milestones/${milestoneId}`, { method: 'DELETE' })
      await fetchAppointment()
    } finally {
      setDeletingMilestoneId(null)
    }
  }

  const daysUntilEnd = appointment?.endDate
    ? Math.ceil((new Date(appointment.endDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="space-y-6">
      <Header
        title={appointment?.title || 'Appointment workspace'}
        eyebrow="Appointment detail"
        description="Track appointment status, instructions, follow-ups, milestones, and source documents in one place."
        meta={appointment ? [
          { label: 'Client', value: appointment.client || 'Not set' },
          { label: 'Allocated to', value: getAssignedLabel(appointment) },
          { label: 'Appointment', value: appointment.appointmentStatus || 'Appointed' },
          { label: 'Instruction', value: appointment.instructionStatus || 'No Instruction' },
          { label: 'Files', value: `${appointment.documents?.length || 0}` },
        ] : []}
      />

      <div className="app-page space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/appointments" className="app-button-secondary">
            Back to appointments
          </Link>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setEditing(!editing)} className="app-button-secondary">
              {editing ? 'Cancel edit' : 'Edit appointment'}
            </button>
            <button onClick={handleDelete} className="app-button-danger">
              Delete
            </button>
          </div>
        </div>

        {daysUntilEnd !== null && daysUntilEnd <= 30 ? (
          <div className={`app-surface rounded-[28px] p-5 ${daysUntilEnd <= 0 ? 'border-red-200 bg-red-50/90' : 'border-amber-200 bg-amber-50/90'}`}>
            <p className="app-kicker">{daysUntilEnd <= 0 ? 'End date passed' : 'Upcoming end date'}</p>
            <p className={`mt-2 text-lg font-semibold ${daysUntilEnd <= 0 ? 'text-red-800' : 'text-amber-800'}`}>
              {daysUntilEnd <= 0
                ? 'This appointment has moved past its planned end date.'
                : `This appointment reaches its end date in ${daysUntilEnd} day${daysUntilEnd === 1 ? '' : 's'}.`}
            </p>
          </div>
        ) : null}

        {!appointment ? (
          <div className="app-surface rounded-[30px] px-6 py-16 text-center text-slate-500">
            Loading appointment...
          </div>
        ) : editing ? (
          <section className="app-surface rounded-[30px] p-5 sm:p-6">
            <div className="border-b border-slate-100 pb-5">
              <p className="app-kicker">Edit appointment</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Appointment details</h2>
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Title</label>
                  <input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Client</label>
                  <input value={form.client} onChange={event => setForm({ ...form, client: event.target.value })} className="app-input" />
                </div>
                <div>
                  <UserSelect
                    label="Allocated to"
                    value={form.assignedUserId}
                    onChange={handleAssignedUserChange}
                    helperText="This controls who sees the appointment in My Work."
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Appointment status</label>
                  <select value={form.appointmentStatus} onChange={event => setForm({ ...form, appointmentStatus: event.target.value })} className="app-select">
                    {APPOINTMENT_STATUSES.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Instruction status</label>
                  <select value={form.instructionStatus} onChange={event => setForm({ ...form, instructionStatus: event.target.value })} className="app-select">
                    {INSTRUCTION_STATUSES.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Appointment date</label>
                  <input type="date" value={form.appointmentDate} onChange={event => setForm({ ...form, appointmentDate: event.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">First instruction date</label>
                  <input type="date" value={form.firstInstructionDate} onChange={event => setForm({ ...form, firstInstructionDate: event.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Start date</label>
                  <input type="date" value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">End date</label>
                  <input type="date" value={form.endDate} onChange={event => setForm({ ...form, endDate: event.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Renewal date</label>
                  <input type="date" value={form.renewalDate} onChange={event => setForm({ ...form, renewalDate: event.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Cancellation date</label>
                  <input type="date" value={form.cancelDate} onChange={event => setForm({ ...form, cancelDate: event.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Last follow-up</label>
                  <input type="date" value={form.lastFollowUpAt} onChange={event => setForm({ ...form, lastFollowUpAt: event.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Next follow-up</label>
                  <input type="date" value={form.nextFollowUpAt} onChange={event => setForm({ ...form, nextFollowUpAt: event.target.value })} className="app-input" />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Value (ZAR)</label>
                  <input type="number" value={form.value} onChange={event => setForm({ ...form, value: event.target.value })} className="app-input" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Milestone summary</label>
                  <textarea rows={3} value={form.milestoneSummary} onChange={event => setForm({ ...form, milestoneSummary: event.target.value })} className="app-textarea" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Notes</label>
                  <textarea rows={4} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className="app-textarea" />
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
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5">
                  <div>
                    <p className="app-kicker">Appointment summary</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Key record details</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={appointment.appointmentStatus || 'Appointed'} />
                    <StatusBadge status={appointment.instructionStatus || 'No Instruction'} />
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <InfoCard label="Client" value={appointment.client} />
                  <InfoCard label="Allocated to" value={getAssignedLabel(appointment)} />
                  <InfoCard label="Value" value={formatMoney(appointment.value)} />
                  <InfoCard label="Appointment date" value={formatDate(appointment.appointmentDate)} />
                  <InfoCard label="First instruction" value={formatDate(appointment.firstInstructionDate)} />
                  <InfoCard label="Start date" value={formatDate(appointment.startDate)} />
                  <InfoCard label="End date" value={formatDate(appointment.endDate)} />
                  <InfoCard label="Renewal date" value={formatDate(appointment.renewalDate)} />
                  <InfoCard label="Last follow-up" value={formatDate(appointment.lastFollowUpAt)} />
                  <InfoCard label="Next follow-up" value={formatDate(appointment.nextFollowUpAt)} />
                </div>

                {appointment.milestoneSummary ? (
                  <div className="mt-5 rounded-[24px] bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Milestone summary</p>
                    <p className="mt-3 text-sm leading-7 text-slate-700">{appointment.milestoneSummary}</p>
                  </div>
                ) : null}

                {appointment.notes ? (
                  <div className="mt-5 rounded-[24px] bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Notes</p>
                    <p className="mt-3 text-sm leading-7 text-slate-700">{appointment.notes}</p>
                  </div>
                ) : null}
              </section>

              <div className="space-y-6">
                <section className="app-surface rounded-[30px] p-5 sm:p-6">
                  <p className="app-kicker">Linked pursuit</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Origin matter</h2>
                  {appointment.tender ? (
                    <div className="mt-5 rounded-[24px] bg-slate-50 p-5">
                      <p className="text-sm font-semibold text-slate-900">{appointment.tender.title}</p>
                      <Link href={`/pursuits/${appointment.tender.id}`} className="app-button-secondary mt-5">
                        Open pursuit
                      </Link>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-[24px] bg-slate-50 p-5 text-sm leading-7 text-slate-500">
                      No pursuit is linked to this appointment yet.
                    </div>
                  )}
                </section>

                <section className="app-surface rounded-[30px] p-5 sm:p-6">
                  <p className="app-kicker">Next move</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Follow-up posture</h2>
                  <div className="mt-5 rounded-[24px] bg-slate-50 p-5">
                    <p className="text-sm font-semibold text-slate-900">
                      {appointment.instructionStatus === 'No Instruction'
                        ? 'This appointment still needs follow-up to convert into live work.'
                        : 'Instructions are flowing. Keep milestones and dates current.'}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Next follow-up: {formatDate(appointment.nextFollowUpAt)}
                    </p>
                  </div>
                </section>
              </div>
            </div>

            <section className="app-surface rounded-[30px] p-5 sm:p-6">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="app-kicker">Milestones</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Deliverables and reminders</h2>
                </div>
              </div>

              <form onSubmit={addMilestone} className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)_auto]">
                <input
                  value={milestoneForm.title}
                  onChange={event => setMilestoneForm(current => ({ ...current, title: event.target.value }))}
                  placeholder="Milestone title"
                  className="app-input"
                />
                <input
                  type="date"
                  value={milestoneForm.dueDate}
                  onChange={event => setMilestoneForm(current => ({ ...current, dueDate: event.target.value }))}
                  className="app-input"
                />
                <input
                  value={milestoneForm.notes}
                  onChange={event => setMilestoneForm(current => ({ ...current, notes: event.target.value }))}
                  placeholder="Notes"
                  className="app-input"
                />
                <button type="submit" disabled={addingMilestone} className="app-button-primary disabled:translate-y-0 disabled:opacity-60">
                  {addingMilestone ? 'Adding...' : 'Add milestone'}
                </button>
              </form>

              {appointment.milestones?.length ? (
                <div className="mt-5 space-y-3">
                  {appointment.milestones.map(milestone => (
                    <div key={milestone.id} className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white/80 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{milestone.title}</p>
                          <StatusBadge status={milestone.completedAt ? 'Completed' : 'Draft'} />
                        </div>
                        <p className="mt-2 text-sm text-slate-500">
                          Due {formatDate(milestone.dueDate)}
                        </p>
                        {milestone.notes ? (
                          <p className="mt-2 text-sm leading-6 text-slate-600">{milestone.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => toggleMilestone(milestone)} className="app-button-secondary">
                          {milestone.completedAt ? 'Mark open' : 'Mark complete'}
                        </button>
                        <button
                          onClick={() => removeMilestone(milestone.id)}
                          disabled={deletingMilestoneId === milestone.id}
                          className="app-button-danger disabled:opacity-60"
                        >
                          {deletingMilestoneId === milestone.id ? 'Removing...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[24px] bg-slate-50 px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-800">No milestones yet.</p>
                </div>
              )}
            </section>

            <section className="app-surface rounded-[30px] p-5 sm:p-6">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="app-kicker">Appointment documents</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Letters, work orders, and supporting files</h2>
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

              {uploadError ? (
                <div className="mt-5 rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {uploadError}
                </div>
              ) : null}

              {appointment.documents?.length ? (
                <div className="mt-5 space-y-3">
                  {appointment.documents.map(document => (
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
                  <p className="text-sm font-semibold text-slate-800">No appointment documents yet.</p>
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
