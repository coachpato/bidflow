import { buildStructuredRunMetrics } from './run-metrics'

describe('structured run metrics', () => {
  it('includes timing, throughput, source health, data quality, resource, and run diff', () => {
    const metrics = buildStructuredRunMetrics({
      totalDurationMs: 10_000,
      diagnosticsSnapshot: {
        pagesProcessed: 2,
        tendersProcessed: 5,
        tendersInvalid: 1,
        tendersDeadLettered: 1,
        tendersWithNoMatches: 2,
        tenderWarnings: [{ tenderRef: 'BID-1' }],
        structuralChanges: [{ severity: 'warning' }],
        sourceHealth: {
          rateLimitEvents: 1,
          serverErrors: 2,
        },
        resource: {
          totalBytesDownloaded: 1234,
        },
        phaseTimings: {
          discovery: 4000,
          processing: 5000,
          cleanup: 1000,
        },
      },
      runDiffMetrics: {
        runDiff: { newCount: 1 },
        tenderReferences: ['BID-1'],
        tenderHashes: { 'BID-1': 'hash' },
      },
    })

    expect(metrics).toMatchObject({
      timingBreakdown: {
        discoveryDurationMs: 4000,
        processingDurationMs: 5000,
        finalizationDurationMs: 1000,
        totalDurationMs: 10000,
      },
      sourceHealth: {
        rateLimitEvents: 1,
        serverErrors: 2,
        structuralChangeDetected: true,
      },
      dataQuality: {
        tendersInvalid: 1,
        tendersWithWarnings: 1,
        tendersDeadLettered: 1,
        tendersWithNoMatches: 2,
      },
      resource: {
        totalBytesDownloaded: 1234,
      },
      runDiff: { newCount: 1 },
    })
    expect(metrics.throughput.pagesPerSecond).toBe(0.5)
    expect(metrics.throughput.tendersPerSecond).toBe(1)
  })
})
