'use client'

import { useState } from 'react'

const EMPTY_FORM = {
  matterName: '',
  clientName: '',
  entityName: '',
  practiceArea: '',
  workType: '',
  summary: '',
  projectValue: '',
  startedYear: '',
  completedYear: '',
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return 'Not set'
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function FirmExperienceManager({ initialExperience }) {
  const [experience, setExperience] = useState(initialExperience)
  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  function updateField(name, value) {
    setForm(current => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setStatus('')

    try {
      const response = await fetch('/api/firm/experience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not save experience record.')

      setExperience(current => [payload, ...current])
      setForm(EMPTY_FORM)
      setStatus('Experience record added.')
    } catch (error) {
      setStatus(error.message || 'Could not save experience record.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(experienceId) {
    setDeletingId(experienceId)
    setStatus('')

    try {
      const response = await fetch(`/api/firm/experience/${experienceId}`, {
        method: 'DELETE',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not remove experience record.')

      setExperience(current => current.filter(item => item.id !== experienceId))
    } catch (error) {
      setStatus(error.message || 'Could not remove experience record.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="app-surface rounded-[24px] p-5 sm:p-6">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Representative experience</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Add public-sector mandates, panels, investigations, and advisory work the firm can reference when deciding what to pursue.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Matter name</span>
          <input value={form.matterName} onChange={event => updateField('matterName', event.target.value)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Client</span>
          <input value={form.clientName} onChange={event => updateField('clientName', event.target.value)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Entity / organ of state</span>
          <input value={form.entityName} onChange={event => updateField('entityName', event.target.value)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Practice area</span>
          <input value={form.practiceArea} onChange={event => updateField('practiceArea', event.target.value)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Work type</span>
          <input value={form.workType} onChange={event => updateField('workType', event.target.value)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" placeholder="Panel, advisory, investigation" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Project value (ZAR)</span>
          <input value={form.projectValue} onChange={event => updateField('projectValue', event.target.value)} type="number" min="0" className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Started year</span>
          <input value={form.startedYear} onChange={event => updateField('startedYear', event.target.value)} type="number" min="1900" className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Completed year</span>
          <input value={form.completedYear} onChange={event => updateField('completedYear', event.target.value)} type="number" min="1900" className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">Summary</span>
          <textarea value={form.summary} onChange={event => updateField('summary', event.target.value)} rows={4} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" placeholder="Describe the legal work, sector relevance, and outcomes." />
        </label>

        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className={`text-sm ${status && status.includes('Could not') ? 'text-rose-700' : 'text-slate-500'}`}>
            {status || 'These records give the team better context when reviewing new state-work opportunities.'}
          </p>
          <button type="submit" disabled={isSaving} className="app-button-primary disabled:cursor-not-allowed disabled:opacity-70">
            {isSaving ? 'Saving...' : 'Add experience'}
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-3">
        {experience.length === 0 ? (
          <div className="rounded-[20px] bg-slate-50 px-5 py-8 text-center text-sm font-semibold text-slate-600">
            No representative matters captured yet.
          </div>
        ) : experience.map(item => (
          <div key={item.id} className="rounded-[20px] border border-slate-200 bg-white/90 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.matterName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {[item.entityName, item.clientName].filter(Boolean).join(' · ') || 'Client not set'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                disabled={deletingId === item.id}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {deletingId === item.id ? 'Removing...' : 'Remove'}
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-4">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Practice area:</span> {item.practiceArea || 'Not set'}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Work type:</span> {item.workType || 'Not set'}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Value:</span> {formatCurrency(item.projectValue)}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Years:</span> {[item.startedYear, item.completedYear].filter(Boolean).join(' - ') || 'Not set'}
              </p>
            </div>
            {item.summary ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.summary}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
