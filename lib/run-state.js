export const RUN_STATUSES = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  COMPLETED_WITH_WARNINGS: 'completed_with_warnings',
  PARTIAL_TIMEOUT: 'partial_timeout',
  FAILED: 'failed',
  STALE: 'stale',
}

export const VALID_RUN_TRANSITIONS = {
  [RUN_STATUSES.PENDING]: [RUN_STATUSES.RUNNING],
  [RUN_STATUSES.RUNNING]: [
    RUN_STATUSES.COMPLETED,
    RUN_STATUSES.COMPLETED_WITH_WARNINGS,
    RUN_STATUSES.PARTIAL_TIMEOUT,
    RUN_STATUSES.FAILED,
    RUN_STATUSES.STALE,
  ],
  [RUN_STATUSES.STALE]: [RUN_STATUSES.RUNNING],
  [RUN_STATUSES.COMPLETED]: [],
  [RUN_STATUSES.COMPLETED_WITH_WARNINGS]: [],
  [RUN_STATUSES.PARTIAL_TIMEOUT]: [],
  [RUN_STATUSES.FAILED]: [],
}

/**
 * Enforces the crawler lifecycle so stale or failed jobs cannot silently become successful.
 */
export function assertValidTransition(fromStatus, toStatus) {
  const validNextStatuses = VALID_RUN_TRANSITIONS[fromStatus]

  if (!validNextStatuses) {
    throw new Error(`Unknown run status: ${fromStatus}`)
  }

  if (!validNextStatuses.includes(toStatus)) {
    throw new Error(`Invalid run status transition from "${fromStatus}" to "${toStatus}"`)
  }
}

export function isTerminalRunStatus(status) {
  return [
    RUN_STATUSES.COMPLETED,
    RUN_STATUSES.COMPLETED_WITH_WARNINGS,
    RUN_STATUSES.FAILED,
  ].includes(status)
}
