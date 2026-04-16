'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'

const EDITABLE_STATUSES = ['New', 'Reviewing', 'Pursue', 'Skipped']

function formatDate(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return parsed.toLocaleString('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return 'Not set'
  return `R ${Number(value).toLocaleString('en-ZA')}`
}

function getDaysRemaining(value) {
  if (!value) return null
  const diff = new Date(value).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function getCountdownTone(daysRemaining) {
  if (daysRemaining == null) return 'text-slate-500'
  if (daysRemaining < 0 || daysRemaining <= 2) return 'text-red-600'
  if (daysRemaining <= 10) return 'text-amber-600'
  return 'text-emerald-700'
}

function getCountdownLabel(daysRemaining) {
  if (daysRemaining == null) return 'No deadline'
  if (daysRemaining < 0) return `${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} overdue`
  if (daysRemaining === 0) return 'Due today'
  return `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`
}

function toDateTimeLocalValue(value) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const pad = number => String(number).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function normalizeRequirements(value) {
  if (!Array.isArray(value)) return []

  return value
    .map(item => {
      if (typeof item === 'string') return item.trim()
      return item?.label?.trim() || ''
    })
    .filter(Boolean)
}

function normalizeAppointments(value) {
  if (!Array.isArray(value)) return []

  return value
    .map(item => {
      if (typeof item === 'string') {
        return {
          type: 'milestone',
          title: item,
          label: item,
          date: null,
        }
      }

      const title = item?.title || item?.label
      if (!title) return null

      return {
        type: item?.type || 'milestone',
        title,
        label: item?.label || item?.date || title,
        date: item?.date || null,
      }
    })
    .filter(Boolean)
}

function toFormState(opportunity) {
  return {
    title: opportunity.title || '',
    reference: opportunity.reference || '',
    entity: opportunity.entity || '',
    sourceName: opportunity.sourceName || 'eTenders.gov.za',
    sourceUrl: opportunity.sourceUrl || '',
    practiceArea: opportunity.practiceArea || '',
    summary: opportunity.summary || '',
    estimatedValue: opportunity.estimatedValue ?? '',
    deadline: toDateTimeLocalValue(opportunity.deadline),
    briefingDate: toDateTimeLocalValue(opportunity.briefingDate),
    siteVisitDate: toDateTimeLocalValue(opportunity.siteVisitDate),
    contactPerson: opportunity.contactPerson || '',
    contactEmail: opportunity.contactEmail || '',
    fitScore: opportunity.fitScore ?? '',
    status: opportunity.status || 'New',
    notes: opportunity.notes || '',
    parsedRequirements: normalizeRequirements(opportunity.parsedRequirements),
    parsedAppointments: normalizeAppointments(opportunity.parsedAppointments),
  }
}

function buildPayload(form) {
  return {
    title: form.title,
    reference: form.reference,
    entity: form.entity,
    sourceName: form.sourceName,
    sourceUrl: form.sourceUrl,
    practiceArea: form.practiceArea,
    summary: form.summary,
    estimatedValue: form.estimatedValue,
    deadline: form.deadline,
    briefingDate: form.briefingDate,
    siteVisitDate: form.siteVisitDate,
    contactPerson: form.contactPerson,
    contactEmail: form.contactEmail,
    fitScore: form.fitScore,
    status: form.status,
    notes: form.notes,
    parsedRequirements: form.parsedRequirements,
    parsedAppointments: form.parsedAppointments,
  }
}

function OpportunityDetailLayout({
  actionError,
  applyParsedInsights,
  converting,
  convertToTender,
  daysRemaining,
  documentsCount,
  form,
  opportunity,
  parseResult,
  parsing,
  removeDocument,
  runParse,
  saveOpportunity,
  saving,
  setForm,
  setParseResult,
  uploading,
  uploadError,
  handleFileUpload,
  nextStep,
  getCountdownTone,
  getCountdownLabel,
  formatMoney,
}) {
  return (
    <div className="space-y-6">
      <Header
        title={form.title}
        eyebrow="Opportunity detail"
        meta={[
          { label: 'Status', value: form.status },
          { label: 'Fit score', value: form.fitScore ? `${form.fitScore}/100` : 'Not scored' },
          { label: 'Documents', value: `${documentsCount}` },
          { label: 'Tender link', value: opportunity.tender ? 'Created' : 'Not yet' },
        ]}
      />

      <div className="app-page space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/opportunities" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800">
            <span aria-hidden="true">&larr;</span>
            Back to Opportunities
          </Link>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={saveOpportunity}
              disabled={saving}
              className="app-button-secondary disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            {opportunity.tender ? (
              <Link href={`/tenders/${opportunity.tender.id}`} className="app-button-primary">
                Open tender
              </Link>
            ) : (
              <button
                onClick={convertToTender}
                disabled={converting}
                className="app-button-primary disabled:translate-y-0 disabled:opacity-60"
              >
                {converting ? 'Converting...' : 'Convert to tender'}
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-[radial-gradient(circle_at_top_left,_rgba(23,125,109,0.16),_transparent_40%),linear-gradient(135deg,_rgba(15,23,42,0.02),_rgba(23,125,109,0.08))] p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {form.entity}
                  </span>
                  <StatusBadge status={form.status} />
                  {form.reference && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      Ref: {form.reference}
                    </span>
                  )}
                </div>

                <div className="max-w-3xl">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{form.title}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    {form.summary || 'Use this workspace to qualify the opportunity, store the source pack, and decide whether it should move into the bid pipeline.'}
                  </p>
                </div>
              </div>

              {form.sourceUrl ? (
                <a
                  href={form.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                  Open source
                </a>
              ) : null}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeroMetric
                label="Deadline"
                value={formatDateTime(form.deadline)}
                subvalue={getCountdownLabel(daysRemaining)}
                tone={getCountdownTone(daysRemaining)}
              />
              <HeroMetric
                label="Fit score"
                value={form.fitScore ? `${form.fitScore}/100` : 'Not scored'}
                subvalue={form.practiceArea || 'Practice area not set'}
              />
              <HeroMetric
                label="Estimated value"
                value={formatMoney(form.estimatedValue)}
                subvalue={form.sourceName || 'Manual capture'}
              />
              <HeroMetric
                label="Tender handoff"
                value={opportunity.tender ? 'Converted' : 'Pending'}
                subvalue={opportunity.tender ? opportunity.tender.title : 'Still at review stage'}
              />
            </div>
          </div>
        </section>

        {parseResult && (
          <section className="rounded-[24px] border border-teal-200 bg-teal-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Parsed insight</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">A source PDF was parsed successfully</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Apply the extracted dates, summary, and requirements to the opportunity form, then review before converting.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(parseResult.fields || {}).map(([key, value]) => value ? (
                <div key={key} className="rounded-2xl bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{String(value)}</p>
                </div>
              ) : null)}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={applyParsedInsights} className="app-button-primary">
                Apply parsed insights
              </button>
              <button onClick={() => setParseResult(null)} className="app-button-secondary">
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
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Opportunity details</h2>
              </div>

              <div className="grid gap-5 pt-5 sm:grid-cols-2">
                <Field label="Opportunity title">
                  <input
                    name="title"
                    value={form.title}
                    onChange={event => setForm(current => ({ ...current, title: event.target.value }))}
                    className="app-input"
                  />
                </Field>

                <Field label="Issuing entity">
                  <input
                    name="entity"
                    value={form.entity}
                    onChange={event => setForm(current => ({ ...current, entity: event.target.value }))}
                    className="app-input"
                  />
                </Field>

                <Field label="Reference">
                  <input
                    name="reference"
                    value={form.reference}
                    onChange={event => setForm(current => ({ ...current, reference: event.target.value }))}
                    className="app-input"
                  />
                </Field>

                <Field label="Status">
                  <select
                    name="status"
                    value={form.status}
                    onChange={event => setForm(current => ({ ...current, status: event.target.value }))}
                    className="app-select"
                  >
                    {(opportunity.tender ? [...EDITABLE_STATUSES, 'Converted'] : EDITABLE_STATUSES).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Source name">
                  <input
                    name="sourceName"
                    value={form.sourceName}
                    onChange={event => setForm(current => ({ ...current, sourceName: event.target.value }))}
                    className="app-input"
                  />
                </Field>

                <Field label="Source URL">
                  <input
                    type="url"
                    name="sourceUrl"
                    value={form.sourceUrl}
                    onChange={event => setForm(current => ({ ...current, sourceUrl: event.target.value }))}
                    className="app-input"
                  />
                </Field>

                <Field label="Practice area">
                  <input
                    name="practiceArea"
                    value={form.practiceArea}
                    onChange={event => setForm(current => ({ ...current, practiceArea: event.target.value }))}
                    className="app-input"
                  />
                </Field>

                <Field label="Fit score">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    name="fitScore"
                    value={form.fitScore}
                    onChange={event => setForm(current => ({ ...current, fitScore: event.target.value }))}
                    className="app-input"
                  />
                </Field>

                <Field label="Estimated value (ZAR)">
                  <input
                    type="number"
                    name="estimatedValue"
                    value={form.estimatedValue}
                    onChange={event => setForm(current => ({ ...current, estimatedValue: event.target.value }))}
                    className="app-input"
                  />
                </Field>

                <Field label="Submission deadline">
                  <input
                    type="datetime-local"
                    name="deadline"
                    value={form.deadline}
                    onChange={event => setForm(current => ({ ...current, deadline: event.target.value }))}
                    className="app-input"
                  />
                </Field>

                <Field label="Briefing date">
                  <input
                    type="datetime-local"
                    name="briefingDate"
                    value={form.briefingDate}
                    onChange={event => setForm(current => ({ ...current, briefingDate: event.target.value }))}
                    className="app-input"
                  />
                </Field>

                <Field label="Site visit date">
                  <input
                    type="datetime-local"
                    name="siteVisitDate"
                    value={form.siteVisitDate}
                    onChange={event => setForm(current => ({ ...current, siteVisitDate: event.target.value }))}
                    className="app-input"
                  />
                </Field>

                <Field label="Contact person">
                  <input
                    name="contactPerson"
                    value={form.contactPerson}
                    onChange={event => setForm(current => ({ ...current, contactPerson: event.target.value }))}
                    className="app-input"
                  />
                </Field>

                <Field label="Contact email">
                  <input
                    type="email"
                    name="contactEmail"
                    value={form.contactEmail}
                    onChange={event => setForm(current => ({ ...current, contactEmail: event.target.value }))}
                    className="app-input"
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Summary">
                    <textarea
                      name="summary"
                      rows={4}
                      value={form.summary}
                      onChange={event => setForm(current => ({ ...current, summary: event.target.value }))}
                      className="app-textarea"
                    />
                  </Field>
                </div>

                <div className="sm:col-span-2">
                  <Field label="Decision notes">
                    <textarea
                      name="notes"
                      rows={4}
                      value={form.notes}
                      onChange={event => setForm(current => ({ ...current, notes: event.target.value }))}
                      className="app-textarea"
                    />
                  </Field>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Documents</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Source documents</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Keep the notice, tender pack, schedules, and briefing material here before converting the work into a tender.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {documentsCount} file{documentsCount === 1 ? '' : 's'}
                </span>
              </div>

              <div className="pt-5">
                {uploadError && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{uploadError}</div>
                )}

                <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {uploading ? 'Uploading document...' : 'Add a new document'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">PDF, DOCX, DOC, and XLSX files are supported.</p>
                  </div>
                  <label className="app-button-primary cursor-pointer">
                    {uploading ? 'Uploading...' : 'Upload document'}
                    <input type="file" accept=".pdf,.docx,.doc,.xlsx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>

                {documentsCount === 0 ? (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-6 text-center">
                    <p className="text-sm font-medium text-slate-700">No documents uploaded yet.</p>
                    <p className="mt-1 text-sm text-slate-500">Add the public notice or tender pack so the opportunity has real source context.</p>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {opportunity.documents.map(document => (
                      <div key={document.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <a
                            href={document.filepath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-sm font-semibold text-slate-800 hover:text-[#185FA5]"
                          >
                            {document.filename}
                          </a>
                          <p className="mt-1 text-xs text-slate-500">Uploaded {formatDate(document.uploadedAt)}</p>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={document.filepath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Open
                          </a>
                          <button onClick={() => removeDocument(document.id)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
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
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Extracted structure</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Requirements and appointments</h2>
              </div>

              <div className="grid gap-6 pt-5 lg:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Requirements</p>
                  {form.parsedRequirements.length === 0 ? (
                    <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                      No parsed requirements yet.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {form.parsedRequirements.map(requirement => (
                        <div key={requirement} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                          {requirement}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">Appointments and dates</p>
                  {form.parsedAppointments.length === 0 ? (
                    <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                      No parsed appointments yet.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {form.parsedAppointments.map(appointment => (
                        <div key={`${appointment.type}-${appointment.title}-${appointment.label}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <p className="text-sm font-semibold text-slate-800">{appointment.title}</p>
                          <p className="mt-1 text-sm text-slate-500">{formatDateTime(appointment.date || appointment.label)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="border-b border-slate-100 pb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workflow</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{nextStep.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{nextStep.body}</p>
              </div>

              <div className="pt-5">
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="Status" value={form.status} />
                  <MetricCard label="Fit" value={form.fitScore ? `${form.fitScore}/100` : 'Pending'} />
                  <MetricCard label="Documents" value={String(documentsCount)} />
                  <MetricCard label="Requirements" value={String(form.parsedRequirements.length)} />
                </div>

                <div className="mt-5 space-y-3">
                  <button onClick={saveOpportunity} disabled={saving} className="app-button-secondary w-full disabled:opacity-60">
                    {saving ? 'Saving...' : 'Save opportunity'}
                  </button>
                  <button onClick={runParse} disabled={parsing || documentsCount === 0} className="app-button-secondary w-full disabled:opacity-60">
                    {parsing ? 'Parsing latest PDF...' : 'Parse latest PDF'}
                  </button>
                  {opportunity.tender ? (
                    <Link href={`/tenders/${opportunity.tender.id}`} className="app-button-primary w-full text-center">
                      Open linked tender
                    </Link>
                  ) : (
                    <button onClick={convertToTender} disabled={converting} className="app-button-primary w-full disabled:translate-y-0 disabled:opacity-60">
                      {converting ? 'Converting...' : 'Convert to tender'}
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Quick view</p>
              <div className="mt-4 space-y-3">
                <InfoCard label="Deadline" value={formatDateTime(form.deadline)} tone={getCountdownTone(daysRemaining)} />
                <InfoCard label="Briefing" value={formatDateTime(form.briefingDate)} />
                <InfoCard label="Site visit" value={formatDateTime(form.siteVisitDate)} />
                <InfoCard label="Contact" value={form.contactPerson || form.contactEmail || 'Not captured'} />
                <InfoCard label="Estimated value" value={formatMoney(form.estimatedValue)} />
                <InfoCard label="Created by" value={opportunity.createdBy?.name || opportunity.createdBy?.email || 'Unknown'} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OpportunityDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [opportunity, setOpportunity] = useState(null)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseResult, setParseResult] = useState(null)
  const [converting, setConverting] = useState(false)
  const [actionError, setActionError] = useState('')

  const fetchOpportunity = useCallback(async () => {
    const response = await fetch(`/api/opportunities/${id}`)

    if (!response.ok) {
      router.push('/opportunities')
      return
    }

    const data = await response.json()
    setOpportunity(data)
    setForm(toFormState(data))
    setLoading(false)
  }, [id, router])

  useEffect(() => {
    fetchOpportunity()
  }, [fetchOpportunity])

  async function saveOpportunity() {
    if (!form) return false

    setActionError('')
    setSaving(true)

    const response = await fetch(`/api/opportunities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(form)),
    })

    const data = await response.json()
    setSaving(false)

    if (!response.ok) {
      setActionError(data.error || 'Could not save opportunity.')
      return false
    }

    setOpportunity(data)
    setForm(toFormState(data))
    return true
  }

  async function handleFileUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadError('')
    setActionError('')
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`/api/opportunities/${id}/documents`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()

      if (!response.ok) {
        setUploadError(data.error || 'Document upload failed.')
        setUploading(false)
        return
      }

      await fetchOpportunity()
    } catch {
      setUploadError('Document upload failed. Please try again.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  async function removeDocument(docId) {
    if (!confirm('Remove this document from the opportunity?')) return

    await fetch(`/api/opportunities/${id}/documents/${docId}`, { method: 'DELETE' })
    await fetchOpportunity()
  }

  async function runParse() {
    setActionError('')
    setParsing(true)

    const response = await fetch(`/api/opportunities/${id}/parse`, {
      method: 'POST',
    })
    const data = await response.json()
    setParsing(false)

    if (!response.ok) {
      setActionError(data.error || 'Could not parse the latest PDF.')
      return
    }

    setParseResult(data)
  }

  function applyParsedInsights() {
    if (!parseResult) return

    setForm(current => {
      const next = { ...current }
      const fields = parseResult.fields || {}

      for (const [key, value] of Object.entries(fields)) {
        if (value === null || value === undefined || value === '') continue

        if (['deadline', 'briefingDate', 'siteVisitDate'].includes(key)) {
          const normalized = toDateTimeLocalValue(value)
          if (normalized) next[key] = normalized
          continue
        }

        next[key] = typeof value === 'number' ? String(value) : value
      }

      const parsedRequirements = normalizeRequirements(parseResult.requirements)
      if (parsedRequirements.length > 0) {
        next.parsedRequirements = parsedRequirements
      }

      const parsedAppointments = normalizeAppointments(parseResult.appointments)
      if (parsedAppointments.length > 0) {
        next.parsedAppointments = parsedAppointments
      }

      return next
    })

    setParseResult(null)
  }

  async function convertToTender() {
    if (!confirm('Convert this opportunity into a tender? The tender will inherit the current details and source documents.')) {
      return
    }

    const saved = await saveOpportunity()
    if (!saved) return

    setConverting(true)
    setActionError('')

    const response = await fetch(`/api/opportunities/${id}/convert`, {
      method: 'POST',
    })
    const data = await response.json()
    setConverting(false)

    if (!response.ok) {
      setActionError(data.error || 'Could not convert this opportunity.')
      return
    }

    router.push(`/tenders/${data.tenderId}`)
  }

  if (loading || !form || !opportunity) {
    return (
      <div>
        <Header
          title="Opportunity workspace"
          eyebrow="Opportunity detail"
          meta={[
            { label: 'Status', value: 'Loading' },
          ]}
        />
        <div className="app-page py-8 text-slate-500">Loading opportunity workspace...</div>
      </div>
    )
  }

  const daysRemaining = getDaysRemaining(form.deadline)
  const documentsCount = opportunity.documents?.length || 0
  const nextStep = opportunity.tender
    ? {
        title: 'Tender already created',
        body: 'This opportunity has already been handed off into the live tender workspace.',
      }
    : documentsCount === 0
      ? {
          title: 'Add the source pack',
          body: 'Upload the tender pack or notice before parsing so the opportunity has real supporting material.',
        }
      : form.status === 'New'
        ? {
            title: 'Qualify the opportunity',
            body: 'Set the fit score, review the pack, and decide if this should move into the bid pipeline.',
          }
        : form.status === 'Pursue'
          ? {
              title: 'Convert to tender',
              body: 'The opportunity is ready to become active bid work with checklist items and dates.',
            }
          : {
              title: 'Keep the decision sharp',
              body: 'Use the summary, notes, and deadlines here so the team can review it quickly without digging.',
            }

  return (
    <OpportunityDetailLayout
      actionError={actionError}
      applyParsedInsights={applyParsedInsights}
      converting={converting}
      convertToTender={convertToTender}
      daysRemaining={daysRemaining}
      documentsCount={documentsCount}
      form={form}
      opportunity={opportunity}
      parseResult={parseResult}
      parsing={parsing}
      removeDocument={removeDocument}
      runParse={runParse}
      saveOpportunity={saveOpportunity}
      saving={saving}
      setForm={setForm}
      setParseResult={setParseResult}
      uploading={uploading}
      uploadError={uploadError}
      handleFileUpload={handleFileUpload}
      nextStep={nextStep}
      getCountdownTone={getCountdownTone}
      getCountdownLabel={getCountdownLabel}
      formatMoney={formatMoney}
    />
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  )
}

function HeroMetric({ label, value, subvalue, tone = 'text-slate-500' }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
      <p className={`mt-1 text-xs font-medium ${tone}`}>{subvalue}</p>
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

function InfoCard({ label, value, tone = 'text-slate-800' }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 text-sm font-medium ${tone}`}>{value}</p>
    </div>
  )
}
