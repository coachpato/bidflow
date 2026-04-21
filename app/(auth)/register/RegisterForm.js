'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GoogleAuthButton from '@/app/components/GoogleAuthButton'
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

function getRegistrationValidationError(form, { requirePassword } = { requirePassword: false }) {
  if (!form.organizationName.trim()) {
    return 'Organization name is required.'
  }

  if (!form.serviceSector) {
    return 'Choose your sector so Bid360 can tailor your opportunity radar.'
  }

  if (form.practiceAreas.length === 0) {
    return 'Choose at least one practice area so Bid360 can tailor your opportunity radar.'
  }

  if (form.targetWorkTypes.length === 0) {
    return 'Choose at least one opportunity type so Bid360 can tailor your opportunity radar.'
  }

  if (!requirePassword) {
    return ''
  }

  if (!form.name.trim()) {
    return 'Full name is required when creating an account with email and password.'
  }

  if (!form.email.trim()) {
    return 'Email address is required when creating an account with email and password.'
  }

  if (form.password.length < 6) {
    return 'Password must be at least 6 characters.'
  }

  if (form.password !== form.confirm) {
    return 'Passwords do not match'
  }

  return ''
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

    const validationError = getRegistrationValidationError(form, { requirePassword: true })
    if (validationError) {
      setError(validationError)
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

  function handleGoogleValidation() {
    setError('')
    return getRegistrationValidationError(form, { requirePassword: false })
  }

  function handleGoogleSuccess() {
    router.push('/dashboard')
  }

  const googlePayload = {
    name: form.name,
    organizationName: form.organizationName,
    serviceSector: form.serviceSector,
    practiceAreas: form.practiceAreas,
    targetWorkTypes: form.targetWorkTypes,
    targetProvinces: form.targetProvinces,
    preferredEntities: parsePreferredEntities(form.preferredEntitiesText),
  }

  return (
    <>
      <p className="mb-6 text-sm leading-7 text-var(--foreground-secondary)">
        {isBootstrapMode
          ? 'The first registered user becomes the workspace admin and opens the initial Bid360 workspace.'
          : 'This creates a new Bid360 workspace for your team.'}
      </p>

      {error && (
        <div className="mb-5 rounded-lg border border-var(--danger-500)/20 bg-var(--danger-500)/8 px-4 py-3 text-sm text-var(--danger-600) flex gap-3 items-start" role="alert">
          <span className="text-lg mt-0.5">⚠️</span>
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold text-var(--foreground)">Organization name *</label>
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
          <label className="mb-4 block text-sm font-semibold text-var(--foreground)">Choose your sector *</label>
          <div className="grid gap-3 sm:grid-cols-3">
            {SERVICE_SECTOR_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSectorChange(option.value)}
                className={`
                  app-card p-4 transition-all
                  ${form.serviceSector === option.value
                    ? 'border-var(--brand-500) bg-var(--brand-500)/5 ring-2 ring-var(--brand-500)/20'
                    : 'hover:border-var(--brand-500)/50'
                  }
                `}
              >
                <div className="text-2xl mb-3">{getSectorIcon(option.value)}</div>
                <h3 className="font-semibold text-var(--foreground) text-left">{option.label}</h3>
                <p className="text-xs text-var(--muted) mt-2 text-left">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <section className="app-card">
          <div className="border-b border-var(--line) pb-4 mb-4">
            <p className="app-kicker">Opportunity radar</p>
            <h2 className="mt-2 text-lg font-semibold text-var(--foreground)">What should Bid360 find for you?</h2>
            <p className="mt-2 text-sm leading-6 text-var(--foreground-secondary)">
              These answers help the scraper prioritize relevant opportunities for your workspace.
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
              <label className="mb-2 block text-sm font-semibold text-var(--foreground)">
                Which public entities should Bid360 pay attention to?
              </label>
              <textarea
                rows={3}
                value={form.preferredEntitiesText}
                onChange={event => setForm(current => ({ ...current, preferredEntitiesText: event.target.value }))}
                placeholder={discoveryConfig.preferredEntitiesPlaceholder}
                className="app-textarea"
              />
              <p className="mt-2 text-xs text-var(--muted)">Optional. Separate names with commas or new lines.</p>
            </div>
          </div>
        </section>

        <GoogleAuthButton
          intent="register"
          payload={googlePayload}
          validate={handleGoogleValidation}
          onError={setError}
          onSuccess={handleGoogleSuccess}
          label="Create your account with Google"
        />

        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-var(--muted)">
          <span className="h-px flex-1 bg-var(--line)" />
          <span>Or use email and password</span>
          <span className="h-px flex-1 bg-var(--line)" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-var(--foreground)">Full name</label>
          <input
            type="text"
            value={form.name}
            onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
            placeholder="Thabo Nkosi"
            className="app-input"
          />
          <p className="mt-1 text-xs text-var(--muted)">Optional if you continue with Google.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-var(--foreground)">Email address</label>
          <input
            type="email"
            value={form.email}
            onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
            placeholder={getEmailPlaceholder()}
            className="app-input"
          />
          <p className="mt-1 text-xs text-var(--muted)">Optional if you continue with Google.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-var(--foreground)">Password</label>
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
            <label className="mb-2 block text-sm font-semibold text-var(--foreground)">
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
          className="app-button-primary w-full app-button-lg"
        >
          {loading ? (
            <>
              <div className="animate-spin">
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              </div>
              Creating workspace...
            </>
          ) : isBootstrapMode ? 'Create workspace' : 'Create account'}
        </button>
      </form>

      <div className="mt-8 border-t border-var(--line) pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-var(--muted)">
        <span>Already have a workspace?</span>
        <Link href="/login" className="font-semibold text-var(--brand-500) hover:text-var(--brand-600) transition">
          Sign in →
        </Link>
      </div>
    </>
  )
}

function getSectorIcon(sector) {
  const icons = {
    BUILT_ENVIRONMENT: '🏗️',
    LEGAL: '⚖️',
    ACCOUNTING: '📊',
  }
  return icons[sector] || '📋'
}

function SelectionGroup({ label, helper, options, selected, onToggle }) {
  return (
    <div>
      <p className="text-sm font-semibold text-var(--foreground)">{label}</p>
      <p className="mt-1 text-xs leading-5 text-var(--muted)">{helper}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map(option => {
          const active = selected.includes(option)

          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`
                rounded-full border px-4 py-2 text-sm font-medium transition
                ${active
                  ? 'border-var(--brand-500) bg-var(--brand-500) text-white'
                  : 'border-var(--line) bg-var(--surface) text-var(--foreground) hover:border-var(--brand-500) hover:bg-var(--background-muted)'
                }
              `}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
