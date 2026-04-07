'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import StatusBadge from '@/app/components/StatusBadge'
import Header from '@/app/components/Header'

const STATUSES = ['All', 'New', 'Under Review', 'In Progress', 'Submitted', 'Awarded', 'Lost', 'Cancelled']

export default function TendersPage() {
  const [tenders, setTenders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  async function fetchTenders() {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (statusFilter !== 'All') params.set('status', statusFilter)
    const res = await fetch(`/api/tenders?${params}`)
    const data = await res.json()
    setTenders(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchTenders()
  }, [statusFilter])

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') fetchTenders()
  }

  return (
    <div>
      <Header title="Tenders" />
      <div className="p-6">

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                style={statusFilter === s ? { backgroundColor: '#185FA5' } : {}}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search tenders…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm flex-1 sm:w-56 focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
            />
            <Link href="/tenders/new">
              <button
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white whitespace-nowrap"
                style={{ backgroundColor: '#185FA5' }}
              >
                + New Tender
              </button>
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading tenders…</div>
          ) : tenders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">No tenders found.</p>
              <Link href="/tenders/new">
                <button className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#185FA5' }}>
                  Create your first tender
                </button>
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Title</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Entity</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Reference</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Deadline</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-slate-600 font-medium">Docs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenders.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/tenders/${t.id}`} className="font-medium text-slate-800 hover:text-[#185FA5]">
                        {t.title}
                      </Link>
                      {t.createdBy && (
                        <p className="text-xs text-slate-400 mt-0.5">by {t.createdBy.name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.entity}</td>
                    <td className="px-4 py-3 text-slate-500">{t.reference || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.deadline
                        ? new Date(t.deadline).toLocaleDateString('en-ZA')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">{t._count?.documents ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
