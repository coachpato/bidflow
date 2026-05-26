'use client'

import { useState } from 'react'

export default function VerificationResendForm({ initialEmail = '', compact = false }) {
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState({ type: 'idle', message: '' })

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error || 'Could not send verification email.')
      }

      setStatus({ type: 'success', message: 'Verification email sent.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not send verification email.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? 'space-y-3' : 'space-y-4'}>
      <div>
        <label className="mb-2 block text-sm font-semibold text-var(--foreground)">
          Email address
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder="you@firm.co.za"
          className="app-input"
        />
      </div>

      <button type="submit" disabled={loading} className="app-button-secondary w-full disabled:opacity-70">
        {loading ? 'Sending...' : "Didn't get it? Resend verification email"}
      </button>

      <p className={`text-sm ${
        status.type === 'error' ? 'text-rose-700' : status.type === 'success' ? 'text-emerald-700' : 'text-var(--muted)'
      }`}>
        {status.message || 'The link expires 24 hours after it is sent.'}
      </p>
    </form>
  )
}
