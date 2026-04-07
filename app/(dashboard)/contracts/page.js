'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Header from '@/app/components/Header'

function daysUntil(date) {
  const diff = new Date(date) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/contracts')
      .then(r => r.json())
      .then(data => { setContracts(data); setLoading(false) })
  }, [])

  return (
    <div>
      <Header title="Contracts" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <p className="text-slate-500 text-sm">{contracts.length} contract{contracts.length !== 1 ? 's' : ''}</p>
          <Link href="/contracts/new">
            <button className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#185FA5' }}>
              + New Contract
            </button>
          </Link>
        </div>

        {loading ? (
          <div className="text-slate-400 text-center py-12">Loading contracts…</div>
        ) : contracts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 text-center py-12">
            <p className="text-slate-400 mb-4">No contracts yet.</p>
            <Link href="/contracts/new">
              <button className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#185FA5' }}>
                Create first contract
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {contracts.map(c => {
              const days = c.endDate ? daysUntil(c.endDate) : null
              const isExpiring = days !== null && days <= 30 && days > 0
              const isExpired = days !== null && days <= 0

              return (
                <Link key={c.id} href={`/contracts/${c.id}`}>
                  <div className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow cursor-pointer ${
                    isExpired ? 'border-red-200' : isExpiring ? 'border-orange-200' : 'border-slate-200'
                  }`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-slate-800">{c.title}</h3>
                        <p className="text-slate-500 text-sm mt-0.5">{c.client}</p>
                      </div>
                      {isExpired && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Expired</span>
                      )}
                      {isExpiring && !isExpired && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                          Expires in {days}d
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {c.value && (
                        <div>
                          <p className="text-slate-400 text-xs">Value</p>
                          <p className="text-slate-700 font-medium">R {c.value.toLocaleString('en-ZA')}</p>
                        </div>
                      )}
                      {c.startDate && (
                        <div>
                          <p className="text-slate-400 text-xs">Start</p>
                          <p className="text-slate-700">{new Date(c.startDate).toLocaleDateString('en-ZA')}</p>
                        </div>
                      )}
                      {c.endDate && (
                        <div>
                          <p className="text-slate-400 text-xs">End</p>
                          <p className={`font-medium ${isExpired ? 'text-red-600' : isExpiring ? 'text-orange-600' : 'text-slate-700'}`}>
                            {new Date(c.endDate).toLocaleDateString('en-ZA')}
                          </p>
                        </div>
                      )}
                      {c.renewalDate && (
                        <div>
                          <p className="text-slate-400 text-xs">Renewal</p>
                          <p className="text-slate-700">{new Date(c.renewalDate).toLocaleDateString('en-ZA')}</p>
                        </div>
                      )}
                    </div>

                    {c.tender && (
                      <p className="text-xs text-slate-400 mt-3">
                        From tender: {c.tender.title}
                      </p>
                    )}
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
