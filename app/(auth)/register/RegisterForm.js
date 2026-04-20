'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  SERVICE_SECTOR_OPTIONS,
  SOUTH_AFRICA_PROVINCES,
  getServiceSectorDiscoveryConfig,
} from '@/lib/service-sectors'

function toggleSelection(list, value) {
  return list.includes(value)
    ? list.filter(item => item !== value)
    : [...list, value]
}

function parsePreferredEntities(value) {
  return value
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(Boolean)
}

export default function RegisterForm({ isBootstrapMode = false }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    organizationName: '',
    serviceSector: 'LEGAL',
    practiceAreas: [],
    targetWorkTypes: [],
    targetProvinces: [],
    preferredEntitiesText: '',
    email: '',
    password: '',
    confirm: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedSector = SERVICE_SECTOR_OPTIONS.find(option => option.value === form.serviceSector)
  const discoveryConfig = useMemo(
    () => getServiceSectorDiscoveryConfig(form.serviceSector),
    [form.serviceSector]
  )

  function getOrganizationPlaceholder() {
    if (form.serviceSector === 'BUILT_ENVIRONMENT') return 'Kgabo Project Consultants'
    if (form.serviceSector === 'ACCOUNTING') return 'Ndlovu Advisory'
    return 'Mokoena Legal'
  }

  function getEmailPlaceholder() {
    if (form.serviceSector === 'BUILT_ENVIRONMENT') return 'you@projects.co.za'
    if (form.serviceSector === 'ACCOUNTING') return 'you@advisory.co.za'
    return 'you@legal.co.za'
  }

  function handleSectorChange(serviceSector) {
    setForm(current => ({
      ...current,
      serviceSector,
      practiceAreas: [],
      targetWorkTypes: [],
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }

    if (form.practiceAreas.length === 0) {
      setError('Choose at least one practice area so Bid360 can tailor your opportunity radar.')
      return
    }

    if (form.targetWorkTypes.length === 0) {
      setError('Choose at least one opportunity type so Bid360 can tailor your opportunity radar.')
      return
    }

    setLoading(true)

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        organizationName: form.organizationName,
        serviceSector: form.serviceSector,
        practiceAreas: form.practiceAreas,
        targetWorkTypes: form.targetWorkTypes,
        targetProvinces: form.targetProvinces,
        preferredEntities: parsePreferredEntities(form.preferredEntitiesText),
        email: form.email,
        password: form.password,
      }),
    })

    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(data.error)
      return
    }

    router.push('/dashboard')
  }

  return (
    <>
      <p className="mb-6 text-sm leading-7 text-slate-600">
        {isBootstrapMode
          ? 'The first registered user becomes the workspace admin and opens the initial Bid360 workspace.'
          : 'This creates a new Bid360 workspace for your team.'}
      </p>

      {error && (
        <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Organization name</label>
            <input
              type="text"
              required
              value={form.organizationName}
              onChange={event => setForm(current => ({ ...current, organizationName: event.target.value }))}
              placeholder={getOrganizationPlaceholder()}
              className="app-input"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Sector</label>
            <select
              required
              value={form.serviceSector}
              onChange={event => handleSectorChange(event.target.value)}
              className="app-input"
            >
              {SERVICE_SECTOR_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {selectedSector?.description}
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white/80 p-4 sm:p-5">
          <div className="border-b border-slate-100 pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Opportunity radar</p>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">What should Bid360 look for?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              These answers stay behind the scenes and tune the scraper so your workspace starts with more relevant opportunities.
            </p>
          </div>

          <div className="mt-4 space-y-5">
            <SelectionGroup
              label={discoveryConfig.practiceAreasLabel}
              helper="Select the service lines that matter most to your firm."
              options={discoveryConfig.practiceAreaOptions}
              selected={form.practiceAreas}
              onToggle={value => setForm(current => ({
                ...current,
                practiceAreas: toggleSelection(current.practiceAreas, value),
              }))}
            />

            <SelectionGroup
              label={discoveryConfig.workTypesLabel}
              helper="Select the kinds of tenders you want the radar to prioritise."
              options={discoveryConfig.workTypeOptions}
              selected={form.targetWorkTypes}
              onToggle={value => setForm(current => ({
                ...current,
                targetWorkTypes: toggleSelection(current.targetWorkTypes, value),
              }))}
            />

            <SelectionGroup
              label="Which provinces matter most?"
              helper="Optional. Leave blank if your team wants to see opportunities nationwide."
              options={SOUTH_AFRICA_PROVINCES}
              selected={form.targetProvinces}
              onToggle={value => setForm(current => ({
                ...current,
                targetProvinces: toggleSelection(current.targetProvinces, value),
              }))}
            />

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Which public entities should Bid360 pay attention to?
              </label>
              <textarea
                rows={3}
                value={form.preferredEntitiesText}
                onChange={event => setForm(current => ({ ...current, preferredEntitiesText: event.target.value }))}
                placeholder={discoveryConfig.preferredEntitiesPlaceholder}
                className="app-textarea"
              />
              <p className="mt-2 text-xs text-slate-500">Optional. Separate names with commas or new lines.</p>
            </div>
          </div>
        </section>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Full name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
            placeholder="Thabo Nkosi"
            className="app-input"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Email address</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
            placeholder={getEmailPlaceholder()}
            className="app-input"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
              placeholder="At least 6 characters"
              className="app-input"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Confirm password
            </label>
            <input
              type="password"
              required
              value={form.confirm}
              onChange={event => setForm(current => ({ ...current, confirm: event.target.value }))}
              placeholder="Repeat password"
              className="app-input"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="app-button-primary w-full disabled:translate-y-0 disabled:opacity-60"
        >
          {loading ? 'Creating workspace...' : isBootstrapMode ? 'Create workspace' : 'Create account'}
        </button>
      </form>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>Already have access?</span>
        <p>
          <Link href="/login" className="font-semibold text-[var(--brand-500)] hover:underline">
            Sign in instead
          </Link>
        </p>
      </div>
    </>
  )
}

function SelectionGroup({ label, helper, options, selected, onToggle }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map(option => {
          const active = selected.includes(option)

          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                active
                  ? 'border-transparent bg-[var(--brand-600)] text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
