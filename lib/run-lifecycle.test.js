import {
  acquireLease,
  claimStaleRun,
  markExpiredRunsStale,
  releaseRun,
  startHeartbeat,
} from './run-lifecycle'
import { getResumeStartPage, validateCursor } from './page-iterator'
import { RUN_STATUSES } from './run-state'

function createLeaseDb(initialRuns = []) {
  const sourceRuns = initialRuns.map(run => ({ ...run }))
  let nextId = sourceRuns.reduce((max, run) => Math.max(max, run.id), 0) + 1
  let transactionLock = Promise.resolve()

  const db = {
    sourceRuns,
    $executeRawUnsafe: jest.fn(async () => 1),
    $transaction: jest.fn(callback => {
      const result = transactionLock.then(() => callback(db))
      transactionLock = result.catch(() => {})
      return result
    }),
    sourceRun: {
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0
        for (const run of sourceRuns) {
          const isExpired = run.leaseExpiresAt === null || run.leaseExpiresAt < where.OR[1].leaseExpiresAt.lt
          if (run.sourceId === where.sourceId && run.runStatus === where.runStatus && isExpired) {
            Object.assign(run, data)
            count += 1
          }
        }
        return { count }
      }),
      findFirst: jest.fn(async ({ where }) => sourceRuns.find(run =>
        run.sourceId === where.sourceId
        && run.runStatus === where.runStatus
        && run.leaseExpiresAt > where.leaseExpiresAt.gt
      ) || null),
      findUnique: jest.fn(async ({ where }) => sourceRuns.find(run => run.id === where.id) || null),
      create: jest.fn(async ({ data }) => {
        const run = {
          id: nextId,
          startedAt: data.startedAt || new Date('2026-05-13T08:00:00.000Z'),
          ...data,
        }
        nextId += 1
        sourceRuns.push(run)
        return run
      }),
      update: jest.fn(async ({ where, data }) => {
        const run = sourceRuns.find(item => item.id === where.id)
        if (!run) throw new Error(`Missing run ${where.id}`)
        Object.assign(run, data)
        return run
      }),
    },
  }

  return db
}

describe('run lifecycle leasing', () => {
  it('prevents two concurrent crawl attempts from both acquiring the active lease', async () => {
    const db = createLeaseDb()
    const now = new Date('2026-05-13T08:00:00.000Z')

    const results = await Promise.allSettled([
      acquireLease({ db, sourceId: 1, now }),
      acquireLease({ db, sourceId: 1, now }),
    ])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(db.sourceRuns.filter(run => run.runStatus === RUN_STATUSES.RUNNING)).toHaveLength(1)
    expect(db.$executeRawUnsafe).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1)', 1)
  })

  it('marks expired running leases stale before acquiring a new run', async () => {
    const now = new Date('2026-05-13T08:00:00.000Z')
    const db = createLeaseDb([{
      id: 10,
      sourceId: 1,
      status: 'running',
      runStatus: RUN_STATUSES.RUNNING,
      leaseExpiresAt: new Date('2026-05-13T07:59:00.000Z'),
    }])

    const run = await acquireLease({ db, sourceId: 1, now })

    expect(db.sourceRuns.find(item => item.id === 10).runStatus).toBe(RUN_STATUSES.STALE)
    expect(run.runStatus).toBe(RUN_STATUSES.RUNNING)
  })

  it('claims a stale run by transitioning it back to running with a fresh lease', async () => {
    const now = new Date('2026-05-13T08:00:00.000Z')
    const db = createLeaseDb([{
      id: 10,
      sourceId: 1,
      status: 'stale',
      runStatus: RUN_STATUSES.STALE,
      leaseExpiresAt: new Date('2026-05-13T07:59:00.000Z'),
    }])

    const run = await claimStaleRun({
      db,
      run: db.sourceRuns[0],
      now,
      leaseDurationMs: 30_000,
    })

    expect(run.runStatus).toBe(RUN_STATUSES.RUNNING)
    expect(run.leaseExpiresAt).toEqual(new Date('2026-05-13T08:00:30.000Z'))
  })

  it('resumes a killed stale run from its saved cursor after cursor validation', async () => {
    const cursor = {
      lastProcessedPage: 2,
      nextPage: 3,
      lastProcessedRef: 'BID-002',
      firstRefOnPage: 'BID-001',
      lastRefOnPage: 'BID-002',
      pageSize: 2,
    }
    const db = createLeaseDb([{
      id: 10,
      sourceId: 1,
      status: 'stale',
      runStatus: RUN_STATUSES.STALE,
      leaseExpiresAt: new Date('2026-05-13T07:59:00.000Z'),
      cursor,
      tendersProcessedCount: 2,
      lastProcessedTenderRef: 'BID-002',
    }])

    const validation = await validateCursor({
      cursor,
      fetchPage: jest.fn(async pageNumber => ({
        pageNumber,
        tenders: [
          { reference: 'BID-001' },
          { reference: 'BID-002' },
        ],
      })),
    })
    const run = await claimStaleRun({
      db,
      run: db.sourceRuns[0],
      now: new Date('2026-05-13T08:00:00.000Z'),
      leaseDurationMs: 30_000,
    })

    expect(validation.valid).toBe(true)
    expect(run.runStatus).toBe(RUN_STATUSES.RUNNING)
    expect(getResumeStartPage(run.cursor)).toBe(3)
    expect(run.lastProcessedTenderRef).toBe('BID-002')
  })

  it('heartbeat refreshes heartbeatAt and leaseExpiresAt without throwing', async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-05-13T08:00:00.000Z'))
    const db = createLeaseDb([{
      id: 10,
      sourceId: 1,
      runStatus: RUN_STATUSES.RUNNING,
      leaseExpiresAt: new Date('2026-05-13T08:00:10.000Z'),
    }])

    const stopHeartbeat = startHeartbeat({
      db,
      runId: 10,
      intervalMs: 1000,
      leaseDurationMs: 30_000,
    })

    jest.advanceTimersByTime(1000)
    await Promise.resolve()
    stopHeartbeat()

    expect(db.sourceRuns[0].heartbeatAt).toEqual(new Date('2026-05-13T08:00:01.000Z'))
    expect(db.sourceRuns[0].leaseExpiresAt).toEqual(new Date('2026-05-13T08:00:31.000Z'))
    jest.useRealTimers()
  })

  it('stale cleanup treats legacy running rows with null leases as stale', async () => {
    const db = createLeaseDb([{
      id: 10,
      sourceId: 1,
      status: 'running',
      runStatus: RUN_STATUSES.RUNNING,
      leaseExpiresAt: null,
    }])

    const count = await markExpiredRunsStale({
      db,
      sourceId: 1,
      now: new Date('2026-05-13T08:00:00.000Z'),
    })

    expect(count).toBe(1)
    expect(db.sourceRuns[0].runStatus).toBe(RUN_STATUSES.STALE)
  })

  it('rejects release attempts that do not match the current persisted run status', async () => {
    const db = createLeaseDb([{
      id: 10,
      sourceId: 1,
      status: 'completed',
      runStatus: RUN_STATUSES.COMPLETED,
      leaseExpiresAt: null,
    }])

    await expect(releaseRun({
      db,
      run: { id: 10, runStatus: RUN_STATUSES.RUNNING },
      toStatus: RUN_STATUSES.FAILED,
    })).rejects.toThrow('Invalid run status transition from "completed" to "failed"')
  })
})
