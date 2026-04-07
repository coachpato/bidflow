'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'

export default function AppealsPage() {
  const [appeals, setAppeals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/appeals')
      .then(r => r.json())
      .then(data => { setAppeals(data); setLoading(false) })
  }, [])

  return (
    <div>
      <Header title="Appeals" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <p className="text-slate-500 text-sm">{appeals.length} appeal{appeals.length !== 1 ? 's' : ''}</p>
          <Link href="/appeals/new">
            <button className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#185FA5' }}>
              + New Appeal
            </button>
          </Link>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-12">Loading appeals…</div>
        ) : appeals.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 text-center py-12">
            <p className="text-slate-400 mb-4">No appeals yet.</p>
            <Link href="/appeals/new">
              <button className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#185FA5' }}>
                Create first appeal
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {appeals.map(a => {
              const daysLeft = a.deadline
                ? Math.ceil((new Date(a.deadline) - new Date()) / (1000 * 60 * 60 * 24))
                : null
              return (
                <Link key={a.id} href={`/appeals/${a.id}`}>
                  <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-800 font-medium">{a.reason}</p>
                        {a.tender && (
                          <p className="text-slate-500 text-sm mt-0.5">
                            {a.tender.entity} — {a.tender.title}
                          </p>
                        )}
                        {a.notes && <p className="text-slate-400 text-sm mt-1 truncate">{a.notes}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <StatusBadge status={a.status} />
                        {daysLeft !== null && (
                          <span className={`text-xs font-medium ${daysLeft <= 0 ? 'text-red-600' : daysLeft <= 7 ? 'text-orange-600' : 'text-slate-500'}`}>
                            {daysLeft <= 0 ? 'Deadline passed' : `Deadline in ${daysLeft}d`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
