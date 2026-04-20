'use client'

import { useMemo, useState } from 'react'
import {
  SERVICE_SECTOR_OPTIONS,
  getServiceSectorDiscoveryConfig,
  getServiceSectorWorkspaceCopy,
} from '@/lib/service-sectors'

function joinList(values) {
  return Array.isArray(values) ? values.join(', ') : ''
}

export default function FirmProfileForm({ initialProfile }) {
  const [form, setForm] = useState({
    displayName: initialProfile.displayName || '',
    serviceSector: initialProfile.serviceSector || '',
    legalName: initialProfile.legalName || '',
    registrationNumber: initialProfile.registrationNumber || '',
    primaryContactName: initialProfile.primaryContactName || '',
    primaryContactEmail: initialProfile.primaryContactEmail || '',
    primaryContactPhone: initialProfile.primaryContactPhone || '',
    website: initialProfile.website || '',
    overview: initialProfile.overview || '',
    practiceAreas: joinList(initialProfile.practiceAreas),
    preferredEntities: joinList(initialProfile.preferredEntities),
    targetWorkTypes: joinList(initialProfile.targetWorkTypes),
    targetProvinces: joinList(initialProfile.targetProvinces),
    minimumContractValue: initialProfile.minimumContractValue ?? '',
    maximumContractValue: initialProfile.maximumContractValue ?? '',
  })
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [isSaving, setIsSaving] = useState(false)

  const fields = useMemo(() => ([
    ['displayName', 'Display name'],
    ['legalName', 'Legal entity name'],
    ['registrationNumber', 'Registration number'],
    ['primaryContactName', 'Primary contact'],
    ['primaryContactEmail', 'Primary contact email'],
    ['primaryContactPhone', 'Primary contact phone'],
    ['website', 'Website'],
  ]), [])

  const discoveryConfig = useMemo(() => getServiceSectorDiscoveryConfig(form.serviceSector), [form.serviceSector])
  const workspaceCopy = useMemo(() => getServiceSectorWorkspaceCopy(form.serviceSector), [form.serviceSector])

  function updateField(name, value) {
    setForm(current => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch('/api/firm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Could not save the firm profile.')
      }

      setStatus({ type: 'success', message: 'Firm profile updated.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not save the firm profile.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="app-surface rounded-[24px] p-5 sm:p-6">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Firm profile</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Set the firm details Bid360 will use for opportunity matching, alerts, and internal review context.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Sector</span>
          <select
            value={form.serviceSector}
            onChange={event => updateField('serviceSector', event.target.value)}
            className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[rgba(14,110,129,0.12)]"
          >
            <option value="">Select sector</option>
            {SERVICE_SECTOR_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {fields.map(([name, label]) => (
          <label key={name} className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">{label}</span>
            <input
              value={form[name]}
              onChange={event => updateField(name, event.target.value)}
              className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[rgba(14,110,129,0.12)]"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Practice areas</span>
          <textarea
            value={form.practiceAreas}
            onChange={event => updateField('practiceAreas', event.target.value)}
            rows={4}
            className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[rgba(14,110,129,0.12)]"
            placeholder={discoveryConfig.practiceAreaOptions.join(', ')}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Preferred entities</span>
          <textarea
            value={form.preferredEntities}
            onChange={event => updateField('preferredEntities', event.target.value)}
            rows={4}
            className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[rgba(14,110,129,0.12)]"
            placeholder={discoveryConfig.preferredEntitiesPlaceholder}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Target work types</span>
          <textarea
            value={form.targetWorkTypes}
            onChange={event => updateField('targetWorkTypes', event.target.value)}
            rows={4}
            className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[rgba(14,110,129,0.12)]"
            placeholder={discoveryConfig.workTypeOptions.join(', ')}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Target provinces</span>
          <textarea
            value={form.targetProvinces}
            onChange={event => updateField('targetProvinces', event.target.value)}
            rows={4}
            className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[rgba(14,110,129,0.12)]"
            placeholder="Gauteng, Western Cape, KwaZulu-Natal"
          />
        </label>
        <div className="grid gap-4">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Minimum contract value (ZAR)</span>
            <input
              type="number"
              min="0"
              value={form.minimumContractValue}
              onChange={event => updateField('minimumContractValue', event.target.value)}
              className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[rgba(14,110,129,0.12)]"
              placeholder="250000"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Maximum contract value (ZAR)</span>
            <input
              type="number"
              min="0"
              value={form.maximumContractValue}
              onChange={event => updateField('maximumContractValue', event.target.value)}
              className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[rgba(14,110,129,0.12)]"
              placeholder="15000000"
            />
          </label>
        </div>
      </div>

      <label className="mt-4 block space-y-2">
        <span className="text-sm font-semibold text-slate-700">Overview</span>
        <textarea
          value={form.overview}
          onChange={event => updateField('overview', event.target.value)}
          rows={5}
          className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[rgba(14,110,129,0.12)]"
          placeholder={workspaceCopy.overviewPlaceholder}
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className={`text-sm ${
          status.type === 'error' ? 'text-rose-700' : status.type === 'success' ? 'text-emerald-700' : 'text-slate-500'
        }`}>
          {status.message || 'Changes save to the firm workspace for matching and day-to-day review.'}
        </p>
        <button type="submit" disabled={isSaving} className="app-button-primary disabled:cursor-not-allowed disabled:opacity-70">
          {isSaving ? 'Saving...' : 'Save firm profile'}
        </button>
      </div>
    </form>
  )
}
