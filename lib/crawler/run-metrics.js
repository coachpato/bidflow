function safeRate(count, durationMs) {
  if (!durationMs || durationMs <= 0) return 0
  return count / (durationMs / 1000)
}

export function buildStructuredRunMetrics({
  diagnosticsSnapshot,
  runDiffMetrics = null,
  totalDurationMs = null,
} = {}) {
  const phaseTimings = diagnosticsSnapshot.phaseTimings || {}
  const totalMs = totalDurationMs ?? (
    (phaseTimings.discovery || 0)
    + (phaseTimings.processing || 0)
    + (phaseTimings.cleanup || 0)
  )

  return {
    timingBreakdown: {
      discoveryDurationMs: phaseTimings.discovery || 0,
      processingDurationMs: phaseTimings.processing || 0,
      finalizationDurationMs: phaseTimings.cleanup || 0,
      totalDurationMs: totalMs,
    },
    throughput: {
      pagesPerSecond: safeRate(diagnosticsSnapshot.pagesProcessed || 0, phaseTimings.discovery || totalMs),
      tendersPerSecond: safeRate(diagnosticsSnapshot.tendersProcessed || 0, phaseTimings.processing || totalMs),
    },
    sourceHealth: {
      rateLimitEvents: diagnosticsSnapshot.sourceHealth?.rateLimitEvents || 0,
      serverErrors: diagnosticsSnapshot.sourceHealth?.serverErrors || 0,
      structuralChangeDetected: (diagnosticsSnapshot.structuralChanges || []).length > 0,
    },
    dataQuality: {
      tendersInvalid: diagnosticsSnapshot.tendersInvalid || 0,
      tendersWithWarnings: diagnosticsSnapshot.tenderWarnings?.length || 0,
      tendersDeadLettered: diagnosticsSnapshot.tendersDeadLettered || 0,
      tendersWithNoMatches: diagnosticsSnapshot.tendersWithNoMatches || 0,
    },
    resource: {
      totalBytesDownloaded: diagnosticsSnapshot.resource?.totalBytesDownloaded || 0,
    },
    runDiff: runDiffMetrics?.runDiff || null,
    tenderReferences: runDiffMetrics?.tenderReferences || [],
    tenderHashes: runDiffMetrics?.tenderHashes || {},
  }
}
