const TENDER_STATUS_ALIASES = {
  'Under review': 'Under Review',
  Reviewing: 'Under Review',
  Review: 'Under Review',
  Pursuing: 'In Progress',
  Pursue: 'In Progress',
  InProgress: 'In Progress',
}

const CONTRACT_APPOINTMENT_STATUS_ALIASES = {
  Awarded: 'Appointed',
  Won: 'Appointed',
  Unsuccessful: 'Not Appointed',
}

const CONTRACT_INSTRUCTION_STATUS_ALIASES = {
  Complete: 'Work Complete',
  Completed: 'Work Complete',
}

const APPEAL_STATUS_ALIASES = {
  Open: 'Pending',
  InProgress: 'Pending',
}

function normalizeWithMap(status, map) {
  if (!status || typeof status !== 'string') return status
  return map[status] || status
}

export function normalizeTenderStatus(status) {
  return normalizeWithMap(status, TENDER_STATUS_ALIASES)
}

export function normalizeContractAppointmentStatus(status) {
  return normalizeWithMap(status, CONTRACT_APPOINTMENT_STATUS_ALIASES)
}

export function normalizeContractInstructionStatus(status) {
  return normalizeWithMap(status, CONTRACT_INSTRUCTION_STATUS_ALIASES)
}

export function normalizeAppealStatus(status) {
  return normalizeWithMap(status, APPEAL_STATUS_ALIASES)
}

export function normalizeStatusByType(status, type) {
  if (type === 'tender') return normalizeTenderStatus(status)
  if (type === 'contractAppointment') return normalizeContractAppointmentStatus(status)
  if (type === 'contractInstruction') return normalizeContractInstructionStatus(status)
  if (type === 'appeal') return normalizeAppealStatus(status)
  return status
}

export function normalizeStatusForBadge(status) {
  let normalized = normalizeTenderStatus(status)
  normalized = normalizeContractAppointmentStatus(normalized)
  normalized = normalizeContractInstructionStatus(normalized)
  normalized = normalizeAppealStatus(normalized)
  return normalized
}
