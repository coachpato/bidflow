import { expireCacheTags, publicTenderCacheTag } from '@/lib/cache-tags'
import { getTenderArchiveMonths } from '@/lib/crawler/tender-identity'
import { logger as defaultLogger } from '@/lib/logger'

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function getArchiveCutoff({ now = new Date(), archiveMonths = getTenderArchiveMonths() } = {}) {
  const parsedNow = toDate(now)
  const cutoff = parsedNow ? new Date(parsedNow) : new Date()
  cutoff.setMonth(cutoff.getMonth() - archiveMonths)
  return cutoff
}

export function isTenderEligibleForArchival(tender, {
  now = new Date(),
  archiveMonths = getTenderArchiveMonths(),
} = {}) {
  if (!tender || tender.archivedAt) return false

  const deadline = toDate(tender.deadline)
  const nowDate = toDate(now) || new Date()
  const cutoff = getArchiveCutoff({ now: nowDate, archiveMonths })

  // A missing deadline is never treated as old enough to archive. This keeps
  // incomplete source records accessible until a human or source update fills
  // in their lifecycle data.
  return Boolean(deadline && deadline < cutoff && deadline < nowDate)
}

export async function planTenderRetention({
  db,
  now = new Date(),
  archiveMonths = getTenderArchiveMonths(),
  batchSize = 100,
} = {}) {
  if (typeof db?.opportunity?.findMany !== 'function') {
    return {
      cutoff: getArchiveCutoff({ now, archiveMonths }),
      candidates: [],
      count: 0,
      skipped: true,
      reason: 'database_unavailable',
    }
  }

  const cutoff = getArchiveCutoff({ now, archiveMonths })
  const candidates = await db.opportunity.findMany({
    where: {
      archivedAt: null,
      deadline: { lt: cutoff },
    },
    orderBy: { deadline: 'asc' },
    take: Math.max(1, Math.min(Number(batchSize) || 100, 1000)),
    select: {
      id: true,
      title: true,
      deadline: true,
      archivedAt: true,
      status: true,
      sourceStatus: true,
    },
  })

  return {
    cutoff,
    candidates: candidates.filter(candidate => isTenderEligibleForArchival(candidate, { now, archiveMonths })),
    count: candidates.length,
    skipped: false,
  }
}

export async function runTenderRetentionJob({
  db,
  now = new Date(),
  archiveMonths = getTenderArchiveMonths(),
  batchSize = 100,
  dryRun = true,
  crawlerLogger = defaultLogger,
} = {}) {
  const plan = await planTenderRetention({ db, now, archiveMonths, batchSize })
  if (plan.skipped || dryRun) {
    crawlerLogger.crawler?.({
      level: 'info',
      phase: 'retention',
      message: 'tender_retention_dry_run',
      data: {
        dryRun: true,
        candidates: plan.candidates.length,
        cutoff: plan.cutoff.toISOString(),
      },
    })
    return {
      ...plan,
      dryRun: true,
      archived: 0,
    }
  }

  let archived = 0
  for (const candidate of plan.candidates) {
    await db.opportunity.update({
      where: { id: candidate.id },
      data: { archivedAt: now },
      select: { id: true },
    })
    try {
      await expireCacheTags(publicTenderCacheTag(candidate.id))
    } catch (error) {
      crawlerLogger.crawler?.({
        level: 'warn',
        phase: 'retention',
        message: 'tender_retention_cache_invalidation_skipped',
        data: { opportunityId: candidate.id, errorType: error?.name || 'cache_invalidation_error' },
      })
    }
    archived += 1
  }

  crawlerLogger.crawler?.({
    level: 'info',
    phase: 'retention',
    message: 'tender_retention_archived',
    data: {
      dryRun: false,
      candidates: plan.candidates.length,
      archived,
      cutoff: plan.cutoff.toISOString(),
    },
  })

  return {
    ...plan,
    dryRun: false,
    archived,
  }
}

export { getArchiveCutoff }
