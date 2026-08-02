import { DiagnosticsCollector } from '@/lib/diagnostics'
import { RUN_STATUSES } from '@/lib/run-state'
import { completePartialRun, completeSuccessfulRun } from './run-finalizer'

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
      results: results({ newOpportunitiesCreated: 1 }),
      tendersProcessedCount: 1,
      skippedForResume: 0,
      deliverDigests,
      notificationArgs: {},
    })

    expect(db.updates[0].runStatus).toBe(RUN_STATUSES.COMPLETED)
    expect(db.updates[0]).toMatchObject({
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
      results: results({ newOpportunitiesCreated: 1 }),
      tendersProcessedCount: 1,
      skippedForResume: 0,
      deliverDigests,
      notificationArgs: {},
      logger: { crawler: jest.fn() },
    })

    expect(db.updates[0].runStatus).toBe(RUN_STATUSES.COMPLETED)
    expect(db.updates[0]).toMatchObject({
      notificationError: 'SMTP unavailable',
    })
  })

  it('calls notification delivery for a partial run when new opportunities were written', async () => {
    const db = createFinalizerDb()
    const deliverDigests = jest.fn(async () => {})

    await completePartialRun({
      db,
      diagnostics: new DiagnosticsCollector(),
      sourceRun: { id: 100 },
      results: results({ newOpportunitiesCreated: 2 }),
      cursor: { nextPage: 2 },
      tendersProcessedCount: 10,
      lastProcessedTenderRef: 'BID-123/2026',
      skippedForResume: 0,
      deadlineMs: 240000,
      deliverDigests,
      notificationArgs: { sample: true },
    })

    expect(db.updates[0].runStatus).toBe(RUN_STATUSES.PARTIAL_TIMEOUT)
    expect(deliverDigests).toHaveBeenCalledWith({ sample: true })
    expect(db.updates[0]).toMatchObject({
      notificationSentAt: expect.any(Date),
      notificationError: null,
    })
  })

  it('calls notification delivery for a partial run even when no new opportunities were written', async () => {
    const db = createFinalizerDb()
    const deliverDigests = jest.fn(async () => {})

    await completePartialRun({
      db,
      diagnostics: new DiagnosticsCollector(),
      sourceRun: { id: 100 },
      results: results({ newOpportunitiesCreated: 0 }),
      cursor: { nextPage: 2 },
      tendersProcessedCount: 10,
      lastProcessedTenderRef: 'BID-123/2026',
      skippedForResume: 0,
      deadlineMs: 240000,
      deliverDigests,
      notificationArgs: {},
    })

    expect(db.updates).toHaveLength(1)
    expect(db.updates[0].runStatus).toBe(RUN_STATUSES.PARTIAL_TIMEOUT)
    expect(db.updates[0].notificationSentAt).toEqual(expect.any(Date))
    expect(db.updates[0].notificationError).toBeNull()
    expect(deliverDigests).toHaveBeenCalledWith({})
  })

  it('logs the exact skip condition when partial notifications are not configured', async () => {
    const db = createFinalizerDb()
    const logger = { crawler: jest.fn() }

    await completePartialRun({
      db,
      diagnostics: new DiagnosticsCollector(),
      sourceRun: { id: 100 },
      results: results({
        matchedCount: 116,
        newOpportunitiesCreated: 1,
        opportunitiesByOrganization: {
          21: {
            organizationId: 21,
            opportunities: [{ id: 3525 }],
          },
        },
      }),
      cursor: { nextPage: 7 },
      tendersProcessedCount: 100,
      lastProcessedTenderRef: 'TP/2026/03/0002/113792/RFP',
      skippedForResume: 0,
      deadlineMs: 240000,
      notificationArgs: { sample: true },
      logger,
    })

    expect(logger.crawler).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      message: 'crawler_notification_delivery_skipped',
      phase: 'cleanup',
      runId: 100,
      data: expect.objectContaining({
        skipReason: 'deliverDigests_not_configured',
        exactCondition: 'Boolean(deliverDigests)',
        conditionValue: false,
        deliverDigestsConfigured: false,
        notificationArgsProvided: true,
        newOpportunitiesCreated: 1,
        matchedCount: 116,
        opportunityGroups: 1,
      }),
    }))
  })

  it('captures notificationError for a partial run without changing partial_timeout status', async () => {
    const db = createFinalizerDb()
    const deliverDigests = jest.fn(async () => {
      throw new Error('SMTP unavailable')
    })

    await completePartialRun({
      db,
      diagnostics: new DiagnosticsCollector(),
      sourceRun: { id: 100 },
      results: results({ newOpportunitiesCreated: 1 }),
      cursor: { nextPage: 2 },
      tendersProcessedCount: 10,
      lastProcessedTenderRef: 'BID-123/2026',
      skippedForResume: 0,
      deadlineMs: 240000,
      deliverDigests,
      notificationArgs: {},
      logger: { crawler: jest.fn() },
    })

    expect(db.updates[0].runStatus).toBe(RUN_STATUSES.PARTIAL_TIMEOUT)
    expect(db.updates[0]).toMatchObject({
      notificationError: 'SMTP unavailable',
    })
  })
})
