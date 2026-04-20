'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AuthShell from '@/app/components/AuthShell'

const HIGHLIGHTS = [
  {
    title: 'Built for core project advisors',
    body: 'Bid360 starts with the built environment, legal, and accounting firms behind public-sector projects.',
  },
  {
    title: 'One tender lifecycle',
    body: 'Move from discovery to pursuit, then into appointments or challenges.',
  },
  {
    title: 'Less friction, more follow-through',
    body: 'Deadlines, reminders, files, and ownership stay in one workspace.',
  },
]

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
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
    <AuthShell
      title="Welcome back"
      description="Sign in to continue"
      supportingLabel="Bid360 workspace"
      supportingDescription="Tender 360 for the built environment, legal, and accounting firms working with the state."
      highlights={HIGHLIGHTS}
    >
      {error && (
        <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Email address
          </label>
          <input
            type="email"
            required
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="you@firm.co.za"
            className="app-input"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
          <input
            type="password"
            required
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="Enter your password"
            className="app-input"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="app-button-primary w-full disabled:translate-y-0 disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>Secure workspace access.</span>
        <p>
          No account yet?{' '}
          <Link href="/register" className="font-semibold text-[var(--brand-500)] hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
