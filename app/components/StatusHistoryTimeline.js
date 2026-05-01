'use client'

import { useState } from 'react'
import { getTenderStatusDescription, getContractAppointmentStatusDescription, getContractInstructionStatusDescription } from '@/lib/status-machine'

/**
 * Premium status history timeline component
 * Displays a chronological audit trail of status changes with smooth animations
 */
export default function StatusHistoryTimeline({
  changes = [],
  isLoading = false,
  type = 'tender', // 'tender' | 'contract'
  empty = 'No status changes yet',
}) {
  const [expandedId, setExpandedId] = useState(null)

  if (isLoading) {
    return <TimelineSkeleton />
  }

  if (!changes || changes.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-[20px] border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100/50 py-12 px-6">
        <div className="text-center">
          <div className="mb-3 flex justify-center">
            <div className="rounded-full bg-slate-200 p-3">
              <svg className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m0 0h6m-6-6H6m0 0H0" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium text-slate-600">{empty}</p>
          <p className="mt-1 text-xs text-slate-500">Status changes will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Timeline header */}
      <div className="flex items-center gap-2 px-1">
        <div className="h-1 w-1 rounded-full bg-slate-400" />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {changes.length} status {changes.length === 1 ? 'change' : 'changes'}
        </p>
      </div>

      {/* Timeline */}
      <div className="relative space-y-0 overflow-hidden rounded-[20px] border border-slate-200 bg-white">
        {/* Vertical line */}
        <div className="absolute left-[39px] top-0 bottom-0 w-px bg-gradient-to-b from-slate-200 via-slate-100 to-transparent" />

        {/* Events */}
        {changes.map((change, index) => (
          <TimelineEvent
            key={change.id || index}
            change={change}
            type={type}
            isLast={index === changes.length - 1}
            isExpanded={expandedId === (change.id || index)}
            onExpand={() => setExpandedId(expandedId === (change.id || index) ? null : (change.id || index))}
            index={index}
          />
        ))}
      </div>
    </div>
  )
}

function TimelineEvent({ change, type, isLast, isExpanded, onExpand, index }) {
  const changeTime = new Date(change.changedAt)
  const now = new Date()
  const timeAgo = getTimeAgoString(changeTime)
  const isRecent = (now - changeTime) < 3600000 // Less than 1 hour

  const statusLabel = type === 'tender'
    ? `${change.fromStatus} → ${change.toStatus}`
    : `${change.fieldName}: ${change.oldValue} → ${change.newValue}`

  const statusDescription = getStatusDescription(type, change)

  return (
    <div
      className={`relative border-b border-slate-100 px-6 py-4 transition-all duration-200 hover:bg-slate-50/50 ${
        isLast ? 'border-b-0' : ''
      } ${isExpanded ? 'bg-slate-50/50' : ''}`}
    >
      {/* Timeline dot */}
      <div className="absolute left-4 top-6">
        <div className={`relative flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-white transition-all duration-300 ${
          isRecent ? 'shadow-md shadow-emerald-200' : 'shadow-sm'
        }`}>
          <div className={`h-5 w-5 rounded-full ${
            isRecent
              ? 'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-300'
              : index === 0 ? 'bg-gradient-to-br from-blue-400 to-blue-500' : 'bg-slate-300'
          }`} />
          {isRecent && (
            <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-20" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="ml-20">
        {/* Header */}
        <button
          onClick={onExpand}
          className="mb-2 flex w-full items-start justify-between transition-colors hover:text-slate-900"
        >
          <div className="flex-1 text-left">
            <p className="font-semibold text-slate-900">{statusLabel}</p>
            <p className="mt-1 text-xs text-slate-500">{statusDescription}</p>
          </div>
          <div className="ml-4 flex items-center gap-2">
            <span className={`whitespace-nowrap text-xs font-medium ${
              isRecent ? 'text-emerald-600' : 'text-slate-500'
            }`}>
              {timeAgo}
            </span>
            <svg
              className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </button>

        {/* Expandable details */}
        {isExpanded && (
          <div className="animate-in fade-in slide-in-from-top-2 space-y-3 border-t border-slate-200 pt-3">
            {/* Changed by */}
            {change.changedBy && (
              <div className="rounded-lg bg-white p-3 text-sm">
                <p className="mb-1 font-medium text-slate-700">Changed by</p>
                <div className="flex items-center gap-2">
                  {change.changedBy.avatarUrl ? (
                    // Avatars can come from arbitrary identity-provider URLs, so keep a plain img here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={change.changedBy.avatarUrl}
                      alt={change.changedBy.name}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                      {change.changedBy.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-slate-900">{change.changedBy.name}</p>
                    <p className="text-xs text-slate-500">{change.changedBy.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Reason */}
            {change.reason && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm">
                <p className="mb-1 font-medium text-blue-900">Reason</p>
                <p className="text-blue-800">{change.reason}</p>
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-slate-500">
              <p>{changeTime.toLocaleString('en-ZA', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <div className="h-1 w-1 rounded-full bg-slate-400" />
        <div className="h-3 w-32 animate-pulse rounded-full bg-slate-200" />
      </div>

      <div className="space-y-2 rounded-[20px] border border-slate-200 bg-white p-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 animate-pulse rounded-lg bg-slate-200" />
                <div className="h-3 w-56 animate-pulse rounded-lg bg-slate-100" />
              </div>
              <div className="h-3 w-16 animate-pulse rounded-lg bg-slate-200" />
            </div>
            {i < 2 && <div className="h-px bg-slate-100" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function getTimeAgoString(date) {
  const now = new Date()
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return date.toLocaleDateString('en-ZA')
}

function getStatusDescription(type, change) {
  if (type === 'tender') {
    return `Status transitioned from "${change.fromStatus}" to "${change.toStatus}"`
  }

  if (type === 'contract') {
    if (change.fieldName === 'appointmentStatus') {
      return getContractAppointmentStatusDescription(change.newValue)
    }
    if (change.fieldName === 'instructionStatus') {
      return getContractInstructionStatusDescription(change.newValue)
    }
  }

  return change.reason || 'Status updated'
}
