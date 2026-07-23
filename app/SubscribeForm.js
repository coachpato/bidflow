'use client'

import { useState } from 'react'
import { getSectorLabel, SECTORS } from '@/lib/sectors'

const INITIAL_FORM = {
  email: '',
  entityName: '',
  sector: '',
  keywords: '',
  location: '',
}

function getClientErrors(form) {
  const errors = {}

  if (!form.email.trim()) {
    errors.email = 'Email is required.'
  }

  if (!form.entityName.trim()) {
    errors.entityName = 'Entity or business name is required.'
  }

  if (!form.sector) {
    errors.sector = 'Choose a sector.'
  }

  return errors
}

export default function SubscribeForm({ sectors = SECTORS }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)

  function updateField(field, value) {
    setForm(current => ({ ...current, [field]: value }))
    setErrors(current => ({ ...current, [field]: undefined }))
    setSuccess(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const nextErrors = getClientErrors(form)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setLoading(true)

    const response = await fetch('/api/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(form),
    })

    const data = await response.json().catch(() => ({}))
    setLoading(false)

    if (!response.ok) {
      setErrors(data.errors || { form: data.error || 'Could not create the subscription.' })
      return
    }

    setSuccess({
      sector: data.subscriber?.sector || form.sector,
      updated: Boolean(data.updated),
    })
    setForm(current => ({
      ...INITIAL_FORM,
      email: current.email,
      entityName: current.entityName,
    }))
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      {success ? (
        <div className="alert alert-success mb-5" role="status">
          You&apos;re subscribed! You&apos;ll start receiving tender digests for {getSectorLabel(success.sector)}.
        </div>
      ) : null}

      {errors.form ? (
        <div className="alert alert-error mb-5" role="alert">
          {errors.form}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label htmlFor="email">Email <span className="required">*</span></label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={event => updateField('email', event.target.value)}
            placeholder="you@example.co.za"
            className={`app-input ${errors.email ? 'error' : ''}`}
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
            required
          />
          {errors.email ? <p id="email-error" className="form-error">{errors.email}</p> : null}
        </div>

        <div>
          <label htmlFor="entityName">Entity/Business Name <span className="required">*</span></label>
          <input
            id="entityName"
            name="entityName"
            value={form.entityName}
            onChange={event => updateField('entityName', event.target.value)}
            placeholder="Your business or entity"
            className={`app-input ${errors.entityName ? 'error' : ''}`}
            aria-invalid={errors.entityName ? 'true' : 'false'}
            aria-describedby={errors.entityName ? 'entityName-error' : undefined}
            required
          />
          {errors.entityName ? <p id="entityName-error" className="form-error">{errors.entityName}</p> : null}
        </div>

        <div>
          <label htmlFor="sector">Sector <span className="required">*</span></label>
          <select
            id="sector"
            name="sector"
            value={form.sector}
            onChange={event => updateField('sector', event.target.value)}
            className={`app-select ${errors.sector ? 'error' : ''}`}
            aria-invalid={errors.sector ? 'true' : 'false'}
            aria-describedby={errors.sector ? 'sector-error' : undefined}
            required
          >
            <option value="">Choose your sector</option>
            {sectors.map(sector => (
              <option key={sector.value} value={sector.value}>
                {sector.label}
              </option>
            ))}
          </select>
          {errors.sector ? <p id="sector-error" className="form-error">{errors.sector}</p> : null}
        </div>

        <div>
          <label htmlFor="keywords">Keywords</label>
          <input
            id="keywords"
            name="keywords"
            value={form.keywords}
            onChange={event => updateField('keywords', event.target.value)}
            placeholder="e.g., solar panels, road construction"
            className="app-input"
          />
        </div>

        <div>
          <label htmlFor="location">Location</label>
          <input
            id="location"
            name="location"
            value={form.location}
            onChange={event => updateField('location', event.target.value)}
            placeholder="e.g., Gauteng, Western Cape"
            className="app-input"
          />
        </div>

        <button type="submit" className="app-button-primary app-button-lg w-full" disabled={loading}>
          {loading ? 'Subscribing...' : 'Subscribe'}
        </button>
      </form>
    </div>
  )
}
