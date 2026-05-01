'use client'

import { useMemo } from 'react'
import {
  getContractAppointmentNextStatuses,
  getContractInstructionNextStatuses,
  canUserTransition,
  getTransitionRequiredRoleName,
} from '@/lib/status-machine'

/**
 * RBAC-aware status selector for contract appointment status
 */
export function ContractAppointmentStatusSelector({
  currentStatus,
  value,
  onChange,
  disabled = false,
  userRole,
  showHelperText = true,
}) {
  const nextStatuses = getContractAppointmentNextStatuses(currentStatus)

  const roleHints = useMemo(() => {
    const hints = {}
    nextStatuses.forEach(status => {
      const canTransition = userRole !== undefined
        ? canUserTransition(currentStatus, status, userRole, 'appointment')
        : false

      if (!canTransition) {
        const requiredRole = getTransitionRequiredRoleName(
          currentStatus,
          status,
          'appointment'
        )
        hints[status] = requiredRole
      }
    })
    return hints
  }, [currentStatus, userRole, nextStatuses])

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">
        Appointment Status
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

/**
 * RBAC-aware status selector for contract instruction status
 */
export function ContractInstructionStatusSelector({
  currentStatus,
  value,
  onChange,
  disabled = false,
  userRole,
  showHelperText = true,
}) {
  const nextStatuses = getContractInstructionNextStatuses(currentStatus)

  const roleHints = useMemo(() => {
    const hints = {}
    nextStatuses.forEach(status => {
      const canTransition = userRole !== undefined
        ? canUserTransition(currentStatus, status, userRole, 'instruction')
        : false

      if (!canTransition) {
        const requiredRole = getTransitionRequiredRoleName(
          currentStatus,
          status,
          'instruction'
        )
        hints[status] = requiredRole
      }
    })
    return hints
  }, [currentStatus, userRole, nextStatuses])

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">
        Instruction Status
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
