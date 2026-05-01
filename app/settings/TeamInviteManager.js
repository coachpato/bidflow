'use client'

import { useState } from 'react'

function formatDate(value) {
  if (!value) return 'Not set'
  return new Date(value).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function TeamInviteManager({ members, initialInvites }) {
  const [invites, setInvites] = useState(initialInvites)
  const [form, setForm] = useState({ name: '', email: '', role: 'member' })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ type: 'idle', message: '' })

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch('/api/settings/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Could not send the invite.')
      }

      setInvites(current => [payload, ...current.filter(item => item.id !== payload.id)])
      setForm({ name: '', email: '', role: 'member' })
      setStatus({ type: 'success', message: 'Invitation sent.' })
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Could not send the invite.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-[24px] p-5 sm:p-6">
        <div className="border-b border-slate-100 pb-4">
          <p className="app-kicker">Team</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Invite teammates</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Send Google-first invitations into this Bid360 workspace. Only admins can manage firm-wide access.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px_auto]">
          <input
            value={form.name}
            onChange={event => setForm(current => ({ ...current, name: event.target.value }))}
            placeholder="Full name"
            className="app-input"
          />
          <input
            required
            type="email"
            value={form.email}
            onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
            placeholder="teammate@firm.co.za"
            className="app-input"
          />
          <select
            value={form.role}
            onChange={event => setForm(current => ({ ...current, role: event.target.value }))}
            className="app-select"
          >
            <option value="member">Member</option>
            <option value="manager">Manager</option>
          </select>
          <button type="submit" disabled={saving} className="app-button-primary disabled:opacity-70">
            {saving ? 'Sending...' : 'Send invite'}
          </button>
        </form>

        <p className={`mt-4 text-sm ${
          status.type === 'error' ? 'text-rose-700' : status.type === 'success' ? 'text-emerald-700' : 'text-slate-500'
        }`}>
          {status.message || 'Invites are emailed with a direct Google Sign-In link.'}
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="app-surface rounded-[24px] p-5 sm:p-6">
          <div className="border-b border-slate-100 pb-4">
            <p className="app-kicker">Current access</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Workspace members</h2>
          </div>

          <div className="mt-5 space-y-3">
            {members.map(member => (
              <div key={member.id} className="rounded-[20px] border border-slate-200 bg-white/80 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{member.user.name}</p>
                <p className="mt-1 text-sm text-slate-500">{member.user.email}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {member.role}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="app-surface rounded-[24px] p-5 sm:p-6">
          <div className="border-b border-slate-100 pb-4">
            <p className="app-kicker">Pending access</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">Outstanding invites</h2>
          </div>

          <div className="mt-5 space-y-3">
            {invites.length === 0 ? (
              <div className="rounded-[20px] bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No pending invites yet.
              </div>
            ) : (
              invites.map(invite => (
                <div key={invite.id} className="rounded-[20px] border border-slate-200 bg-white/80 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">{invite.name || invite.email}</p>
                  {invite.name ? (
                    <p className="mt-1 text-sm text-slate-500">{invite.email}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold uppercase tracking-[0.16em] text-slate-600">
                      {invite.role}
                    </span>
                    <span>Expires {formatDate(invite.expiresAt)}</span>
                    <span>Status: {invite.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
