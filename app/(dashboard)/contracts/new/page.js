'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import Header from '@/app/components/Header'

function NewContractForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [form, setForm] = useState({
    title: searchParams.get('title') || '',
    client: searchParams.get('client') || '',
    startDate: '',
    endDate: '',
    renewalDate: '',
    cancelDate: '',
    value: '',
    notes: '',
    tenderId: searchParams.get('tenderId') || '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/contracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error); return }
    router.push(`/contracts/${data.id}`)
  }

  return (
    <div>
      <Header title="New Contract" />
      <div className="p-6 max-w-2xl">
        <Link href="/contracts" className="text-slate-400 hover:text-slate-600 text-sm mb-6 inline-block">
          ← Back to Contracts
        </Link>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-6">Contract Details</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Contract Title *</label>
                <input name="title" required value={form.title} onChange={handleChange}
                  placeholder="e.g. Legal Services Contract — eThekwini 2024"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client / Entity</label>
                <input name="client" value={form.client} onChange={handleChange}
                  placeholder="e.g. eThekwini Municipality"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contract Value (ZAR)</label>
                <input type="number" name="value" value={form.value} onChange={handleChange}
                  placeholder="e.g. 500000"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                <input type="date" name="startDate" value={form.startDate} onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                <input type="date" name="endDate" value={form.endDate} onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Renewal Date</label>
                <input type="date" name="renewalDate" value={form.renewalDate} onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cancellation Date</label>
                <input type="date" name="cancelDate" value={form.cancelDate} onChange={handleChange}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea name="notes" value={form.notes} onChange={handleChange} rows={3}
                  placeholder="Contract terms, conditions, or internal notes…"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={loading}
                className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: '#185FA5' }}>
                {loading ? 'Saving…' : 'Create Contract'}
              </button>
              <Link href="/contracts">
                <button type="button" className="px-6 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200">
                  Cancel
                </button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function NewContractPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-400">Loading…</div>}>
      <NewContractForm />
    </Suspense>
  )
}
