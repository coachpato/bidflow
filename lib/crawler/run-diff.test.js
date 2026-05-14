import { DiagnosticsCollector } from '@/lib/diagnostics'
import { buildRunDiffMetrics, calculateRunDiff, createTenderSnapshot } from './run-diff'

describe('run-to-run diff metrics', () => {
  it('counts new, updated, and removed tender references', () => {
    const previousMetrics = {
      tenderHashes: {
        'BID-001': 'same-hash',
        'BID-002': 'old-hash',
        'BID-003': 'removed-hash',
      },
    }
    const currentSnapshots = [
      { reference: 'BID-001', hash: 'same-hash' },
      { reference: 'BID-002', hash: 'new-hash' },
      { reference: 'BID-004', hash: 'brand-new' },
    ]

    expect(calculateRunDiff(previousMetrics, currentSnapshots)).toMatchObject({
      previousTenderCount: 3,
      currentTenderCount: 3,
      newCount: 1,
      updatedCount: 1,
      removedCount: 1,
    })
  })

  it('builds JSON metrics and records a diagnostic warning for mass removals', async () => {
    const diagnostics = new DiagnosticsCollector()
    const db = {
      sourceRun: {
        findFirst: jest.fn(async () => ({
          id: 10,
          startedAt: new Date('2026-05-12T08:00:00.000Z'),
          metrics: {
            tenderHashes: {
              A: 'a',
              B: 'b',
              C: 'c',
              D: 'd',
            },
          },
        })),
      },
    }

    const metrics = await buildRunDiffMetrics({
      db,
      sourceId: 1,
      currentRunId: 11,
      currentSnapshots: [{ reference: 'A', hash: 'a' }],
      diagnostics,
    })

    expect(metrics.runDiff).toMatchObject({
      previousRunId: 10,
      previousTenderCount: 4,
      currentTenderCount: 1,
      removedCount: 3,
    })
    expect(metrics.runDiff.warning.type).toBe('mass-removal-anomaly')
    expect(diagnostics.snapshot().runDiffWarnings).toHaveLength(1)
  })

  it('creates stable tender snapshots from source fields', () => {
    expect(createTenderSnapshot({
      reference: 'BID-123/2026',
      title: 'Legal services panel',
      deadline: '2026-06-30',
      tenderDetails: { entity: 'Department' },
      category: 'Legal',
    })).toMatchObject({
      reference: 'BID-123/2026',
    })
  })
})
