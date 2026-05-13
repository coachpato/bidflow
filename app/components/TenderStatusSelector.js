'use client'

import {
  getTenderNextStatuses,
  canUserTransition,
  getTransitionRequiredRoleName,
} from '@/lib/status-machine'

function getRoleHints(currentStatus, userRole, nextStatuses) {
  const hints = {}

  nextStatuses.forEach(status => {
    const canTransition = userRole !== undefined
      ? canUserTransition(currentStatus, status, userRole, 'tender')
      : false

    if (!canTransition) {
      hints[status] = getTransitionRequiredRoleName(currentStatus, status, 'tender')
    }
  })

  return hints
}

/**
 * RBAC-aware status selector for tenders
 * Shows available transitions and disables those user lacks permission for
 * with helpful tooltips explaining required role
 */
export default function TenderStatusSelector({
  currentStatus,
  value,
  onChange,
  disabled = false,
  userRole,
  showHelperText = true,
}) {
  const nextStatuses = getTenderNextStatuses(currentStatus)
  const roleHints = getRoleHints(currentStatus, userRole, nextStatuses)

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">
        Tender Status
      </label>

      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="app-select"
      >
        <option value={currentStatus}>{currentStatus} (current)</option>
        {nextStatuses.map(status => (
          <option
            key={status}
            value={status}
            disabled={roleHints[status] ? true : false}
          >
            {status}
            {roleHints[status] ? ` (requires ${roleHints[status]})` : ''}
          </option>
        ))}
      </select>

      {showHelperText && userRole !== undefined && (
        <p className="text-xs text-slate-500">
          Some transitions may be restricted based on your role permissions.
        </p>
      )}
    </div>
  )
}
