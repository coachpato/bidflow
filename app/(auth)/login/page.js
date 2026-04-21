'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AuthShell from '@/app/components/AuthShell'
import GoogleAuthButton from '@/app/components/GoogleAuthButton'

const HIGHLIGHTS = [
  {
    title: 'Centralized tender management',
    body: 'All tenders, pursuits, and contracts in one disciplined workspace.',
  },
  {
    title: 'Built-in deadlines & reminders',
    body: 'Never miss a submission or response deadline again.',
  },
  {
    title: 'Made for your sector',
    body: 'Customized for built environment, legal, and accounting firms.',
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

  function handleGoogleSuccess() {
    router.push('/dashboard')
  }

  return (
    <AuthShell
      title="Welcome back to Bid360"
      description="Sign in to your workspace"
      supportingLabel="Tender management"
      supportingDescription="For the built environment, legal, and accounting firms behind South Africa's biggest projects."
      highlights={HIGHLIGHTS}
    >
      {error && (
        <div className="mb-6 rounded-lg border border-var(--danger-500)/20 bg-var(--danger-500)/8 px-4 py-3 text-sm text-var(--danger-600) flex gap-3 items-start animate-slideInUp" role="alert">
          <span className="text-lg mt-0.5">⚠️</span>
          <div>
            <p className="font-semibold mb-1">Sign in failed</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      <GoogleAuthButton
        intent="login"
        onError={setError}
        onSuccess={handleGoogleSuccess}
        label="Continue with Google"
      />

      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-var(--muted)">
        <span className="h-px flex-1 bg-var(--line)" />
        <span>Or use email and password</span>
        <span className="h-px flex-1 bg-var(--line)" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-var(--foreground)">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="you@firm.co.za"
            className="app-input"
            aria-describedby={error ? 'error-message' : undefined}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-var(--foreground)">
              Password
            </label>
            <a href="#" className="text-xs font-semibold text-var(--brand-500) hover:text-var(--brand-600) transition">
              Forgot?
            </a>
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="Enter your password"
            className="app-input"
          />
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
              Signing in...
            </>
          ) : 'Sign in'}
        </button>
      </form>

      <div className="mt-8 border-t border-var(--line) pt-6 text-center text-sm text-var(--muted)">
        <p>
          Don't have a workspace?{' '}
          <Link href="/register" className="font-semibold text-var(--brand-500) hover:text-var(--brand-600) transition">
            Create one →
          </Link>
        </p>
      </div>
    </AuthShell>
  )
}
