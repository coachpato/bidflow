'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSectorLabel } from '@/lib/sectors'

function subscriptionKey(subscription) {
  return subscription.sector
}

function buildEditForms(subscriptions) {
  return Object.fromEntries(
    subscriptions.map(subscription => [
      subscriptionKey(subscription),
      {
        keywords: subscription.keywords || '',
        location: subscription.location || '',
      },
    ])
  )
}

export default function ManageSubscriptions() {
  const [email, setEmail] = useState('')
  const [searchedEmail, setSearchedEmail] = useState('')
  const [subscriptions, setSubscriptions] = useState([])
  const [editForms, setEditForms] = useState({})
  const [loading, setLoading] = useState(false)
  const [savingSector, setSavingSector] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  async function lookupSubscriptions(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    setHasSearched(false)

    const response = await fetch(`/api/subscriptions?email=${encodeURIComponent(email)}`)
    const data = await response.json().catch(() => ({}))
    setLoading(false)
    setHasSearched(true)

    if (!response.ok) {
      setError(data.errors?.email || data.error || 'Could not find subscriptions.')
      setSubscriptions([])
      setEditForms({})
      return
    }

    setSearchedEmail(email.trim().toLowerCase())
    setSubscriptions(data.subscriptions || [])
    setEditForms(buildEditForms(data.subscriptions || []))
  }

  function updateEditForm(sector, field, value) {
    setEditForms(current => ({
      ...current,
      [sector]: {
        ...(current[sector] || {}),
        [field]: value,
      },
    }))
  }

  function updateSubscriptionState(updatedSubscription) {
    setSubscriptions(current => current.map(subscription => (
      subscription.sector === updatedSubscription.sector ? updatedSubscription : subscription
    )))
    setEditForms(current => ({
      ...current,
      [updatedSubscription.sector]: {
        keywords: updatedSubscription.keywords || '',
        location: updatedSubscription.location || '',
      },
    }))
  }

  async function saveSubscription(subscription) {
    const sector = subscription.sector
    const editForm = editForms[sector] || {}

    setSavingSector(sector)
    setError('')
    setMessage('')

    const response = await fetch('/api/subscriptions', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        email: searchedEmail,
        sector,
        keywords: editForm.keywords,
        location: editForm.location,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setSavingSector('')

    if (!response.ok) {
      setError(data.error || 'Could not update the subscription.')
      return
    }

    updateSubscriptionState(data.subscription)
    setMessage(`${getSectorLabel(sector)} subscription updated.`)
  }

  async function unsubscribe(subscription) {
    const sector = subscription.sector

    setSavingSector(sector)
    setError('')
    setMessage('')

    const response = await fetch('/api/subscriptions', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        email: searchedEmail,
        sector,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setSavingSector('')

    if (!response.ok) {
      setError(data.error || 'Could not unsubscribe.')
      return
    }

    updateSubscriptionState(data.subscription)
    setMessage(`${getSectorLabel(sector)} subscription unsubscribed.`)
  }

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      <form onSubmit={lookupSubscriptions} className="space-y-4">
        <div>
          <label htmlFor="manage-email">Email</label>
          <input
            id="manage-email"
            type="email"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@example.co.za"
            className="app-input"
            required
          />
        </div>
        <button type="submit" className="app-button-primary" disabled={loading}>
          {loading ? 'Checking...' : 'Find subscriptions'}
        </button>
      </form>

      {error ? <div className="alert alert-error mt-5" role="alert">{error}</div> : null}
      {message ? <div className="alert alert-success mt-5" role="status">{message}</div> : null}

      {hasSearched && subscriptions.length === 0 ? (
        <div className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--background-muted)] p-5">
          <p className="text-sm text-[var(--foreground-secondary)]">
            No subscriptions found for that email.
          </p>
          <Link href="/" className="mt-4 inline-flex app-button-secondary">
            Back to registration
          </Link>
        </div>
      ) : null}

      {subscriptions.length > 0 ? (
        <div className="mt-7 space-y-4">
          {subscriptions.map(subscription => {
            const sector = subscription.sector
            const editForm = editForms[sector] || { keywords: '', location: '' }
            const isSaving = savingSector === sector

            return (
              <section key={sector} className="rounded-lg border border-[var(--line)] bg-white/50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{getSectorLabel(sector)}</h2>
                    <p className="text-sm text-[var(--foreground-secondary)]">
                      {subscription.entityName}
                    </p>
                  </div>
                  <span className={`app-badge ${subscription.subscribed ? 'app-badge-success' : 'app-badge-warning'}`}>
                    {subscription.subscribed ? 'Subscribed' : 'Unsubscribed'}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${sector}-keywords`}>Keywords</label>
                    <input
                      id={`${sector}-keywords`}
                      value={editForm.keywords}
                      onChange={event => updateEditForm(sector, 'keywords', event.target.value)}
                      className="app-input"
                      placeholder="e.g., solar panels"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${sector}-location`}>Location</label>
                    <input
                      id={`${sector}-location`}
                      value={editForm.location}
                      onChange={event => updateEditForm(sector, 'location', event.target.value)}
                      className="app-input"
                      placeholder="e.g., Gauteng"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    className="app-button-secondary"
                    onClick={() => saveSubscription(subscription)}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    className="app-button-danger"
                    onClick={() => unsubscribe(subscription)}
                    disabled={isSaving || !subscription.subscribed}
                  >
                    Unsubscribe
                  </button>
                </div>
              </section>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
