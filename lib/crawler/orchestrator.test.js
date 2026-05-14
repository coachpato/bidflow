import { CrawlError, CRAWL_ERROR_TYPES } from '@/lib/errors'
import { RUN_STATUSES } from '@/lib/run-state'
import { fetchETendersPage } from './etenders-crawler'
import { runCrawlerOrchestration } from './orchestrator'
import { validateAndStoreSourceFingerprint } from './source-fingerprint'

jest.mock('./etenders-crawler', () => ({
  fetchETendersPage: jest.fn(),
  fetchETendersStructureHtml: jest.fn(async () => '<body><table></table></body>'),
}))

jest.mock('./source-fingerprint', () => ({
  validateAndStoreSourceFingerprint: jest.fn(),
}))

jest.mock('./run-diff', () => ({
  createTenderSnapshot: jest.fn(tender => ({ reference: tender.reference, hash: tender.title })),
  buildRunDiffMetrics: jest.fn(async () => ({
    runDiff: { previousTenderCount: 0, currentTenderCount: 1 },
    tenderReferences: ['BID-123/2026'],
    tenderHashes: { 'BID-123/2026': 'hash' },
  })),
}))

function createDb() {
  const sourceRuns = []
  const updates = []
  const deadLetters = []

  return {
    updates,
    deadLetters,
    source: {
      upsert: jest.fn(async ({ create }) => ({
        id: 1,
        ...create,
      })),
    },
    organization: {
      findMany: jest.fn(async () => [
        {
          id: 10,
          name: 'Acme Legal',
          firmProfile: {
            serviceSector: 'LEGAL_SERVICES',
            primaryContactEmail: null,
          },
        },
      ]),
    },
    user: {
      findMany: jest.fn(async () => []),
    },
    sourceRun: {
      updateMany: jest.fn(async () => ({ count: 0 })),
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }) => {
        const run = {
          id: 100,
          startedAt: new Date('2026-05-14T08:00:00.000Z'),
          ...data,
        }
        sourceRuns.push(run)
        return run
      }),
      findUnique: jest.fn(async ({ where }) => sourceRuns.find(run => run.id === where.id) || null),
      update: jest.fn(async ({ where, data }) => {
        const run = sourceRuns.find(item => item.id === where.id)
        Object.assign(run, data)
        updates.push(data)
        return run
      }),
    },
    deadLetter: {
      findFirst: jest.fn(async ({ where }) => deadLetters.find(item =>
        item.tenderRef === where.tenderRef && item.sourceRunId === where.sourceRunId
      ) || null),
      create: jest.fn(async ({ data }) => {
        const record = { id: deadLetters.length + 1, ...data }
        deadLetters.push(record)
        return record
      }),
      update: jest.fn(async ({ where, data }) => {
        const record = deadLetters.find(item => item.id === where.id)
        Object.assign(record, {
          ...data,
          failureCount: data.failureCount?.increment
            ? record.failureCount + data.failureCount.increment
            : data.failureCount,
        })
        return record
      }),
    },
  }
}

function pageBatch(tenderOverrides = {}) {
  return {
    pageNumber: 1,
    pageSize: 100,
    totalRecords: 1,
    totalPages: 1,
    rowCount: 1,
    isLastPage: true,
    tenders: [
      {
        reference: 'BID-123/2026',
        title: 'Legal services panel',
        description: 'Appointment of a panel of attorneys for legal services.',
        deadline: '2026-06-30T00:00:00.000Z',
        category: 'Legal Services',
        tenderDetails: { entity: 'Department' },
        pdfLinks: [],
        ...tenderOverrides,
      },
    ],
  }
}

async function runScenario({ db = createDb(), processTender = jest.fn(), logger = { crawler: jest.fn() } } = {}) {
  const result = await runCrawlerOrchestration({
    sourceConfig: {
      key: 'etenders-gov-za',
      name: 'eTenders.gov.za',
      type: 'portal',
      baseUrl: 'https://www.etenders.gov.za',
    },
    deadlineMs: 240_000,
    db,
    logger,
    processTender,
    deliverDigests: jest.fn(),
  })

  return { result, db, processTender, logger }
}

function findStatusUpdate(db) {
  return db.updates.find(update => update.runStatus)
}

describe('runCrawlerOrchestration Phase 3 behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    fetchETendersPage.mockResolvedValue(pageBatch())
    validateAndStoreSourceFingerprint.mockResolvedValue({
      severity: 'none',
      changed: false,
      reasons: [],
    })
  })

  it('finalizes partial structural changes as completed_with_warnings', async () => {
    validateAndStoreSourceFingerprint.mockResolvedValue({
      severity: 'warning',
      changed: true,
      reasons: ['tender-count-dropped'],
    })

    const { result, db } = await runScenario()

    expect(result.status).toBe(200)
    expect(findStatusUpdate(db).runStatus).toBe(RUN_STATUSES.COMPLETED_WITH_WARNINGS)
    expect(result.body.warnings[0]).toMatchObject({
      message: 'Source structure changed; crawl completed with warnings.',
      reasons: ['tender-count-dropped'],
    })
  })

  it('finalizes radically broken structure as failed', async () => {
    validateAndStoreSourceFingerprint.mockRejectedValue(new CrawlError(
      'eTenders structure changed radically: no tender cards were found.',
      CRAWL_ERROR_TYPES.FATAL
    ))

    const { result, db, processTender } = await runScenario()

    expect(result.status).toBe(500)
    expect(findStatusUpdate(db).runStatus).toBe(RUN_STATUSES.FAILED)
    expect(processTender).not.toHaveBeenCalled()
  })

  it('skips invalid tenders and counts them in diagnostics', async () => {
    fetchETendersPage.mockResolvedValue(pageBatch({
      reference: '12345',
      description: 'Valid length description',
    }))

    const { result, processTender } = await runScenario()

    expect(processTender).not.toHaveBeenCalled()
    expect(result.body.diagnostics.tendersInvalid).toBe(1)
  })

  it('logs warning tenders but still sends them through the write path', async () => {
    fetchETendersPage.mockResolvedValue(pageBatch({
      deadline: '2029-01-01T00:00:00.000Z',
    }))
    const logger = { crawler: jest.fn() }

    const { result, processTender } = await runScenario({ logger })

    expect(processTender).toHaveBeenCalledTimes(1)
    expect(result.body.diagnostics.tenderWarnings).toHaveLength(1)
    expect(logger.crawler).toHaveBeenCalledWith(expect.objectContaining({
      message: 'crawler_tender_quality_warning',
    }))
  })

  it('dead-letters fatal tender processing failures and still completes the run', async () => {
    const processTender = jest.fn(async () => {
      throw new CrawlError('Fatal write failure', CRAWL_ERROR_TYPES.FATAL)
    })

    const { result, db } = await runScenario({ processTender })

    expect(result.status).toBe(200)
    expect(findStatusUpdate(db).runStatus).toBe(RUN_STATUSES.COMPLETED_WITH_WARNINGS)
    expect(db.deadLetter.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenderRef: 'BID-123/2026',
        failureType: CRAWL_ERROR_TYPES.FATAL,
        failureCount: 1,
      }),
    }))
    expect(result.body.diagnostics.tendersDeadLettered).toBe(1)
  })

  it('exits with partial_timeout before page fetch when less than thirty seconds remain', async () => {
    const result = await runCrawlerOrchestration({
      sourceConfig: {
        key: 'etenders-gov-za',
        name: 'eTenders.gov.za',
        type: 'portal',
        baseUrl: 'https://www.etenders.gov.za',
      },
      deadlineMs: 29_000,
      db: createDb(),
      logger: { crawler: jest.fn() },
      processTender: jest.fn(),
      deliverDigests: jest.fn(),
      now: () => 0,
    })

    expect(result.status).toBe(200)
    expect(result.body.partial).toBe(true)
    expect(result.body.diagnostics.exitReason).toBe('time_budget')
  })

  it('exits with partial_timeout during processing when less than fifteen seconds remain', async () => {
    let currentTime = 0
    fetchETendersPage.mockImplementation(async () => {
      currentTime = 226_000
      return pageBatch()
    })

    const result = await runCrawlerOrchestration({
      sourceConfig: {
        key: 'etenders-gov-za',
        name: 'eTenders.gov.za',
        type: 'portal',
        baseUrl: 'https://www.etenders.gov.za',
      },
      deadlineMs: 240_000,
      db: createDb(),
      logger: { crawler: jest.fn() },
      processTender: jest.fn(),
      deliverDigests: jest.fn(),
      now: () => currentTime,
    })

    expect(result.status).toBe(200)
    expect(result.body.partial).toBe(true)
    expect(result.body.diagnostics.exitReason).toBe('time_budget')
  })
})
