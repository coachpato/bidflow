'use client'

import { useState } from 'react'
import Link from 'next/link'

const TEAM_SIZES = ['Solo', '2-5 people', '6-15 people', '16-50 people', '50+ people']
const PRICING_PREFERENCES = ['Monthly subscription', 'One-time license', 'Open to either']
const MONTHLY_BUDGETS = ['Under R500', 'R500-R1,500', 'R1,500-R3,000', 'R3,000+']
const LIFETIME_BUDGETS = ['Under R5,000', 'R5,000-R15,000', 'R15,000-R30,000', 'R30,000+']

export default function PilotInterestForm() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    role: '',
    teamSize: '',
    whoWouldUseIt: '',
    pricingPreference: '',
    monthlyBudget: '',
    lifetimeBudget: '',
    painPoint: '',
  })
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleChange(event) {
    setForm(current => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const response = await fetch('/api/pilot-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await response.json()
    setLoading(false)

    if (!response.ok) {
      setError(data.error || 'Something went wrong. Please try again.')
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="space-y-5">
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          Thanks. Your pilot request is in.
        </div>
        <p className="text-sm leading-7 text-slate-600">
          We&apos;ll use this to gauge demand, pricing fit, and who BidFlow should be built for first.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className="app-button-primary">
            Sign in
          </Link>
          <Link href="/" className="app-button-secondary">
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <p className="mb-6 text-sm leading-7 text-slate-600">
        Leave your details and pricing view so we can see whether there is real launch demand.
      </p>

      {error && (
        <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Your name</label>
            <input
              name="name"
              required
              value={form.name}
              onChange={handleChange}
              placeholder="Thabo Nkosi"
              className="app-input"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Work email</label>
            <input
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="you@lawfirm.co.za"
              className="app-input"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Company</label>
            <input
              name="company"
              value={form.company}
              onChange={handleChange}
              placeholder="Firm or business name"
              className="app-input"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Role</label>
            <input
              name="role"
              value={form.role}
              onChange={handleChange}
              placeholder="Director, admin, bid manager..."
              className="app-input"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Who would use BidFlow?</label>
          <textarea
            name="whoWouldUseIt"
            required
            rows={3}
            value={form.whoWouldUseIt}
            onChange={handleChange}
            placeholder="Tell us which people or team would use it and what work they would run in it."
            className="app-textarea"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Team size</label>
          <select
            name="teamSize"
            value={form.teamSize}
            onChange={handleChange}
            className="app-select"
          >
            <option value="">Select size</option>
            {TEAM_SIZES.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Preferred pricing model</label>
          <select
            name="pricingPreference"
            value={form.pricingPreference}
            onChange={handleChange}
            className="app-select"
          >
            <option value="">Select pricing model</option>
            {PRICING_PREFERENCES.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Monthly budget</label>
            <select
              name="monthlyBudget"
              value={form.monthlyBudget}
              onChange={handleChange}
              className="app-select"
            >
              <option value="">Select monthly range</option>
              {MONTHLY_BUDGETS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Lifetime budget</label>
            <select
              name="lifetimeBudget"
              value={form.lifetimeBudget}
              onChange={handleChange}
              className="app-select"
            >
              <option value="">Select one-time range</option>
              {LIFETIME_BUDGETS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Biggest pain point</label>
          <textarea
            name="painPoint"
            rows={3}
            value={form.painPoint}
            onChange={handleChange}
            placeholder="What would make this worth paying for?"
            className="app-textarea"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="app-button-primary w-full disabled:translate-y-0 disabled:opacity-60"
        >
          {loading ? 'Sending request...' : 'Request pilot access'}
        </button>
      </form>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>Already have workspace access?</span>
        <p>
          <Link href="/login" className="font-semibold text-[var(--brand-500)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </>
  )
}
