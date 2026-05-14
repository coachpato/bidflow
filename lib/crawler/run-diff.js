import { createHash } from 'node:crypto'
import { RUN_STATUSES } from '@/lib/run-state'

function hashTender(tender) {
  const stableFields = {
    title: tender.title || null,
    reference: tender.reference || null,
    deadline: tender.deadline || null,
    entity: tender.tenderDetails?.entity || tender.entity || null,
    category: tender.category || null,
  }

  return createHash('sha256').update(JSON.stringify(stableFields)).digest('hex')
}

export function createTenderSnapshot(tender) {
  const reference = tender.reference || tender.url || tender.title || null
  if (!reference) return null

  return {
    reference,
    hash: hashTender(tender),
  }
}

export function calculateRunDiff(previousMetrics, currentSnapshots) {
  const previousHashes = previousMetrics?.tenderHashes || {}
  const previousRefs = new Set(Object.keys(previousHashes))
  const currentHashes = Object.fromEntries(currentSnapshots.map(item => [item.reference, item.hash]))
  const currentRefs = new Set(Object.keys(currentHashes))
  const newRefs = [...currentRefs].filter(ref => !previousRefs.has(ref))
  const removedRefs = [...previousRefs].filter(ref => !currentRefs.has(ref))
  const updatedRefs = [...currentRefs].filter(ref => previousRefs.has(ref) && previousHashes[ref] !== currentHashes[ref])
  const missingRatio = previousRefs.size === 0 ? 0 : removedRefs.length / previousRefs.size

  return {
    previousTenderCount: previousRefs.size,
    currentTenderCount: currentRefs.size,
    newCount: newRefs.length,
    updatedCount: updatedRefs.length,
    removedCount: removedRefs.length,
    missingRatio,
    newRefs,
    updatedRefs,
    removedRefs,
    tenderReferences: [...currentRefs],
    tenderHashes: currentHashes,
  }
}

export async function buildRunDiffMetrics({
  db,
  sourceId,
  currentRunId,
  currentSnapshots,
  diagnostics,
}) {
  const previousRun = await db.sourceRun.findFirst({
    where: {
      sourceId,
      id: { not: currentRunId },
      runStatus: {
        in: [RUN_STATUSES.COMPLETED, RUN_STATUSES.COMPLETED_WITH_WARNINGS],
      },
    },
    orderBy: { startedAt: 'desc' },
    select: {
      id: true,
      startedAt: true,
      metrics: true,
    },
  })
  const diff = calculateRunDiff(previousRun?.metrics, currentSnapshots)
  const warning = diff.previousTenderCount > 0 && diff.missingRatio > 0.5
    ? {
        type: 'mass-removal-anomaly',
        previousRunId: previousRun?.id || null,
        previousTenderCount: diff.previousTenderCount,
        currentTenderCount: diff.currentTenderCount,
        missingRatio: diff.missingRatio,
      }
    : null

  if (warning) {
    diagnostics.recordRunDiffWarning(warning)
  }

  return {
    runDiff: {
      previousRunId: previousRun?.id || null,
      previousRunStartedAt: previousRun?.startedAt?.toISOString?.() || previousRun?.startedAt || null,
      previousTenderCount: diff.previousTenderCount,
      currentTenderCount: diff.currentTenderCount,
      newCount: diff.newCount,
      updatedCount: diff.updatedCount,
      removedCount: diff.removedCount,
      missingRatio: diff.missingRatio,
      warning,
    },
    tenderReferences: diff.tenderReferences,
    tenderHashes: diff.tenderHashes,
  }
}
