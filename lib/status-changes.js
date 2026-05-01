import prisma from '@/lib/prisma'

/**
 * Records a tender status change in the audit trail
 */
export async function recordTenderStatusChange({
  tenderId,
  fromStatus,
  toStatus,
  changedByUserId,
  reason = null,
  metadata = null,
}) {
  if (fromStatus === toStatus) {
    return null // No change to record
  }

  return prisma.tenderStatusChange.create({
    data: {
      tenderId,
      fromStatus,
      toStatus,
      changedByUserId,
      reason,
      metadata,
    },
  })
}

/**
 * Records a contract status change in the audit trail
 * Supports both appointmentStatus and instructionStatus changes
 */
export async function recordContractStatusChange({
  contractId,
  fieldName, // 'appointmentStatus' or 'instructionStatus'
  oldValue,
  newValue,
  changedByUserId,
  reason = null,
  metadata = null,
}) {
  if (oldValue === newValue) {
    return null // No change to record
  }

  return prisma.contractStatusChange.create({
    data: {
      contractId,
      fieldName,
      oldValue,
      newValue,
      changedByUserId,
      reason,
      metadata,
    },
  })
}

/**
 * Get the status change history for a tender
 */
export async function getTenderStatusHistory(tenderId, limit = 50) {
  return prisma.tenderStatusChange.findMany({
    where: { tenderId },
    include: {
      changedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { changedAt: 'desc' },
    take: limit,
  })
}

/**
 * Get the status change history for a contract
 */
export async function getContractStatusHistory(contractId, limit = 50) {
  return prisma.contractStatusChange.findMany({
    where: { contractId },
    include: {
      changedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { changedAt: 'desc' },
    take: limit,
  })
}

/**
 * Get the latest status for a tender (most recent status change)
 */
export async function getLatestTenderStatusChange(tenderId) {
  return prisma.tenderStatusChange.findFirst({
    where: { tenderId },
    include: {
      changedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { changedAt: 'desc' },
  })
}

/**
 * Get the latest status changes for a contract (separate for each status field)
 */
export async function getLatestContractStatusChanges(contractId) {
  const changes = await prisma.contractStatusChange.findMany({
    where: { contractId },
    include: {
      changedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { changedAt: 'desc' },
  })

  // Group by fieldName and return the latest for each
  const latest = {}
  for (const change of changes) {
    if (!latest[change.fieldName]) {
      latest[change.fieldName] = change
    }
  }

  return latest
}
