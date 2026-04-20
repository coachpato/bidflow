'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { SERVICE_SECTOR_OPTIONS } from '@/lib/service-sectors'

export default function RegisterForm({ isBootstrapMode = false }) {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    organizationName: '',
    serviceSector: 'LEGAL',
    email: '',
    password: '',
    confirm: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedSector = SERVICE_SECTOR_OPTIONS.find(option => option.value === form.serviceSector)

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

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        organizationName: form.organizationName,
        serviceSector: form.serviceSector,
        email: form.email,
        password: form.password,
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
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
              onChange={e => setForm({ ...form, organizationName: e.target.value })}
              placeholder={getOrganizationPlaceholder()}
              className="app-input"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Sector</label>
            <select
              required
              value={form.serviceSector}
              onChange={e => setForm({ ...form, serviceSector: e.target.value })}
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

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Full name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
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
            onChange={e => setForm({ ...form, email: e.target.value })}
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
              onChange={e => setForm({ ...form, password: e.target.value })}
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
              onChange={e => setForm({ ...form, confirm: e.target.value })}
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
