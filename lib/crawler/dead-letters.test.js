import { CrawlError, CRAWL_ERROR_TYPES } from '@/lib/errors'
import { shouldDeadLetterTender, writeDeadLetter } from './dead-letters'

function createDeadLetterDb(existing = null) {
  const records = existing ? [{ ...existing }] : []

  return {
    records,
    deadLetter: {
      findFirst: jest.fn(async ({ where }) => records.find(record =>
        record.tenderRef === where.tenderRef && record.sourceRunId === where.sourceRunId
      ) || null),
      create: jest.fn(async ({ data }) => {
        const record = { id: records.length + 1, ...data }
        records.push(record)
        return record
      }),
      update: jest.fn(async ({ where, data }) => {
        const record = records.find(item => item.id === where.id)
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

describe('dead letter writes', () => {
  it('creates a dead letter for fatal tender failures', async () => {
    const db = createDeadLetterDb()

    await writeDeadLetter({
      db,
      tender: { reference: 'BID-123/2026', raw: { source: true } },
      sourceRun: { id: 10 },
      error: new CrawlError('Bad source data', CRAWL_ERROR_TYPES.SOURCE_DATA_INVALID),
    })

    expect(db.deadLetter.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenderRef: 'BID-123/2026',
        sourceRunId: 10,
        failureType: CRAWL_ERROR_TYPES.SOURCE_DATA_INVALID,
        failureCount: 1,
        lastError: 'Bad source data',
      }),
    })
  })

  it('can create a dead letter with the accumulated consecutive failure count', async () => {
    const db = createDeadLetterDb()

    await writeDeadLetter({
      db,
      tender: { reference: 'BID-123/2026' },
      sourceRun: { id: 10 },
      error: new CrawlError('Third retry failed', CRAWL_ERROR_TYPES.RETRYABLE),
      failureCount: 3,
    })

    expect(db.records[0].failureCount).toBe(3)
  })

  it('increments failureCount for an existing tenderRef and sourceRunId record', async () => {
    const db = createDeadLetterDb({
      id: 5,
      tenderRef: 'BID-123/2026',
      sourceRunId: 10,
      failureCount: 2,
      lastError: 'Previous failure',
    })

    await writeDeadLetter({
      db,
      tender: { reference: 'BID-123/2026' },
      sourceRun: { id: 10 },
      error: new CrawlError('Still failing', CRAWL_ERROR_TYPES.FATAL),
    })

    expect(db.records[0].failureCount).toBe(3)
    expect(db.records[0].lastError).toBe('Still failing')
  })

  it('dead-letters any error on the third consecutive attempt', () => {
    expect(shouldDeadLetterTender(
      new CrawlError('Temporary failure', CRAWL_ERROR_TYPES.RETRYABLE),
      3
    )).toBe(true)
  })
})
