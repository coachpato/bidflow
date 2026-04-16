'use client'

import { useState } from 'react'

export default function EmailTestCard({ email, isConfigured }) {
  const [status, setStatus] = useState(null)
  const [isSending, setIsSending] = useState(false)

  async function handleSendTestEmail() {
    setIsSending(true)
    setStatus(null)

    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Unable to send test email right now.')
      }

      setStatus({ tone: 'success', message: payload.message })
    } catch (error) {
      setStatus({ tone: 'error', message: error.message })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <section className="app-surface rounded-[24px] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="app-kicker">Email delivery</p>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Test Resend</h2>
          <p className="text-sm leading-7 text-slate-600">
            Send a sample BidFlow notification to <span className="font-semibold text-slate-900">{email}</span>.
          </p>
          <p className="text-sm text-slate-500">
            {isConfigured
              ? 'Resend is configured. This uses the same delivery path as contract assignment and reminder emails.'
              : 'Add RESEND_API_KEY first. The test button will start working as soon as the key is present.'}
          </p>
        </div>

        <button
          type="button"
          className="app-button-secondary disabled:translate-y-0 disabled:opacity-60"
          onClick={handleSendTestEmail}
          disabled={!isConfigured || isSending}
        >
          {isSending ? 'Sending...' : 'Send test email'}
        </button>
      </div>

      {status && (
        <div
          className={`mt-4 rounded-[18px] px-4 py-3 text-sm ${
            status.tone === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {status.message}
        </div>
      )}
    </section>
  )
}
