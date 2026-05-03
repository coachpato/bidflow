'use client'

import { useState } from 'react'

function formatRole(role) {
  if (!role) return 'Member'
  return `${role.charAt(0).toUpperCase()}${role.slice(1)}`
}

export default function AccountForm({ user }) {
  const [name, setName] = useState(user.name || '')
  const [isSavingName, setIsSavingName] = useState(false)
  const [nameStatus, setNameStatus] = useState({ type: 'idle', message: '' })
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [passwordStatus, setPasswordStatus] = useState({ type: 'idle', message: '' })

  function updatePasswordField(field, value) {
    setPasswordForm(current => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleNameSubmit(event) {
    event.preventDefault()
    setIsSavingName(true)
    setNameStatus({ type: 'idle', message: '' })

    try {
      const response = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Could not save account details.')
      }

      setName(payload.name || name)
      setNameStatus({ type: 'success', message: 'Account details updated.' })
    } catch (error) {
      setNameStatus({ type: 'error', message: error.message || 'Could not save account details.' })
    } finally {
      setIsSavingName(false)
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault()
    setPasswordStatus({ type: 'idle', message: '' })

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New password and confirmation do not match.' })
      return
    }

    setIsSavingPassword(true)

    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Could not change password.')
      }

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setPasswordStatus({ type: 'success', message: 'Password updated.' })
    } catch (error) {
      setPasswordStatus({ type: 'error', message: error.message || 'Could not change password.' })
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="app-surface rounded-[24px] p-5 sm:p-6">
        <div className="border-b border-slate-100 pb-4">
          <p className="app-kicker">Profile</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Personal details</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Keep your display name current for assignments, activity history, and workspace collaboration.
          </p>
        </div>

        <form onSubmit={handleNameSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Display name</span>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              className="app-input"
              maxLength={120}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input value={user.email} readOnly className="app-input" />
            <span className="block text-xs leading-5 text-slate-500">
              Email is tied to your login and cannot be changed here
            </span>
          </label>

          <div className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Role</span>
            <div>
              <span className="inline-flex rounded-full border border-slate-200 bg-[var(--background-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                {formatRole(user.role)}
              </span>
            </div>
          </div>

          <div className="flex items-end justify-start md:justify-end">
            <button type="submit" disabled={isSavingName} className="app-button-primary disabled:opacity-70">
              {isSavingName ? 'Saving...' : 'Save account'}
            </button>
          </div>
        </form>

        <p className={`mt-4 text-sm ${
          nameStatus.type === 'error' ? 'text-rose-700' : nameStatus.type === 'success' ? 'text-emerald-700' : 'text-slate-500'
        }`}>
          {nameStatus.message || 'Only your display name can be changed from this page.'}
        </p>
      </section>

      <section className="app-surface rounded-[24px] p-5 sm:p-6">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="app-kicker">Security</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Password</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Update your password for email sign-in. Google sign-in remains linked separately when enabled.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowPasswordForm(current => !current)}
            className="app-button-secondary"
          >
            {showPasswordForm ? 'Cancel' : 'Change password'}
          </button>
        </div>

        {showPasswordForm ? (
          <form onSubmit={handlePasswordSubmit} className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Current password</span>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={event => updatePasswordField('currentPassword', event.target.value)}
                className="app-input"
                autoComplete="current-password"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">New password</span>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={event => updatePasswordField('newPassword', event.target.value)}
                className="app-input"
                autoComplete="new-password"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Confirm new password</span>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={event => updatePasswordField('confirmPassword', event.target.value)}
                className="app-input"
                autoComplete="new-password"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 md:col-span-3">
              <p className={`text-sm ${
                passwordStatus.type === 'error' ? 'text-rose-700' : passwordStatus.type === 'success' ? 'text-emerald-700' : 'text-slate-500'
              }`}>
                {passwordStatus.message || 'Use at least 8 characters with one letter and one number.'}
              </p>
              <button type="submit" disabled={isSavingPassword} className="app-button-primary disabled:opacity-70">
                {isSavingPassword ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </form>
        ) : (
          <p className={`mt-4 text-sm ${
            passwordStatus.type === 'error' ? 'text-rose-700' : passwordStatus.type === 'success' ? 'text-emerald-700' : 'text-slate-500'
          }`}>
            {passwordStatus.message || 'Your current password is required before a new password can be saved.'}
          </p>
        )}
      </section>
    </div>
  )
}
