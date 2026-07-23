const mockSendEmail = jest.fn()

jest.mock('@/lib/email', () => ({
  sendEmail: (...args) => mockSendEmail(...args),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {},
}))

import {
  pingCrawlerHeartbeat,
  sendCrawlerAdminSummary,
} from './run-observability'

function buildSubscriberDb() {
  const activeSubscribers = [
    { email: 'one@example.com', sector: 'construction' },
    { email: 'two@example.com', sector: 'it-technology' },
    { email: 'three@example.com', sector: 'healthcare' },
    { email: 'four@example.com', sector: 'legal' },
    { email: 'five@example.com', sector: 'finance' },
    { email: 'one@example.com', sector: 'energy' },
  ]

  return {
    subscriber: {
      findMany: jest.fn(async () => activeSubscribers),
      count: jest.fn(async () => 3),
    },
  }
}

function buildSuccessResult() {
  return {
    status: 200,
    body: {
      success: true,
      runId: 93,
      totalFound: 1822,
      newOpportunitiesCreated: 27,
      emailsSent: 12,
      subscriberMatchStats: {
        matchedSectors: ['construction', 'it-technology', 'healthcare', 'legal', 'finance'],
      },
      subscriberDigestsDelivered: [
        { subscriberId: 'sub_1', sector: 'construction' },
        { subscriberId: 'sub_2', sector: 'legal' },
      ],
      warnings: Array.from({ length: 63 }, () => ({ message: 'warning' })),
      errors: [],
    },
  }
}

describe('crawler run observability', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sends Healthchecks success pings with subscriber metrics', async () => {
    const fetchFn = jest.fn(async () => ({ ok: true, status: 200 }))
    const db = buildSubscriberDb()

    const result = await pingCrawlerHeartbeat({
      runId: 'route-run-1',
      result: buildSuccessResult(),
      startedAt: new Date('2026-07-23T04:00:55.657Z'),
      finishedAt: new Date('2026-07-23T04:03:29.283Z'),
      fetchFn,
      db,
      env: {
        CRAWLER_HEARTBEAT_URL: 'https://hc-ping.com/check-id',
      },
    })

    expect(result).toMatchObject({ skipped: false, statusCode: 200 })
    expect(fetchFn).toHaveBeenCalledWith('https://hc-ping.com/check-id', expect.objectContaining({
      method: 'POST',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: expect.stringContaining('Bid360 crawler success'),
    }))

    const body = fetchFn.mock.calls[0][1].body
    expect(body).toContain('Sectors matched: 5')
    expect(body).toContain('Subscribers notified: 12')
    expect(body).toContain('Total subscribers: 5')
    expect(body).toContain('Subscriber sectors: Construction, IT & Technology, Healthcare, Legal, Finance, Energy')
    expect(body).toContain('New subscribers (24h): 3')
    expect(body).not.toContain('Matched opportunities')
    expect(body).not.toContain('Digest emails sent')
    expect(body).not.toContain('Digest groups sent')
  })

  it('sends Healthchecks failure pings to the fail endpoint', async () => {
    const fetchFn = jest.fn(async () => ({ ok: true, status: 200 }))
    const failureResult = {
      status: 500,
      body: {
        success: false,
        runId: 93,
        error: 'Source structure changed unexpectedly',
        diagnostics: {
          exitReason: 'fatal_error',
          pageErrors: [
            { page: 2, error: 'HTTP 503' },
            { page: 3, error: 'HTTP 503' },
          ],
        },
      },
    }

    await pingCrawlerHeartbeat({
      runId: 'route-run-2',
      result: failureResult,
      startedAt: new Date('2026-07-23T04:00:55.657Z'),
      finishedAt: new Date('2026-07-23T04:01:30.123Z'),
      fetchFn,
      db: buildSubscriberDb(),
      env: {
        HEALTHCHECKS_URL: 'https://hc-ping.com/check-id',
      },
    })

    expect(fetchFn).toHaveBeenCalledWith('https://hc-ping.com/check-id/fail', expect.objectContaining({
      body: expect.stringContaining('Bid360 crawler FAILED'),
    }))
    const body = fetchFn.mock.calls[0][1].body
    expect(body).toContain('Failed at: 2026-07-23T04:01:30.123Z')
    expect(body).toContain('Error: Source structure changed unexpectedly')
    expect(body).toContain('Exit reason: fatal_error')
    expect(body).toContain('Page errors: 2')
  })

  it('sends admin summaries with subscriber fields and heartbeat status', async () => {
    mockSendEmail.mockResolvedValue({ data: { id: 'email_1' } })

    await sendCrawlerAdminSummary({
      runId: 'route-run-3',
      result: buildSuccessResult(),
      startedAt: new Date('2026-07-23T04:00:55.657Z'),
      finishedAt: new Date('2026-07-23T04:03:29.283Z'),
      heartbeatResult: { skipped: false, statusCode: 200 },
      db: buildSubscriberDb(),
      env: {
        ADMIN_EMAIL: 'admin@example.com',
      },
    })

    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: ['admin@example.com'],
      subject: 'Bid360 crawler success: 27 new, 12 subscriber(s) notified',
      text: expect.stringContaining('Heartbeat: sent (200)'),
      bypassDryRun: true,
    }))
    const text = mockSendEmail.mock.calls[0][0].text
    expect(text).toContain('Sectors matched: 5')
    expect(text).toContain('Subscribers notified: 12')
    expect(text).not.toContain('Digest groups sent')
  })
})
