'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/app/components/Header'

export default function ContractDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [contract, setContract] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const fetchContract = useCallback(async () => {
    const res = await fetch(`/api/contracts/${id}`)
    if (!res.ok) { router.push('/contracts'); return }
    const data = await res.json()
    setContract(data)
    setForm({
      title: data.title || '',
      client: data.client || '',
      value: data.value || '',
      startDate: data.startDate ? data.startDate.substring(0, 10) : '',
      endDate: data.endDate ? data.endDate.substring(0, 10) : '',
      renewalDate: data.renewalDate ? data.renewalDate.substring(0, 10) : '',
      cancelDate: data.cancelDate ? data.cancelDate.substring(0, 10) : '',
      notes: data.notes || '',
    })
  }, [id, router])

  useEffect(() => { fetchContract() }, [fetchContract])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/contracts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setEditing(false)
    fetchContract()
  }

  async function handleDelete() {
    if (!confirm('Delete this contract? This cannot be undone.')) return
    await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
    router.push('/contracts')
  }

  if (!contract) return <div className="p-6 text-slate-400">Loading…</div>

  const daysUntilEnd = contract.endDate
    ? Math.ceil((new Date(contract.endDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div>
      <Header title={contract.title} />
      <div className="p-6 max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/contracts" className="text-slate-400 hover:text-slate-600 text-sm">← Contracts</Link>
          <div className="flex gap-2">
            <button onClick={() => setEditing(!editing)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50">
              {editing ? 'Cancel Edit' : 'Edit'}
            </button>
            <button onClick={handleDelete}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 border border-red-200 text-red-600 hover:bg-red-100">
              Delete
            </button>
          </div>
        </div>

        {/* Expiry alert */}
        {daysUntilEnd !== null && daysUntilEnd <= 30 && (
          <div className={`p-4 rounded-xl border ${daysUntilEnd <= 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
            <p className={`text-sm font-medium ${daysUntilEnd <= 0 ? 'text-red-700' : 'text-orange-700'}`}>
              {daysUntilEnd <= 0
                ? 'This contract has expired.'
                : `This contract expires in ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''}.`}
            </p>
          </div>
        )}

        {editing ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                  <input value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
                  <input value={form.client} onChange={e => setForm({...form, client: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Value (ZAR)</label>
                  <input type="number" value={form.value} onChange={e => setForm({...form, value: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Renewal Date</label>
                  <input type="date" value={form.renewalDate} onChange={e => setForm({...form, renewalDate: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cancellation Date</label>
                  <input type="date" value={form.cancelDate} onChange={e => setForm({...form, cancelDate: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea rows={3} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]" />
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: '#185FA5' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">{contract.title}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="Client" value={contract.client} />
              <Field label="Value" value={contract.value ? `R ${contract.value.toLocaleString('en-ZA')}` : null} />
              <Field label="Start Date" value={contract.startDate ? new Date(contract.startDate).toLocaleDateString('en-ZA') : null} />
              <Field label="End Date" value={contract.endDate ? new Date(contract.endDate).toLocaleDateString('en-ZA') : null} />
              <Field label="Renewal Date" value={contract.renewalDate ? new Date(contract.renewalDate).toLocaleDateString('en-ZA') : null} />
              <Field label="Cancellation Date" value={contract.cancelDate ? new Date(contract.cancelDate).toLocaleDateString('en-ZA') : null} />
              {contract.tender && (
                <div className="col-span-2">
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-0.5">Linked Tender</p>
                  <Link href={`/tenders/${contract.tender.id}`} className="text-[#185FA5] hover:underline text-sm">
                    {contract.tender.title}
                  </Link>
                </div>
              )}
              {contract.notes && (
                <div className="col-span-2">
                  <p className="text-slate-400 text-xs uppercase tracking-wider mb-0.5">Notes</p>
                  <p className="text-slate-700">{contract.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-slate-400 text-xs uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-slate-800">{value}</p>
    </div>
  )
}
