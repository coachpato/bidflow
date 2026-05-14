import { DiagnosticsCollector } from '@/lib/diagnostics'
import { RUN_STATUSES } from '@/lib/run-state'
import { completeSuccessfulRun } from './run-finalizer'

function createFinalizerDb() {
  const run = {
    id: 100,
    runStatus: RUN_STATUSES.RUNNING,
  }
  const updates = []

  return {
    updates,
    sourceRun: {
      findUnique: jest.fn(async () => run),
      update: jest.fn(async ({ data }) => {
        Object.assign(run, data)
        updates.push(data)
        return run
      }),
    },
  }
}

function results(overrides = {}) {
  return {
    totalFound: 1,
    matchedCount: 0,
    newOpportunitiesCreated: 0,
    errors: [],
    warnings: [],
    digestsSent: 0,
    organizationsEvaluated: 1,
    opportunitiesByOrganization: {},
    ...overrides,
  }
}

describe('crawler run finalizer', () => {
  it('stores run diff metrics on successful completion', async () => {
    const db = createFinalizerDb()
    const metrics = {
      runDiff: { newCount: 1, updatedCount: 0, removedCount: 0 },
      tenderHashes: { 'BID-123/2026': 'hash' },
    }

    await completeSuccessfulRun({
      db,
      diagnostics: new DiagnosticsCollector(),
      sourceRun: { id: 100 },
      results: results(),
      tendersProcessedCount: 1,
      skippedForResume: 0,
      metrics,
    })

    expect(db.updates[0].runStatus).toBe(RUN_STATUSES.COMPLETED)
    expect(db.updates[0].metrics).toMatchObject({
      timingBreakdown: expect.any(Object),
      throughput: expect.any(Object),
      sourceHealth: expect.any(Object),
      dataQuality: expect.any(Object),
      resource: expect.any(Object),
      runDiff: metrics.runDiff,
    })
  })

  it('uses completed_with_warnings when warnings were recorded', async () => {
    const db = createFinalizerDb()

    await completeSuccessfulRun({
      db,
      diagnostics: new DiagnosticsCollector(),
      sourceRun: { id: 100 },
      results: results({
        warnings: [{ message: 'Source structure changed' }],
      }),
      tendersProcessedCount: 1,
      skippedForResume: 0,
      metrics: null,
    })

    expect(db.updates.at(-1).runStatus).toBe(RUN_STATUSES.COMPLETED_WITH_WARNINGS)
  })

  it('sets notificationSentAt after completion when notification succeeds', async () => {
    const db = createFinalizerDb()
    const deliverDigests = jest.fn(async () => {})

    await completeSuccessfulRun({
      db,
      diagnostics: new DiagnosticsCollector(),
      sourceRun: { id: 100 },
      results: results(),
      tendersProcessedCount: 1,
      skippedForResume: 0,
      deliverDigests,
      notificationArgs: {},
    })

    expect(db.updates[0].runStatus).toBe(RUN_STATUSES.COMPLETED)
    expect(db.updates[1]).toMatchObject({
      notificationSentAt: expect.any(Date),
      notificationError: null,
    })
  })

  it('captures notificationError without changing completed status when notification fails', async () => {
    const db = createFinalizerDb()
    const deliverDigests = jest.fn(async () => {
      throw new Error('SMTP unavailable')
    })

    await completeSuccessfulRun({
      db,
      diagnostics: new DiagnosticsCollector(),
      sourceRun: { id: 100 },
      results: results(),
      tendersProcessedCount: 1,
      skippedForResume: 0,
      deliverDigests,
      notificationArgs: {},
      logger: { crawler: jest.fn() },
    })

    expect(db.updates[0].runStatus).toBe(RUN_STATUSES.COMPLETED)
    expect(db.updates[1]).toEqual({
      notificationError: 'SMTP unavailable',
    })
  })
})
