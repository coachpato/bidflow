import { CrawlError, CRAWL_ERROR_TYPES } from '@/lib/errors'
import { RUN_STATUSES } from '@/lib/run-state'
import { createHostRateLimiter, requestWithRateLimit } from './rate-limiter'
import { captureSourceFingerprint } from './source-fingerprint'
import { runCrawlerOrchestration } from './orchestrator'

let mockFetchETendersPage
let mockFetchETendersStructureHtml

jest.mock('./etenders-crawler', () => ({
  fetchETendersPage: (...args) => mockFetchETendersPage(...args),
  fetchETendersStructureHtml: (...args) => mockFetchETendersStructureHtml(...args),
}))

function validTender(reference, overrides = {}) {
  return {
    reference,
    title: `Legal services tender ${reference}`,
    description: 'Appointment of a panel of attorneys for legal services.',
    deadline: '2026-06-30T00:00:00.000Z',
    category: 'Legal Services',
    tenderDetails: { entity: 'Department of Public Works' },
    pdfLinks: [],
    raw: {
      tender_No: reference,
      description: `Legal services tender ${reference}`,
      closing_Date: '2026-06-30T00:00:00.000Z',
    },
    ...overrides,
  }
}

function pageBatch(pageNumber, totalPages, tenders, overrides = {}) {
  return {
    pageNumber,
    pageSize: 3,
    totalRecords: totalPages * 3,
    totalPages,
    rowCount: tenders.length,
    isLastPage: pageNumber >= totalPages,
    tenders,
    ...overrides,
  }
}

function makePages(totalPages, tendersPerPage = 3) {
  const pages = new Map()
  for (let page = 1; page <= totalPages; page += 1) {
    const tenders = Array.from({ length: tendersPerPage }, (_, index) =>
      validTender(`BID-${page}-${index + 1}/2026`)
    )
    pages.set(page, pageBatch(page, totalPages, tenders))
  }
  return pages
}

function createFakeDb({ sourceRuns = [], fingerprint = null } = {}) {
  const runs = sourceRuns.map(run => ({ ...run }))
  const updates = []
  const deadLetters = []
  let storedFingerprint = fingerprint ? { id: 1, sourceId: 1, fingerprint } : null
  let nextRunId = runs.reduce((max, run) => Math.max(max, run.id), 100) + 1
  let transactionLock = Promise.resolve()

  const db = {
    runs,
    updates,
    deadLetters,
    get storedFingerprint() {
      return storedFingerprint
    },
    $executeRawUnsafe: jest.fn(async () => 1),
    $transaction: jest.fn(callback => {
      const result = transactionLock.then(() => callback(db))
      transactionLock = result.catch(() => {})
      return result
    }),
    source: {
      upsert: jest.fn(async ({ create }) => ({ id: 1, ...create })),
    },
    organization: {
      findMany: jest.fn(async () => [
        {
          id: 10,
          name: 'Acme Legal',
          firmProfile: {
            serviceSector: 'LEGAL_SERVICES',
            primaryContactEmail: 'ops@example.com',
          },
        },
      ]),
    },
    user: {
      findMany: jest.fn(async () => []),
    },
    sourceRun: {
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0
        for (const run of runs) {
          const leaseExpired = run.leaseExpiresAt === null
            || run.leaseExpiresAt < where.OR?.[1]?.leaseExpiresAt?.lt
          if (run.sourceId === where.sourceId && run.runStatus === where.runStatus && leaseExpired) {
            Object.assign(run, data)
            updates.push({ id: run.id, ...data })
            count += 1
          }
        }
        return { count }
      }),
      findMany: jest.fn(async ({ where }) => runs
        .filter(run => run.sourceId === where.sourceId)
        .sort((left, right) => right.startedAt - left.startedAt)),
      findFirst: jest.fn(async ({ where }) => {
        if (where.runStatus?.in) {
          return runs
            .filter(run =>
              run.sourceId === where.sourceId
              && run.id !== where.id?.not
              && where.runStatus.in.includes(run.runStatus)
            )
            .sort((left, right) => right.startedAt - left.startedAt)[0] || null
        }

        if (where.runStatus) {
          return runs.find(run =>
            run.sourceId === where.sourceId
            && run.runStatus === where.runStatus
            && run.leaseExpiresAt > where.leaseExpiresAt.gt
          ) || null
        }

        return null
      }),
      create: jest.fn(async ({ data }) => {
        const run = {
          id: nextRunId,
          startedAt: new Date(`2026-05-14T08:${String(nextRunId % 60).padStart(2, '0')}:00.000Z`),
          ...data,
        }
        nextRunId += 1
        runs.push(run)
        return run
      }),
      findUnique: jest.fn(async ({ where }) => runs.find(run => run.id === where.id) || null),
      update: jest.fn(async ({ where, data }) => {
        const run = runs.find(item => item.id === where.id)
        if (!run) throw new Error(`Missing sourceRun ${where.id}`)
        Object.assign(run, data)
        updates.push({ id: run.id, ...data })
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
    sourceFingerprint: {
      findUnique: jest.fn(async ({ where }) => (
        storedFingerprint?.sourceId === where.sourceId ? storedFingerprint : null
      )),
      upsert: jest.fn(async ({ create, update }) => {
        storedFingerprint = {
          id: storedFingerprint?.id || 1,
          sourceId: create?.sourceId ?? storedFingerprint.sourceId,
          fingerprint: create?.fingerprint ?? update.fingerprint,
        }
        return storedFingerprint
      }),
    },
  }

  return db
}

function defaultLogger() {
  return { crawler: jest.fn() }
}

async function runCrawl({
  db = createFakeDb(),
  deadlineMs = 240_000,
  now = () => 0,
  processTender = jest.fn(async () => {}),
  deliverDigests = jest.fn(async () => {}),
  logger = defaultLogger(),
} = {}) {
  const result = await runCrawlerOrchestration({
    sourceConfig: {
      key: 'etenders-gov-za',
      name: 'eTenders.gov.za',
      type: 'portal',
      baseUrl: 'https://www.etenders.gov.za',
    },
    deadlineMs,
    db,
    logger,
    now,
    processTender,
    deliverDigests,
  })

  return { result, db, processTender, deliverDigests, logger }
}

function statusUpdate(db, status) {
  return db.updates.find(update => update.runStatus === status)
}

describe('crawler end-to-end integration scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchETendersStructureHtml = jest.fn(async () => '<body><table><tbody><tr></tr></tbody></table></body>')
  })

  it('normal crawl fetches three pages, processes tenders, completes, and stores metrics with run diff', async () => {
    const pages = makePages(3, 2)
    const fetchedPages = []
    mockFetchETendersPage = jest.fn(async pageNumber => {
      fetchedPages.push(pageNumber)
      return pages.get(pageNumber)
    })
    const processTender = jest.fn(async () => {})

    const { result, db } = await runCrawl({ processTender })

    expect(result.status).toBe(200)
    expect(fetchedPages).toEqual([1, 2, 3])
    expect(processTender).toHaveBeenCalledTimes(6)
    expect(statusUpdate(db, RUN_STATUSES.COMPLETED)).toBeTruthy()
    expect(statusUpdate(db, RUN_STATUSES.COMPLETED).metrics).toMatchObject({
      timingBreakdown: expect.any(Object),
      throughput: expect.any(Object),
      runDiff: expect.any(Object),
      tenderHashes: expect.any(Object),
    })
  })

  it('timeout after page three saves cursor and the next run resumes from page four', async () => {
    const db = createFakeDb()
    const pages = makePages(5, 1)
    const firstRunPages = []
    let currentTime = 0
    mockFetchETendersPage = jest.fn(async pageNumber => {
      firstRunPages.push(pageNumber)
      return pages.get(pageNumber)
    })
    const processTender = jest.fn(async ({ tender }) => {
      if (tender.reference === 'BID-3-1/2026') currentTime = 211_000
    })

    const firstRun = await runCrawl({ db, now: () => currentTime, processTender })
    expect(firstRun.result.body.partial).toBe(true)
    expect(statusUpdate(db, RUN_STATUSES.PARTIAL_TIMEOUT).cursor).toMatchObject({
      lastProcessedPage: 3,
      nextPage: 4,
    })
    expect(firstRun.result.body.diagnostics.exitReason).toBe('time_budget')

    const secondRunPages = []
    currentTime = 0
    mockFetchETendersPage = jest.fn(async pageNumber => {
      secondRunPages.push(pageNumber)
      return pages.get(pageNumber)
    })

    const secondRun = await runCrawl({ db, now: () => currentTime })
    expect(secondRun.result.status).toBe(200)
    expect(secondRunPages).toEqual([3, 4, 5])
  })

  it('partial timeout delivers digests when new opportunities were created', async () => {
    const db = createFakeDb()
    const pages = makePages(5, 1)
    let currentTime = 0
    mockFetchETendersPage = jest.fn(async pageNumber => pages.get(pageNumber))
    const processTender = jest.fn(async ({ tender, results }) => {
      if (tender.reference === 'BID-1-1/2026') {
        results.matchedCount += 1
        results.newOpportunitiesCreated += 1
        results.opportunitiesByOrganization[10] = {
          organizationId: 10,
          organizationName: 'Acme Legal',
          opportunities: [{ id: 1, title: 'New legal services tender' }],
        }
      }

      if (tender.reference === 'BID-3-1/2026') currentTime = 211_000
    })
    const deliverDigests = jest.fn(async ({ results }) => {
      results.digestsSent += 1
      results.emailsAttempted += 1
      results.emailsSent += 1
    })

    const { result } = await runCrawl({ db, now: () => currentTime, processTender, deliverDigests })
    const partialUpdate = statusUpdate(db, RUN_STATUSES.PARTIAL_TIMEOUT)

    expect(result.status).toBe(200)
    expect(result.body.partial).toBe(true)
    expect(deliverDigests).toHaveBeenCalledWith(expect.objectContaining({
      sourceRun: expect.objectContaining({ id: db.runs[0].id }),
      results: expect.objectContaining({ newOpportunitiesCreated: 1 }),
      organizations: expect.arrayContaining([
        expect.objectContaining({ id: 10, name: 'Acme Legal' }),
      ]),
    }))
    expect(partialUpdate).toMatchObject({
      notificationSentAt: expect.any(Date),
      notificationError: null,
      summary: expect.objectContaining({
        digestsSent: 1,
        emailsAttempted: 1,
        emailsSent: 1,
      }),
    })
  })

  it('partial structural change completes with warnings and updates the fingerprint', async () => {
    const previousFingerprint = captureSourceFingerprint({
      pageBatch: pageBatch(1, 1, Array.from({ length: 10 }, (_, index) => validTender(`BID-PREV-${index}/2026`))),
      html: '<body><table></table></body>',
    })
    const db = createFakeDb({ fingerprint: previousFingerprint })
    mockFetchETendersPage = jest.fn(async () => pageBatch(1, 1, [
      validTender('BID-1/2026'),
      validTender('BID-2/2026'),
      validTender('BID-3/2026'),
      validTender('BID-4/2026'),
    ]))

    const { result } = await runCrawl({ db })

    expect(result.status).toBe(200)
    expect(statusUpdate(db, RUN_STATUSES.COMPLETED_WITH_WARNINGS)).toBeTruthy()
    expect(db.sourceFingerprint.upsert).toHaveBeenCalled()
    expect(result.body.diagnostics.structuralChanges[0].severity).toBe('warning')
  })

  it('total structural change fails, leaves fingerprint untouched, and writes no tenders', async () => {
    const previousFingerprint = captureSourceFingerprint({
      pageBatch: pageBatch(1, 1, [validTender('BID-PREV/2026')]),
      html: '<body><table></table></body>',
    })
    const db = createFakeDb({ fingerprint: previousFingerprint })
    mockFetchETendersPage = jest.fn(async () => pageBatch(1, 1, [], {
      rowCount: 0,
      totalRecords: 0,
    }))
    mockFetchETendersStructureHtml = jest.fn(async () => '<body></body>')
    const processTender = jest.fn()

    const { result } = await runCrawl({ db, processTender })

    expect(result.status).toBe(500)
    expect(statusUpdate(db, RUN_STATUSES.FAILED)).toBeTruthy()
    expect(db.sourceFingerprint.upsert).not.toHaveBeenCalled()
    expect(processTender).not.toHaveBeenCalled()
  })

  it('rate limiting backs off on Retry-After for pages two and three and completes', async () => {
    const pages = makePages(3, 1)
    const attempts = {}
    const sleeps = []
    let currentTime = 0
    const limiter = createHostRateLimiter({
      now: () => currentTime,
      sleep: async ms => {
        sleeps.push(ms)
        currentTime += ms
      },
      logger: defaultLogger(),
    })

    mockFetchETendersPage = jest.fn(async pageNumber => {
      await requestWithRateLimit({
        url: `https://www.etenders.gov.za/page-${pageNumber}`,
        operationName: `page-${pageNumber}`,
        limiter,
        request: async () => {
          attempts[pageNumber] = (attempts[pageNumber] || 0) + 1
          if ([2, 3].includes(pageNumber) && attempts[pageNumber] === 1) {
            throw { response: { status: 429, headers: { 'retry-after': '2' } } }
          }
          return { data: 'ok' }
        },
      })
      return pages.get(pageNumber)
    })

    const { result } = await runCrawl({ now: () => currentTime })

    expect(result.status).toBe(200)
    expect(sleeps).toEqual(expect.arrayContaining([2000, 2000]))
  })

  it('dead letter accumulation records failureCount three and run still completes', async () => {
    const repeatedTender = validTender('BID-RETRY/2026')
    const pages = new Map([
      [1, pageBatch(1, 3, [repeatedTender])],
      [2, pageBatch(2, 3, [repeatedTender])],
      [3, pageBatch(3, 3, [repeatedTender])],
    ])
    mockFetchETendersPage = jest.fn(async pageNumber => pages.get(pageNumber))
    const processTender = jest.fn(async () => {
      throw new CrawlError('Temporary processing failure', CRAWL_ERROR_TYPES.RETRYABLE)
    })

    const { result, db } = await runCrawl({ processTender })

    expect(result.status).toBe(200)
    expect(db.deadLetters[0]).toMatchObject({
      tenderRef: 'BID-RETRY/2026',
      failureCount: 3,
    })
    expect(result.body.diagnostics.tendersDeadLettered).toBe(1)
  })

  it('notification failure leaves run completed and records notificationError', async () => {
    mockFetchETendersPage = jest.fn(async () => makePages(1, 1).get(1))
    const processTender = jest.fn(async ({ results }) => {
      results.newOpportunitiesCreated += 1
    })
    const deliverDigests = jest.fn(async () => {
      throw new Error('Mail service unavailable')
    })

    const { result, db } = await runCrawl({ processTender, deliverDigests })

    expect(result.status).toBe(200)
    expect(statusUpdate(db, RUN_STATUSES.COMPLETED)).toBeTruthy()
    expect(db.updates.at(-1)).toMatchObject({
      id: db.runs[0].id,
      notificationError: 'Mail service unavailable',
      notificationSentAt: null,
    })
    expect(db.runs[0].notificationSentAt).toBeNull()
  })

  it('prevents concurrent runs from both acquiring the lease', async () => {
    mockFetchETendersPage = jest.fn(async () => makePages(1, 1).get(1))
    let releaseProcessing
    const processingGate = new Promise(resolve => {
      releaseProcessing = resolve
    })
    const db = createFakeDb()
    const first = runCrawl({
      db,
      processTender: jest.fn(async () => processingGate),
    })
    const second = runCrawl({ db })

    releaseProcessing()
    const results = await Promise.all([first, second])
    const statuses = results.map(item => item.result.status).sort()

    expect(statuses).toEqual([200, 500])
    expect(db.runs.filter(run => run.runStatus === RUN_STATUSES.RUNNING || run.runStatus === RUN_STATUSES.COMPLETED))
      .toHaveLength(1)
  })

  it('marks expired running leases stale and allows a new run to proceed', async () => {
    const staleRun = {
      id: 50,
      sourceId: 1,
      status: 'running',
      runStatus: RUN_STATUSES.RUNNING,
      startedAt: new Date('2026-05-13T08:00:00.000Z'),
      leaseExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
      cursor: null,
    }
    const db = createFakeDb({ sourceRuns: [staleRun] })
    mockFetchETendersPage = jest.fn(async () => makePages(1, 1).get(1))

    const { result } = await runCrawl({ db })

    expect(result.status).toBe(200)
    expect(db.runs.find(run => run.id === 50).runStatus).toBe(RUN_STATUSES.STALE)
    expect(statusUpdate(db, RUN_STATUSES.COMPLETED)).toBeTruthy()
  })
})

describe('crawler edge-case scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchETendersStructureHtml = jest.fn(async () => '<body><table><tbody></tbody></table></body>')
  })

  it('handles an empty first-ever source with zero tenders', async () => {
    mockFetchETendersPage = jest.fn(async () => pageBatch(1, 1, [], {
      rowCount: 0,
      totalRecords: 0,
    }))
    const processTender = jest.fn()

    const { result, db } = await runCrawl({ processTender })

    expect(result.status).toBe(200)
    expect(statusUpdate(db, RUN_STATUSES.COMPLETED)).toBeTruthy()
    expect(processTender).not.toHaveBeenCalled()
  })

  it('handles a single tender on a single page', async () => {
    mockFetchETendersPage = jest.fn(async () => pageBatch(1, 1, [validTender('BID-SINGLE/2026')]))
    const processTender = jest.fn(async () => {})

    const { result } = await runCrawl({ processTender })

    expect(result.status).toBe(200)
    expect(processTender).toHaveBeenCalledTimes(1)
  })

  it('handles tenders with optional fields missing', async () => {
    mockFetchETendersPage = jest.fn(async () => pageBatch(1, 1, [
      validTender('BID-OPTIONAL/2026', {
        category: null,
        deadline: null,
        tenderDetails: {},
        pdfLinks: undefined,
      }),
    ]))
    const processTender = jest.fn(async () => {})

    const { result } = await runCrawl({ processTender })

    expect(result.status).toBe(200)
    expect(processTender).toHaveBeenCalledTimes(1)
  })

  it('logs a warning but processes a tender with a closing date five years in the future', async () => {
    mockFetchETendersPage = jest.fn(async () => pageBatch(1, 1, [
      validTender('BID-FUTURE/2026', {
        deadline: '2031-05-14T00:00:00.000Z',
      }),
    ]))
    const processTender = jest.fn(async () => {})

    const { result } = await runCrawl({ processTender })

    expect(result.status).toBe(200)
    expect(processTender).toHaveBeenCalledTimes(1)
    expect(result.body.diagnostics.tenderWarnings[0].warnings).toContain('closing-date-too-far-in-future')
  })

  it('handles a 200 response page with no parseable tenders', async () => {
    mockFetchETendersPage = jest.fn(async () => pageBatch(1, 1, [], {
      rowCount: 1,
      totalRecords: 1,
    }))
    const processTender = jest.fn()

    const { result } = await runCrawl({ processTender })

    expect(result.status).toBe(200)
    expect(result.body.diagnostics.tendersProcessed).toBe(0)
    expect(processTender).not.toHaveBeenCalled()
  })

  it('handles an extremely large page without crashing', async () => {
    const largePage = Array.from({ length: 1000 }, (_, index) => validTender(`BID-LARGE-${index}/2026`))
    mockFetchETendersPage = jest.fn(async () => pageBatch(1, 1, largePage, {
      rowCount: largePage.length,
      totalRecords: largePage.length,
    }))
    const processTender = jest.fn(async () => {})

    const { result } = await runCrawl({ processTender })

    expect(result.status).toBe(200)
    expect(processTender).toHaveBeenCalledTimes(1000)
  })

  it('fails cleanly when the database connection drops during progress save', async () => {
    const db = createFakeDb()
    const originalUpdate = db.sourceRun.update
    let progressSaveFailed = false
    db.sourceRun.update = jest.fn(async args => {
      if (args.data.cursor && !progressSaveFailed) {
        progressSaveFailed = true
        throw new Error('Database connection lost')
      }
      return originalUpdate(args)
    })
    mockFetchETendersPage = jest.fn(async () => pageBatch(1, 1, [validTender('BID-DBFAIL/2026')]))

    const { result } = await runCrawl({ db })

    expect(result.status).toBe(500)
    expect(statusUpdate(db, RUN_STATUSES.FAILED)).toBeTruthy()
  })

  it('does not crash if a tender reference mutates between discovery and processing', async () => {
    mockFetchETendersPage = jest.fn(async () => pageBatch(1, 1, [validTender('BID-RACE/2026')]))
    const processTender = jest.fn(async ({ tender }) => {
      tender.reference = 'BID-RACE-MUTATED/2026'
    })

    const { result } = await runCrawl({ processTender })

    expect(result.status).toBe(200)
    expect(processTender).toHaveBeenCalledTimes(1)
  })
})
