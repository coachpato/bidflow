import prisma from './prisma'
import { CrawlError, CRAWL_ERROR_TYPES } from './errors'
import { logger as defaultLogger } from './logger'
import { assertValidTransition, RUN_STATUSES } from './run-state'

const DEFAULT_LEASE_DURATION_MS = 270_000
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000

function addMilliseconds(date, ms) {
  return new Date(date.getTime() + ms)
}

function legacyStatusForRunStatus(runStatus) {
  if (runStatus === RUN_STATUSES.PARTIAL_TIMEOUT) return 'partial'
  if (runStatus === RUN_STATUSES.STALE) return 'stale'
  if (runStatus === RUN_STATUSES.COMPLETED_WITH_WARNINGS) return 'completed'
  return runStatus
}

async function runTransaction(db, callback) {
  if (typeof db.$transaction === 'function') {
    return db.$transaction(callback)
  }

  return callback(db)
}

/**
 * Marks expired running leases stale before a new crawl decides whether it can start.
 */
export async function markExpiredRunsStale({
  db = prisma,
  sourceId,
  now = new Date(),
  logger = defaultLogger,
} = {}) {
  const result = await db.sourceRun.updateMany({
    where: {
      sourceId,
      runStatus: RUN_STATUSES.RUNNING,
      OR: [
        { leaseExpiresAt: null },
        { leaseExpiresAt: { lt: now } },
      ],
    },
    data: {
      status: legacyStatusForRunStatus(RUN_STATUSES.STALE),
      runStatus: RUN_STATUSES.STALE,
      completedAt: now,
      completionMode: 'stale-lease',
      errorMessage: 'Run lease expired before completion.',
    },
  })

  if (result.count > 0) {
    logger.crawler?.({
      level: 'warn',
      phase: 'cleanup',
      message: 'crawler_stale_runs_marked',
      data: { sourceId, count: result.count },
    })
  }

  return result.count
}

/**
 * Creates a single active running run under a transaction so concurrent cold starts cannot both proceed.
 */
export async function acquireLease({
  db = prisma,
  sourceId,
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
  now = new Date(),
  data = {},
} = {}) {
  return runTransaction(db, async tx => {
    if (typeof tx.$executeRawUnsafe === 'function') {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', sourceId)
    }

    await markExpiredRunsStale({ db: tx, sourceId, now })

    const activeRun = await tx.sourceRun.findFirst({
      where: {
        sourceId,
        runStatus: RUN_STATUSES.RUNNING,
        leaseExpiresAt: { gt: now },
      },
      select: {
        id: true,
        leaseExpiresAt: true,
      },
    })

    if (activeRun) {
      throw new CrawlError(
        `Crawler run already active for source ${sourceId}.`,
        CRAWL_ERROR_TYPES.FATAL,
        null,
        { sourceId, activeRunId: activeRun.id, leaseExpiresAt: activeRun.leaseExpiresAt }
      )
    }

    return tx.sourceRun.create({
      data: {
        ...data,
        sourceId,
        status: legacyStatusForRunStatus(RUN_STATUSES.RUNNING),
        runStatus: RUN_STATUSES.RUNNING,
        heartbeatAt: now,
        leaseExpiresAt: addMilliseconds(now, leaseDurationMs),
      },
    })
  })
}

export async function claimStaleRun({
  db = prisma,
  run,
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
  now = new Date(),
} = {}) {
  return runTransaction(db, async tx => {
    if (typeof tx.$executeRawUnsafe === 'function') {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock($1)', run.sourceId)
    }

    const currentRun = await tx.sourceRun.findUnique({
      where: { id: run.id },
    })

    assertValidTransition(currentRun.runStatus, RUN_STATUSES.RUNNING)

    const activeRun = await tx.sourceRun.findFirst({
      where: {
        sourceId: currentRun.sourceId,
        runStatus: RUN_STATUSES.RUNNING,
        leaseExpiresAt: { gt: now },
      },
      select: {
        id: true,
        leaseExpiresAt: true,
      },
    })

    if (activeRun) {
      throw new CrawlError(
        `Crawler run already active for source ${currentRun.sourceId}.`,
        CRAWL_ERROR_TYPES.FATAL,
        null,
        { sourceId: currentRun.sourceId, activeRunId: activeRun.id, leaseExpiresAt: activeRun.leaseExpiresAt }
      )
    }

    return tx.sourceRun.update({
      where: { id: currentRun.id },
      data: {
        status: legacyStatusForRunStatus(RUN_STATUSES.RUNNING),
        runStatus: RUN_STATUSES.RUNNING,
        completedAt: null,
        errorMessage: null,
        heartbeatAt: now,
        leaseExpiresAt: addMilliseconds(now, leaseDurationMs),
      },
    })
  })
}

export function startHeartbeat({
  db = prisma,
  runId,
  intervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
  logger = defaultLogger,
} = {}) {
  const timer = setInterval(async () => {
    const now = new Date()

    try {
      await db.sourceRun.update({
        where: { id: runId },
        data: {
          heartbeatAt: now,
          leaseExpiresAt: addMilliseconds(now, leaseDurationMs),
        },
      })
    } catch (error) {
      logger.crawler?.({
        level: 'warn',
        phase: 'processing',
        runId,
        message: 'crawler_heartbeat_failed',
        error,
      })
    }
  }, intervalMs)

  return () => clearInterval(timer)
}

export async function saveRunCursor({
  db = prisma,
  runId,
  cursor,
  tendersProcessedCount,
  lastProcessedTenderRef,
} = {}) {
  return db.sourceRun.update({
    where: { id: runId },
    data: {
      cursor,
      tendersProcessedCount,
      lastProcessedTenderRef,
    },
  })
}

export async function releaseRun({
  db = prisma,
  run,
  toStatus,
  diagnostics = null,
  cursor = null,
  data = {},
} = {}) {
  const currentRun = await db.sourceRun.findUnique({
    where: { id: run.id },
    select: { runStatus: true },
  })

  if (!currentRun) {
    throw new Error(`Cannot release missing source run ${run.id}`)
  }

  assertValidTransition(currentRun.runStatus, toStatus)

  return db.sourceRun.update({
    where: { id: run.id },
    data: {
      ...data,
      status: legacyStatusForRunStatus(toStatus),
      runStatus: toStatus,
      completedAt: new Date(),
      leaseExpiresAt: null,
      diagnostics,
      cursor,
    },
  })
}

export async function findLatestRunWithCursor({ db = prisma, sourceId } = {}) {
  const runs = await db.sourceRun.findMany({
    where: {
      sourceId,
      runStatus: RUN_STATUSES.STALE,
    },
    orderBy: { startedAt: 'desc' },
    take: 10,
  })

  return runs.find(run => run.cursor) || null
}

export const RUN_LEASE_DEFAULTS = {
  leaseDurationMs: DEFAULT_LEASE_DURATION_MS,
  heartbeatIntervalMs: DEFAULT_HEARTBEAT_INTERVAL_MS,
}
