'use client'

import { useEffect, useState } from 'react'
import StatusHistoryTimeline from './StatusHistoryTimeline'

/**
 * Embeddable status history card for pursuit detail pages
 * Fetches and displays the status change audit trail
 */
export default function TenderStatusHistoryCard({ tenderId }) {
  const [changes, setChanges] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!tenderId) return

    async function fetchHistory() {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/pursuits/${tenderId}/status-history?limit=50`)

        if (!response.ok) {
          throw new Error(`Failed to load status history: ${response.statusText}`)
        }

        const data = await response.json()
        setChanges(data.data || [])
        setError(null)
      } catch (err) {
        console.error('Error fetching pursuit status history:', err)
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchHistory()
  }, [tenderId])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Status History</h3>
          <p className="mt-1 text-xs text-slate-500">Complete audit trail of all status changes</p>
        </div>
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
          changes={changes}
          isLoading={isLoading}
          type="tender"
          empty="No status changes yet. When you update the status, it will appear here."
        />
      )}
    </div>
  )
}
