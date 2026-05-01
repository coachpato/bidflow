'use client'

import { useEffect, useState } from 'react'
import StatusHistoryTimeline from './StatusHistoryTimeline'

/**
 * Embeddable status history card for contract detail pages
 * Fetches and displays the status change audit trail for both appointment and instruction statuses
 */
export default function ContractStatusHistoryCard({ contractId }) {
  const [allChanges, setAllChanges] = useState([])
  const [appointmentChanges, setAppointmentChanges] = useState([])
  const [instructionChanges, setInstructionChanges] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'appointment' | 'instruction'

  useEffect(() => {
    if (!contractId) return

    async function fetchHistory() {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/contracts/${contractId}/status-history?limit=50`)

        if (!response.ok) {
          throw new Error(`Failed to load status history: ${response.statusText}`)
        }

        const data = await response.json()
        const changes = data.data || []

        setAllChanges(changes)
        setAppointmentChanges(changes.filter(c => c.fieldName === 'appointmentStatus'))
        setInstructionChanges(changes.filter(c => c.fieldName === 'instructionStatus'))
        setError(null)
      } catch (err) {
        console.error('Error fetching contract status history:', err)
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchHistory()
  }, [contractId])

  const displayChanges = activeTab === 'appointment'
    ? appointmentChanges
    : activeTab === 'instruction'
    ? instructionChanges
    : allChanges

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Status History</h3>
          <p className="mt-1 text-xs text-slate-500">Complete audit trail of all appointment and instruction status changes</p>
        </div>
      </div>

      {/* Tab buttons */}
      <div className="flex gap-2">
        {[
          { id: 'all', label: 'All Changes', count: allChanges.length },
          { id: 'appointment', label: 'Appointment', count: appointmentChanges.length },
          { id: 'instruction', label: 'Instruction', count: instructionChanges.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-blue-100 text-blue-700 shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tab.label}
            <span className="ml-1 rounded bg-white px-2 py-0.5 text-xs font-semibold">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Timeline */}
      {!error && (
        <StatusHistoryTimeline
          changes={displayChanges}
          isLoading={isLoading}
          type="contract"
          empty={`No ${activeTab === 'appointment' ? 'appointment' : activeTab === 'instruction' ? 'instruction' : ''} status changes yet.`}
        />
      )}
    </div>
  )
}
