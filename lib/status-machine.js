import {
  normalizeContractAppointmentStatus,
  normalizeContractInstructionStatus,
  normalizeTenderStatus,
} from '@/lib/status-compat'

/**
 * Status Machine: Defines and enforces valid state transitions
 * Prevents invalid workflow progressions and ensures data integrity
 * Includes Role-Based Access Control (RBAC) for approval workflows
 */

/**
 * RBAC Role Hierarchy
 * STAFF (0) < MANAGER (1) < ADMIN (2)
 */
export const ROLES = {
  STAFF: 0,
  MANAGER: 1,
  ADMIN: 2,
}

export const ROLE_NAMES = {
  [ROLES.STAFF]: 'Staff',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.ADMIN]: 'Admin',
}

/**
 * Tender workflow states and allowed transitions
 * Sequential progression: New → Under Review → In Progress → Submitted
 */
export const TENDER_STATUSES = {
  NEW: 'New',
  UNDER_REVIEW: 'Under Review',
  IN_PROGRESS: 'In Progress',
  SUBMITTED: 'Submitted',
  AWARDED: 'Awarded',
  LOST: 'Lost',
}

export const HIGH_VALUE_TENDER_STATUSES = [
  TENDER_STATUSES.UNDER_REVIEW,
  TENDER_STATUSES.SUBMITTED,
  TENDER_STATUSES.AWARDED,
]

/**
 * Contract appointment status values
 */
export const CONTRACT_APPOINTMENT_STATUSES = {
  PENDING: 'Pending',
  APPOINTED: 'Appointed',
  NOT_APPOINTED: 'Not Appointed',
}

/**
 * Contract instruction status values
 * Sequential: No Instruction → Instruction Received → Work Complete
 */
export const CONTRACT_INSTRUCTION_STATUSES = {
  NO_INSTRUCTION: 'No Instruction',
  INSTRUCTION_RECEIVED: 'Instruction Received',
  WORK_COMPLETE: 'Work Complete',
}

/**
 * Valid tender status transitions
 * Maps current status to array of allowed next statuses
 */
const TENDER_TRANSITIONS = {
  [TENDER_STATUSES.NEW]: [
    TENDER_STATUSES.UNDER_REVIEW,
    TENDER_STATUSES.SUBMITTED, // Allow skip for expedited tenders
  ],
  [TENDER_STATUSES.UNDER_REVIEW]: [
    TENDER_STATUSES.IN_PROGRESS,
    TENDER_STATUSES.SUBMITTED,
  ],
  [TENDER_STATUSES.IN_PROGRESS]: [
    TENDER_STATUSES.SUBMITTED,
  ],
  [TENDER_STATUSES.SUBMITTED]: [
    TENDER_STATUSES.AWARDED,
    TENDER_STATUSES.LOST,
  ],
  [TENDER_STATUSES.AWARDED]: [], // Terminal state
  [TENDER_STATUSES.LOST]: [], // Terminal state
}

/**
 * RBAC Permission Matrix for Tender Transitions
 * Defines minimum role required for each transition
 * Format: 'CurrentStatus > NewStatus': ROLES.MANAGER
 *
 * ADMIN always bypasses checks
 * Any undefined transition is DENIED (fail-secure)
 */
export const TENDER_TRANSITION_PERMISSIONS = {
  // New → Under Review: STAFF can initiate review
  [`${TENDER_STATUSES.NEW} > ${TENDER_STATUSES.UNDER_REVIEW}`]: ROLES.STAFF,

  // New → Submitted: MANAGER must approve expedited path
  [`${TENDER_STATUSES.NEW} > ${TENDER_STATUSES.SUBMITTED}`]: ROLES.MANAGER,

  // Under Review → In Progress: MANAGER approval needed
  [`${TENDER_STATUSES.UNDER_REVIEW} > ${TENDER_STATUSES.IN_PROGRESS}`]: ROLES.MANAGER,

  // Under Review → Submitted: MANAGER can skip directly to submission
  [`${TENDER_STATUSES.UNDER_REVIEW} > ${TENDER_STATUSES.SUBMITTED}`]: ROLES.MANAGER,

  // In Progress → Submitted: MANAGER final approval
  [`${TENDER_STATUSES.IN_PROGRESS} > ${TENDER_STATUSES.SUBMITTED}`]: ROLES.MANAGER,
  [`${TENDER_STATUSES.SUBMITTED} > ${TENDER_STATUSES.AWARDED}`]: ROLES.MANAGER,
  [`${TENDER_STATUSES.SUBMITTED} > ${TENDER_STATUSES.LOST}`]: ROLES.MANAGER,
}

export const TENDER_TRANSITION_ACTION_LABELS = {
  [`${TENDER_STATUSES.NEW} > ${TENDER_STATUSES.UNDER_REVIEW}`]: 'Start Review',
  [`${TENDER_STATUSES.NEW} > ${TENDER_STATUSES.SUBMITTED}`]: 'Submit Bid',
  [`${TENDER_STATUSES.UNDER_REVIEW} > ${TENDER_STATUSES.IN_PROGRESS}`]: 'Start Work',
  [`${TENDER_STATUSES.UNDER_REVIEW} > ${TENDER_STATUSES.SUBMITTED}`]: 'Submit Bid',
  [`${TENDER_STATUSES.IN_PROGRESS} > ${TENDER_STATUSES.SUBMITTED}`]: 'Submit Bid',
  [`${TENDER_STATUSES.SUBMITTED} > ${TENDER_STATUSES.AWARDED}`]: 'Record Award',
  [`${TENDER_STATUSES.SUBMITTED} > ${TENDER_STATUSES.LOST}`]: 'Record Loss',
}

/**
 * Valid contract appointment status transitions
 * Can move between states based on business events
 */
const CONTRACT_APPOINTMENT_TRANSITIONS = {
  [CONTRACT_APPOINTMENT_STATUSES.PENDING]: [
    CONTRACT_APPOINTMENT_STATUSES.APPOINTED,
    CONTRACT_APPOINTMENT_STATUSES.NOT_APPOINTED,
  ],
  [CONTRACT_APPOINTMENT_STATUSES.APPOINTED]: [
    CONTRACT_APPOINTMENT_STATUSES.NOT_APPOINTED,
    CONTRACT_APPOINTMENT_STATUSES.PENDING,
  ],
  [CONTRACT_APPOINTMENT_STATUSES.NOT_APPOINTED]: [
    CONTRACT_APPOINTMENT_STATUSES.APPOINTED,
    CONTRACT_APPOINTMENT_STATUSES.PENDING,
  ],
}

/**
 * RBAC Permission Matrix for Contract Appointment Status
 */
export const CONTRACT_APPOINTMENT_TRANSITION_PERMISSIONS = {
  // Pending → Appointed: MANAGER confirms appointment
  [`${CONTRACT_APPOINTMENT_STATUSES.PENDING} > ${CONTRACT_APPOINTMENT_STATUSES.APPOINTED}`]: ROLES.MANAGER,

  // Pending → Not Appointed: MANAGER marks unsuccessful
  [`${CONTRACT_APPOINTMENT_STATUSES.PENDING} > ${CONTRACT_APPOINTMENT_STATUSES.NOT_APPOINTED}`]: ROLES.MANAGER,

  // Appointed → Not Appointed: MANAGER reverses appointment
  [`${CONTRACT_APPOINTMENT_STATUSES.APPOINTED} > ${CONTRACT_APPOINTMENT_STATUSES.NOT_APPOINTED}`]: ROLES.MANAGER,

  // Appointed → Pending: STAFF can revert to pending for re-negotiation
  [`${CONTRACT_APPOINTMENT_STATUSES.APPOINTED} > ${CONTRACT_APPOINTMENT_STATUSES.PENDING}`]: ROLES.STAFF,

  // Not Appointed → Appointed: MANAGER can retry
  [`${CONTRACT_APPOINTMENT_STATUSES.NOT_APPOINTED} > ${CONTRACT_APPOINTMENT_STATUSES.APPOINTED}`]: ROLES.MANAGER,

  // Not Appointed → Pending: STAFF can retry
  [`${CONTRACT_APPOINTMENT_STATUSES.NOT_APPOINTED} > ${CONTRACT_APPOINTMENT_STATUSES.PENDING}`]: ROLES.STAFF,
}

export const CONTRACT_APPOINTMENT_TRANSITION_ACTION_LABELS = {
  [`${CONTRACT_APPOINTMENT_STATUSES.PENDING} > ${CONTRACT_APPOINTMENT_STATUSES.APPOINTED}`]: 'Record Appointment',
  [`${CONTRACT_APPOINTMENT_STATUSES.PENDING} > ${CONTRACT_APPOINTMENT_STATUSES.NOT_APPOINTED}`]: 'Record Not Appointed',
  [`${CONTRACT_APPOINTMENT_STATUSES.APPOINTED} > ${CONTRACT_APPOINTMENT_STATUSES.NOT_APPOINTED}`]: 'Record Not Appointed',
  [`${CONTRACT_APPOINTMENT_STATUSES.APPOINTED} > ${CONTRACT_APPOINTMENT_STATUSES.PENDING}`]: 'Reopen as Pending',
  [`${CONTRACT_APPOINTMENT_STATUSES.NOT_APPOINTED} > ${CONTRACT_APPOINTMENT_STATUSES.APPOINTED}`]: 'Record Appointment',
  [`${CONTRACT_APPOINTMENT_STATUSES.NOT_APPOINTED} > ${CONTRACT_APPOINTMENT_STATUSES.PENDING}`]: 'Reopen as Pending',
}

/**
 * Valid contract instruction status transitions
 * Sequential progression with some flexibility
 */
const CONTRACT_INSTRUCTION_TRANSITIONS = {
  [CONTRACT_INSTRUCTION_STATUSES.NO_INSTRUCTION]: [
    CONTRACT_INSTRUCTION_STATUSES.INSTRUCTION_RECEIVED,
  ],
  [CONTRACT_INSTRUCTION_STATUSES.INSTRUCTION_RECEIVED]: [
    CONTRACT_INSTRUCTION_STATUSES.WORK_COMPLETE,
    CONTRACT_INSTRUCTION_STATUSES.NO_INSTRUCTION, // Allow revert
  ],
  [CONTRACT_INSTRUCTION_STATUSES.WORK_COMPLETE]: [], // Terminal state
}

/**
 * RBAC Permission Matrix for Contract Instruction Status
 */
export const CONTRACT_INSTRUCTION_TRANSITION_PERMISSIONS = {
  // No Instruction → Instruction Received: STAFF can receive instructions
  [`${CONTRACT_INSTRUCTION_STATUSES.NO_INSTRUCTION} > ${CONTRACT_INSTRUCTION_STATUSES.INSTRUCTION_RECEIVED}`]: ROLES.STAFF,

  // Instruction Received → Work Complete: MANAGER marks completion
  [`${CONTRACT_INSTRUCTION_STATUSES.INSTRUCTION_RECEIVED} > ${CONTRACT_INSTRUCTION_STATUSES.WORK_COMPLETE}`]: ROLES.MANAGER,

  // Instruction Received → No Instruction: MANAGER reverts if needed
  [`${CONTRACT_INSTRUCTION_STATUSES.INSTRUCTION_RECEIVED} > ${CONTRACT_INSTRUCTION_STATUSES.NO_INSTRUCTION}`]: ROLES.MANAGER,
}

export const CONTRACT_INSTRUCTION_TRANSITION_ACTION_LABELS = {
  [`${CONTRACT_INSTRUCTION_STATUSES.NO_INSTRUCTION} > ${CONTRACT_INSTRUCTION_STATUSES.INSTRUCTION_RECEIVED}`]: 'Record Instruction Received',
  [`${CONTRACT_INSTRUCTION_STATUSES.INSTRUCTION_RECEIVED} > ${CONTRACT_INSTRUCTION_STATUSES.WORK_COMPLETE}`]: 'Mark Work Complete',
  [`${CONTRACT_INSTRUCTION_STATUSES.INSTRUCTION_RECEIVED} > ${CONTRACT_INSTRUCTION_STATUSES.NO_INSTRUCTION}`]: 'Revert to No Instruction',
}

/**
 * Validates a tender status transition with RBAC check
 * @param {string} currentStatus - Current tender status
 * @param {string} newStatus - Desired tender status
 * @param {number} userRole - User's role (ROLES.STAFF, ROLES.MANAGER, ROLES.ADMIN)
 * @returns {object} { isValid: boolean, error?: string, code?: string, requiredRole?: number }
 */
export function validateTenderTransition(currentStatus, newStatus, userRole = ROLES.STAFF) {
  currentStatus = normalizeTenderStatus(currentStatus)
  newStatus = normalizeTenderStatus(newStatus)

  if (currentStatus === newStatus) {
    return { isValid: false, error: 'Status is already set to this value', code: 'SAME_STATUS' }
  }

  const validNextStatuses = TENDER_TRANSITIONS[currentStatus]

  if (!validNextStatuses) {
    return { isValid: false, error: `Unknown current status: ${currentStatus}`, code: 'UNKNOWN_STATUS' }
  }

  if (!validNextStatuses.includes(newStatus)) {
    return {
      isValid: false,
      error: `Cannot transition from "${currentStatus}" to "${newStatus}". Valid transitions: ${validNextStatuses.join(', ')}`,
      code: 'INVALID_TRANSITION',
    }
  }

  // ========================================================================
  // RBAC Check: Verify user has sufficient role for this transition
  // ========================================================================
  const transitionKey = `${currentStatus} > ${newStatus}`
  const requiredRole = TENDER_TRANSITION_PERMISSIONS[transitionKey]

  // If no permission defined, deny (fail-secure)
  if (requiredRole === undefined) {
    return {
      isValid: false,
      error: `Transition from "${currentStatus}" to "${newStatus}" is not permitted`,
      code: 'PERMISSION_NOT_DEFINED',
    }
  }

  // ADMIN always has permission
  if (userRole === ROLES.ADMIN) {
    return { isValid: true }
  }

  // Check if user's role meets minimum requirement
  if (userRole < requiredRole) {
    return {
      isValid: false,
      error: `This transition requires ${ROLE_NAMES[requiredRole]} role. You are ${ROLE_NAMES[userRole]}.`,
      code: 'INSUFFICIENT_ROLE',
      requiredRole,
      userRole,
    }
  }

  return { isValid: true }
}

/**
 * Validates a contract appointment status transition with RBAC check
 * @param {string} currentStatus - Current appointment status
 * @param {string} newStatus - Desired appointment status
 * @param {number} userRole - User's role (ROLES.STAFF, ROLES.MANAGER, ROLES.ADMIN)
 * @returns {object} { isValid: boolean, error?: string, code?: string, requiredRole?: number }
 */
export function validateContractAppointmentTransition(currentStatus, newStatus, userRole = ROLES.STAFF) {
  currentStatus = normalizeContractAppointmentStatus(currentStatus)
  newStatus = normalizeContractAppointmentStatus(newStatus)

  if (currentStatus === newStatus) {
    return { isValid: false, error: 'Appointment status is already set to this value', code: 'SAME_STATUS' }
  }

  const validNextStatuses = CONTRACT_APPOINTMENT_TRANSITIONS[currentStatus]

  if (!validNextStatuses) {
    return { isValid: false, error: `Unknown appointment status: ${currentStatus}`, code: 'UNKNOWN_STATUS' }
  }

  if (!validNextStatuses.includes(newStatus)) {
    return {
      isValid: false,
      error: `Cannot transition from "${currentStatus}" to "${newStatus}". Valid transitions: ${validNextStatuses.join(', ')}`,
      code: 'INVALID_TRANSITION',
    }
  }

  // ========================================================================
  // RBAC Check: Verify user has sufficient role for this transition
  // ========================================================================
  const transitionKey = `${currentStatus} > ${newStatus}`
  const requiredRole = CONTRACT_APPOINTMENT_TRANSITION_PERMISSIONS[transitionKey]

  if (requiredRole === undefined) {
    return {
      isValid: false,
      error: `Transition from "${currentStatus}" to "${newStatus}" is not permitted`,
      code: 'PERMISSION_NOT_DEFINED',
    }
  }

  if (userRole === ROLES.ADMIN) {
    return { isValid: true }
  }

  if (userRole < requiredRole) {
    return {
      isValid: false,
      error: `This transition requires ${ROLE_NAMES[requiredRole]} role. You are ${ROLE_NAMES[userRole]}.`,
      code: 'INSUFFICIENT_ROLE',
      requiredRole,
      userRole,
    }
  }

  return { isValid: true }
}

/**
 * Validates a contract instruction status transition with RBAC check
 * @param {string} currentStatus - Current instruction status
 * @param {string} newStatus - Desired instruction status
 * @param {number} userRole - User's role (ROLES.STAFF, ROLES.MANAGER, ROLES.ADMIN)
 * @returns {object} { isValid: boolean, error?: string, code?: string, requiredRole?: number }
 */
export function validateContractInstructionTransition(currentStatus, newStatus, userRole = ROLES.STAFF) {
  currentStatus = normalizeContractInstructionStatus(currentStatus)
  newStatus = normalizeContractInstructionStatus(newStatus)

  if (currentStatus === newStatus) {
    return { isValid: false, error: 'Instruction status is already set to this value', code: 'SAME_STATUS' }
  }

  const validNextStatuses = CONTRACT_INSTRUCTION_TRANSITIONS[currentStatus]

  if (!validNextStatuses) {
    return { isValid: false, error: `Unknown instruction status: ${currentStatus}`, code: 'UNKNOWN_STATUS' }
  }

  if (!validNextStatuses.includes(newStatus)) {
    return {
      isValid: false,
      error: `Cannot transition from "${currentStatus}" to "${newStatus}". Valid transitions: ${validNextStatuses.join(', ')}`,
      code: 'INVALID_TRANSITION',
    }
  }

  // ========================================================================
  // RBAC Check: Verify user has sufficient role for this transition
  // ========================================================================
  const transitionKey = `${currentStatus} > ${newStatus}`
  const requiredRole = CONTRACT_INSTRUCTION_TRANSITION_PERMISSIONS[transitionKey]

  if (requiredRole === undefined) {
    return {
      isValid: false,
      error: `Transition from "${currentStatus}" to "${newStatus}" is not permitted`,
      code: 'PERMISSION_NOT_DEFINED',
    }
  }

  if (userRole === ROLES.ADMIN) {
    return { isValid: true }
  }

  if (userRole < requiredRole) {
    return {
      isValid: false,
      error: `This transition requires ${ROLE_NAMES[requiredRole]} role. You are ${ROLE_NAMES[userRole]}.`,
      code: 'INSUFFICIENT_ROLE',
      requiredRole,
      userRole,
    }
  }

  return { isValid: true }
}

/**
 * Gets allowed next statuses for a tender
 * @param {string} currentStatus - Current tender status
 * @returns {array} Array of allowed status strings
 */
export function getTenderNextStatuses(currentStatus) {
  currentStatus = normalizeTenderStatus(currentStatus)
  return TENDER_TRANSITIONS[currentStatus] || []
}

/**
 * Gets allowed next statuses for contract appointment
 * @param {string} currentStatus - Current appointment status
 * @returns {array} Array of allowed status strings
 */
export function getContractAppointmentNextStatuses(currentStatus) {
  currentStatus = normalizeContractAppointmentStatus(currentStatus)
  return CONTRACT_APPOINTMENT_TRANSITIONS[currentStatus] || []
}

/**
 * Gets allowed next statuses for contract instruction
 * @param {string} currentStatus - Current instruction status
 * @returns {array} Array of allowed status strings
 */
export function getContractInstructionNextStatuses(currentStatus) {
  currentStatus = normalizeContractInstructionStatus(currentStatus)
  return CONTRACT_INSTRUCTION_TRANSITIONS[currentStatus] || []
}

/**
 * Gets human-readable description of a tender status
 * @param {string} status - Tender status
 * @returns {string} Description
 */
export function getTenderStatusDescription(status) {
  status = normalizeTenderStatus(status)
  const descriptions = {
    [TENDER_STATUSES.NEW]: 'Just created, awaiting internal review',
    [TENDER_STATUSES.UNDER_REVIEW]: 'Being evaluated for viability',
    [TENDER_STATUSES.IN_PROGRESS]: 'Actively preparing submission',
    [TENDER_STATUSES.SUBMITTED]: 'Submitted, awaiting decision',
    [TENDER_STATUSES.AWARDED]: 'Awarded and ready to move into contract delivery',
    [TENDER_STATUSES.LOST]: 'Unsuccessful outcome recorded and ready for appeal intake',
  }
  return descriptions[status] || 'Unknown status'
}

export function isHighValueTenderStatus(status) {
  status = normalizeTenderStatus(status)
  return HIGH_VALUE_TENDER_STATUSES.includes(status)
}

/**
 * Gets human-readable description of contract appointment status
 * @param {string} status - Appointment status
 * @returns {string} Description
 */
export function getContractAppointmentStatusDescription(status) {
  status = normalizeContractAppointmentStatus(status)
  const descriptions = {
    [CONTRACT_APPOINTMENT_STATUSES.PENDING]: 'Awaiting client response',
    [CONTRACT_APPOINTMENT_STATUSES.APPOINTED]: 'Successfully appointed',
    [CONTRACT_APPOINTMENT_STATUSES.NOT_APPOINTED]: 'Unsuccessful bid',
  }
  return descriptions[status] || 'Unknown status'
}

/**
 * Gets human-readable description of contract instruction status
 * @param {string} status - Instruction status
 * @returns {string} Description
 */
export function getContractInstructionStatusDescription(status) {
  status = normalizeContractInstructionStatus(status)
  const descriptions = {
    [CONTRACT_INSTRUCTION_STATUSES.NO_INSTRUCTION]: 'No work instruction received yet',
    [CONTRACT_INSTRUCTION_STATUSES.INSTRUCTION_RECEIVED]: 'Actively performing work',
    [CONTRACT_INSTRUCTION_STATUSES.WORK_COMPLETE]: 'All work completed',
  }
  return descriptions[status] || 'Unknown status'
}

/**
 * Calculates the progress percentage for a tender (0-100)
 * @param {string} status - Tender status
 * @returns {number} Progress percentage
 */
export function getTenderProgressPercentage(status) {
  status = normalizeTenderStatus(status)
  const progressMap = {
    [TENDER_STATUSES.NEW]: 25,
    [TENDER_STATUSES.UNDER_REVIEW]: 50,
    [TENDER_STATUSES.IN_PROGRESS]: 75,
    [TENDER_STATUSES.SUBMITTED]: 90,
    [TENDER_STATUSES.AWARDED]: 100,
    [TENDER_STATUSES.LOST]: 100,
  }
  return progressMap[status] || 0
}

/**
 * Determines if a tender can be converted to contract
 * @param {string} status - Tender status
 * @returns {boolean} True if conversion is allowed
 */
export function canConvertTenderToContract(status) {
  status = normalizeTenderStatus(status)
  return status === TENDER_STATUSES.AWARDED
}

/**
 * Determines if a contract is in a terminal (completed) state
 * @param {string} appointmentStatus - Contract appointment status
 * @param {string} instructionStatus - Contract instruction status
 * @returns {boolean} True if contract work is complete
 */
export function isContractComplete(appointmentStatus, instructionStatus) {
  return instructionStatus === CONTRACT_INSTRUCTION_STATUSES.WORK_COMPLETE
}

/**
 * Determines if a contract is active (has potential for more work)
 * @param {string} appointmentStatus - Contract appointment status
 * @param {string} instructionStatus - Contract instruction status
 * @returns {boolean} True if contract is active
 */
export function isContractActive(appointmentStatus, instructionStatus) {
  const isAppointed = appointmentStatus === CONTRACT_APPOINTMENT_STATUSES.APPOINTED
  const hasWork = instructionStatus !== CONTRACT_INSTRUCTION_STATUSES.WORK_COMPLETE
  return isAppointed && hasWork
}

/**
 * RBAC Helper: Get required role for a tender transition
 * @param {string} currentStatus - Current tender status
 * @param {string} newStatus - Desired tender status
 * @returns {number|undefined} Required role value or undefined if transition not defined
 */
export function getTenderTransitionRequiredRole(currentStatus, newStatus) {
  const transitionKey = `${currentStatus} > ${newStatus}`
  return TENDER_TRANSITION_PERMISSIONS[transitionKey]
}

export function getTenderTransitionActionLabel(currentStatus, newStatus) {
  const transitionKey = `${currentStatus} > ${newStatus}`
  return TENDER_TRANSITION_ACTION_LABELS[transitionKey] || newStatus
}

export function getTenderAvailableActions(currentStatus) {
  return getTenderNextStatuses(currentStatus).map(nextStatus => ({
    nextStatus,
    label: getTenderTransitionActionLabel(currentStatus, nextStatus),
    requiredRole: getTenderTransitionRequiredRole(currentStatus, nextStatus),
  }))
}

/**
 * RBAC Helper: Get required role for a contract appointment transition
 * @param {string} currentStatus - Current appointment status
 * @param {string} newStatus - Desired appointment status
 * @returns {number|undefined} Required role value or undefined if transition not defined
 */
export function getContractAppointmentTransitionRequiredRole(currentStatus, newStatus) {
  const transitionKey = `${currentStatus} > ${newStatus}`
  return CONTRACT_APPOINTMENT_TRANSITION_PERMISSIONS[transitionKey]
}

export function getContractAppointmentTransitionActionLabel(currentStatus, newStatus) {
  const transitionKey = `${currentStatus} > ${newStatus}`
  return CONTRACT_APPOINTMENT_TRANSITION_ACTION_LABELS[transitionKey] || newStatus
}

export function getContractAppointmentAvailableActions(currentStatus) {
  return getContractAppointmentNextStatuses(currentStatus).map(nextStatus => ({
    nextStatus,
    label: getContractAppointmentTransitionActionLabel(currentStatus, nextStatus),
    requiredRole: getContractAppointmentTransitionRequiredRole(currentStatus, nextStatus),
  }))
}

/**
 * RBAC Helper: Get required role for a contract instruction transition
 * @param {string} currentStatus - Current instruction status
 * @param {string} newStatus - Desired instruction status
 * @returns {number|undefined} Required role value or undefined if transition not defined
 */
export function getContractInstructionTransitionRequiredRole(currentStatus, newStatus) {
  const transitionKey = `${currentStatus} > ${newStatus}`
  return CONTRACT_INSTRUCTION_TRANSITION_PERMISSIONS[transitionKey]
}

export function getContractInstructionTransitionActionLabel(currentStatus, newStatus) {
  const transitionKey = `${currentStatus} > ${newStatus}`
  return CONTRACT_INSTRUCTION_TRANSITION_ACTION_LABELS[transitionKey] || newStatus
}

export function getContractInstructionAvailableActions(currentStatus) {
  return getContractInstructionNextStatuses(currentStatus).map(nextStatus => ({
    nextStatus,
    label: getContractInstructionTransitionActionLabel(currentStatus, nextStatus),
    requiredRole: getContractInstructionTransitionRequiredRole(currentStatus, nextStatus),
  }))
}

/**
 * RBAC Helper: Check if user can perform a specific transition
 * @param {string} currentStatus - Current status
 * @param {string} newStatus - Desired status
 * @param {number} userRole - User's role
 * @param {string} resourceType - 'tender', 'appointment', or 'instruction'
 * @returns {boolean} True if user can perform transition
 */
export function canUserTransition(currentStatus, newStatus, userRole, resourceType = 'tender') {
  // ADMIN can always transition
  if (userRole === ROLES.ADMIN) {
    return true
  }

  let requiredRole
  if (resourceType === 'tender') {
    requiredRole = getTenderTransitionRequiredRole(currentStatus, newStatus)
  } else if (resourceType === 'appointment') {
    requiredRole = getContractAppointmentTransitionRequiredRole(currentStatus, newStatus)
  } else if (resourceType === 'instruction') {
    requiredRole = getContractInstructionTransitionRequiredRole(currentStatus, newStatus)
  }

  // Deny if transition not defined
  if (requiredRole === undefined) {
    return false
  }

  // Check if user's role meets requirement
  return userRole >= requiredRole
}

/**
 * RBAC Helper: Get human-readable required role name for a transition
 * @param {string} currentStatus - Current status
 * @param {string} newStatus - Desired status
 * @param {string} resourceType - 'tender', 'appointment', or 'instruction'
 * @returns {string|null} Role name like 'Manager', 'Staff', or null if undefined
 */
export function getTransitionRequiredRoleName(currentStatus, newStatus, resourceType = 'tender') {
  let requiredRole
  if (resourceType === 'tender') {
    requiredRole = getTenderTransitionRequiredRole(currentStatus, newStatus)
  } else if (resourceType === 'appointment') {
    requiredRole = getContractAppointmentTransitionRequiredRole(currentStatus, newStatus)
  } else if (resourceType === 'instruction') {
    requiredRole = getContractInstructionTransitionRequiredRole(currentStatus, newStatus)
  }

  return requiredRole !== undefined ? ROLE_NAMES[requiredRole] : null
}
