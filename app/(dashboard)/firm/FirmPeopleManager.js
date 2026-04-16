'use client'

import { useState } from 'react'

function joinList(values) {
  return Array.isArray(values) ? values.join(', ') : ''
}

const EMPTY_FORM = {
  fullName: '',
  title: '',
  email: '',
  phone: '',
  yearsExperience: '',
  qualifications: '',
  practiceAreas: '',
  notes: '',
}

export default function FirmPeopleManager({ initialPeople }) {
  const [people, setPeople] = useState(initialPeople)
  const [form, setForm] = useState(EMPTY_FORM)
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  function updateField(name, value) {
    setForm(current => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setIsSaving(true)
    setStatus('')

    try {
      const response = await fetch('/api/firm/personnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not save personnel record.')

      setPeople(current => [payload, ...current])
      setForm(EMPTY_FORM)
      setStatus('Personnel record added.')
    } catch (error) {
      setStatus(error.message || 'Could not save personnel record.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(personId) {
    setDeletingId(personId)
    setStatus('')

    try {
      const response = await fetch(`/api/firm/personnel/${personId}`, {
        method: 'DELETE',
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not remove personnel record.')

      setPeople(current => current.filter(person => person.id !== personId))
    } catch (error) {
      setStatus(error.message || 'Could not remove personnel record.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="app-surface rounded-[24px] p-5 sm:p-6">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Key personnel</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Capture the lawyers and subject matter experts you want Bidflow to reference in future qualification and drafting flows.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Full name</span>
          <input value={form.fullName} onChange={event => updateField('fullName', event.target.value)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Role / title</span>
          <input value={form.title} onChange={event => updateField('title', event.target.value)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Email</span>
          <input value={form.email} onChange={event => updateField('email', event.target.value)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Phone</span>
          <input value={form.phone} onChange={event => updateField('phone', event.target.value)} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Years of experience</span>
          <input value={form.yearsExperience} onChange={event => updateField('yearsExperience', event.target.value)} type="number" min="0" className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" />
        </label>
        <div />
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Qualifications</span>
          <textarea value={form.qualifications} onChange={event => updateField('qualifications', event.target.value)} rows={3} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" placeholder="LLB, admitted attorney, mediator" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Practice areas</span>
          <textarea value={form.practiceAreas} onChange={event => updateField('practiceAreas', event.target.value)} rows={3} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" placeholder="Administrative law, labour law" />
        </label>
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">Notes</span>
          <textarea value={form.notes} onChange={event => updateField('notes', event.target.value)} rows={3} className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900" placeholder="Use this person for disciplinary matters and investigations." />
        </label>

        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className={`text-sm ${status && status.includes('Could not') ? 'text-rose-700' : 'text-slate-500'}`}>
            {status || 'These records will later support qualification decisions, CV summaries, and drafting.'}
          </p>
          <button type="submit" disabled={isSaving} className="app-button-primary disabled:cursor-not-allowed disabled:opacity-70">
            {isSaving ? 'Saving...' : 'Add person'}
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-3">
        {people.length === 0 ? (
          <div className="rounded-[20px] bg-slate-50 px-5 py-8 text-center text-sm font-semibold text-slate-600">
            No personnel records yet.
          </div>
        ) : people.map(person => (
          <div key={person.id} className="rounded-[20px] border border-slate-200 bg-white/90 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{person.fullName}</p>
                <p className="mt-1 text-sm text-slate-500">{person.title || 'Role not set'}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(person.id)}
                disabled={deletingId === person.id}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {deletingId === person.id ? 'Removing...' : 'Remove'}
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Experience:</span> {person.yearsExperience ?? 'Not set'} years
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Email:</span> {person.email || 'Not set'}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Phone:</span> {person.phone || 'Not set'}
              </p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              <span className="font-semibold text-slate-800">Qualifications:</span> {joinList(person.qualifications) || 'Not set'}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              <span className="font-semibold text-slate-800">Practice areas:</span> {joinList(person.practiceAreas) || 'Not set'}
            </p>
            {person.notes ? (
              <p className="mt-2 text-sm leading-6 text-slate-600">{person.notes}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}
