const mockSendEmail = jest.fn()

jest.mock('@/lib/email', () => ({
  getAppUrl: () => 'https://bid360.example',
  sendEmail: (...args) => mockSendEmail(...args),
}))

import { DiagnosticsCollector } from '@/lib/diagnostics'
import { RUN_STATUSES } from '@/lib/run-state'
import { completeSuccessfulRun } from './run-finalizer'
import {
  buildSubscriberDigestDeliveryVisibility,
  deliverDigestNotifications,
} from './digest-notifications'

function buildSubscriberMatchMap() {
  return new Map([
    ['sub_1', {
      subscriber: {
        id: 'sub_1',
        email: 'builder@example.com',
        entityName: 'Builder Co',
        sector: 'construction',
        unsubscribeToken: 'token_1',
      },
      tenders: [
        {
          id: 101,
          title: 'Road construction tender',
          reference: 'BID-101/2026',
          entity: 'Department of Roads',
          category: 'Infrastructure',
          sourceUrl: 'https://www.etenders.gov.za/Home/opportunities?id=101',
          deadline: new Date('2026-08-15T00:00:00.000Z'),
        },
      ],
    }],
  ])
}

function buildResults(matchMap = buildSubscriberMatchMap()) {
  const results = {
    totalFound: 1,
    matchedCount: 1,
    newOpportunitiesCreated: 1,
    errors: [],
    warnings: [],
    digestsSent: 0,
    emailsAttempted: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    organizationsEvaluated: 1,
    opportunitiesByOrganization: {},
    subscriberDigestGroups: matchMap.size,
    subscriberDigestsDelivered: [],
    subscriberMatchStats: {
      subscriberMatches: 1,
    },
  }

  Object.defineProperty(results, 'subscriberMatchMap', {
    value: matchMap,
    enumerable: false,
    writable: true,
  })

  return results
}

function createFinalizerDb() {
  const run = {
    id: 300,
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

describe('subscriber digest delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sends a personalized digest email per subscriber with an unsubscribe link', async () => {
    mockSendEmail.mockResolvedValue({ data: { id: 'email_1' } })
    const results = buildResults()

    await deliverDigestNotifications({
      sourceRun: {
        id: 88,
        startedAt: new Date('2026-07-23T08:00:00.000Z'),
      },
      results,
      crawlerLogger: { crawler: jest.fn() },
    })

    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'builder@example.com',
      subject: 'Your Construction tender digest — 2026-07-23',
      html: expect.stringContaining('Builder Co'),
      text: expect.stringContaining('https://bid360.example/api/unsubscribe?token=token_1'),
    }))
    expect(results).toMatchObject({
      digestsSent: 1,
      emailsAttempted: 1,
      emailsSent: 1,
      subscriberDigestsDelivered: [
        {
          subscriberId: 'sub_1',
          email: 'builder@example.com',
          sector: 'construction',
          tendersCount: 1,
        },
      ],
    })
  })

  it('summarizes subscriber digest visibility from the match map', () => {
    const visibility = buildSubscriberDigestDeliveryVisibility({
      sourceRun: { id: 89 },
      results: buildResults(),
    })

    expect(visibility).toMatchObject({
      sourceRunId: 89,
      subscriberDigestGroups: 1,
      subscriberTenderMatches: 1,
      sendAttemptsExpected: 1,
      groups: [
        {
          subscriberId: 'sub_1',
          email: 'builder@example.com',
          sector: 'construction',
          sectorLabel: 'Construction',
          tendersCount: 1,
          unsubscribeTokenPresent: true,
        },
      ],
    })
  })

  it('keeps run status completed when subscriber email delivery fails', async () => {
    mockSendEmail.mockRejectedValue(new Error('Mail service unavailable'))
    const db = createFinalizerDb()

    await completeSuccessfulRun({
      db,
      diagnostics: new DiagnosticsCollector(),
      sourceRun: { id: 300 },
      results: buildResults(),
      tendersProcessedCount: 1,
      skippedForResume: 0,
      deliverDigests: deliverDigestNotifications,
      notificationArgs: {
        sourceRun: {
          id: 300,
          startedAt: new Date('2026-07-23T08:00:00.000Z'),
        },
        results: buildResults(),
        crawlerLogger: { crawler: jest.fn() },
      },
      logger: { crawler: jest.fn() },
    })

    expect(db.updates[0]).toMatchObject({
      runStatus: RUN_STATUSES.COMPLETED,
      notificationError: 'Mail service unavailable',
      notificationSentAt: null,
    })
  })

  it('records subscriber opportunity deliveries after a successful email', async () => {
    mockSendEmail.mockResolvedValue({ data: { id: 'email_1' } })
    const createMany = jest.fn(async ({ data }) => ({ count: data.length }))
    const results = buildResults()

    await deliverDigestNotifications({
      sourceRun: {
        id: 91,
        startedAt: new Date('2026-07-28T08:00:00.000Z'),
      },
      results,
      crawlerLogger: { crawler: jest.fn() },
      db: {
        subscriberTenderDelivery: {
          createMany,
        },
      },
    })

    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          subscriberId: 'sub_1',
          opportunityId: 101,
          sourceRunId: 91,
        },
      ],
      skipDuplicates: true,
    })
  })

  it('adds stored undelivered subscriber matches to the digest before sending', async () => {
    mockSendEmail.mockResolvedValue({ data: { id: 'email_1' } })
    const createMany = jest.fn(async ({ data }) => ({ count: data.length }))
    const results = buildResults(new Map())

    await deliverDigestNotifications({
      sourceRun: {
        id: 92,
        startedAt: new Date('2026-07-29T08:00:00.000Z'),
      },
      results,
      crawlerLogger: { crawler: jest.fn() },
      db: {
        subscriber: {
          findMany: jest.fn(async () => [
            {
              id: 'sub_legal',
              email: 'legal@example.com',
              entityName: 'Legal Co',
              sector: 'legal',
              keywords: 'Attorneys',
              location: null,
              unsubscribeToken: 'token_legal',
              createdAt: new Date('2026-07-24T11:54:46.268Z'),
            },
          ]),
        },
        opportunity: {
          findMany: jest.fn(async () => [
            {
              id: 202,
              title: 'Appointment of a panel of legal service providers',
              reference: 'LEGAL/2026',
              entity: 'Provincial Treasury',
              category: 'Legal and accounting activities',
              sourceUrl: 'https://www.etenders.gov.za/Home/opportunities?id=1',
              summary: 'Interested law firms must provide litigation support.',
              publishedAt: new Date('2026-07-24T00:00:00.000Z'),
              deadline: new Date('2026-08-13T11:00:00.000Z'),
              createdAt: new Date('2026-07-25T04:56:36.000Z'),
            },
          ]),
        },
        subscriberTenderDelivery: {
          findMany: jest.fn(async () => []),
          createMany,
        },
      },
    })

    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'legal@example.com',
      html: expect.stringContaining('Appointment of a panel of legal service providers'),
    }))
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({
          subscriberId: 'sub_legal',
          opportunityId: 202,
          sourceRunId: 92,
        }),
      ],
    }))
    expect(results.subscriberMatchStats.storedSubscriberTenderMatchesQueued).toBe(1)
  })

  it('does not exclude stored sector matches when subscriber keywords use different wording', async () => {
    mockSendEmail.mockResolvedValue({ data: { id: 'email_1' } })
    const results = buildResults(new Map())

    await deliverDigestNotifications({
      sourceRun: {
        id: 93,
        startedAt: new Date('2026-07-30T08:00:00.000Z'),
      },
      results,
      crawlerLogger: { crawler: jest.fn() },
      db: {
        subscriber: {
          findMany: jest.fn(async () => [
            {
              id: 'sub_energy',
              email: 'energy@example.com',
              entityName: 'Energy Co',
              sector: 'energy',
              keywords: 'battery storage',
              location: null,
              unsubscribeToken: 'token_energy',
              createdAt: new Date('2026-07-24T11:54:46.268Z'),
            },
          ]),
        },
        opportunity: {
          findMany: jest.fn(async () => [
            {
              id: 303,
              title: 'Solar panel installation',
              reference: 'ENERGY/2026',
              entity: 'Municipality',
              category: 'Renewable energy',
              sourceUrl: 'https://www.etenders.gov.za/Home/opportunities?id=1',
              summary: 'Renewable electricity project.',
              publishedAt: new Date('2026-07-29T00:00:00.000Z'),
              deadline: new Date('2026-08-29T11:00:00.000Z'),
              createdAt: new Date('2026-07-30T04:56:36.000Z'),
            },
          ]),
        },
        subscriberTenderDelivery: {
          findMany: jest.fn(async () => []),
          createMany: jest.fn(async ({ data }) => ({ count: data.length })),
        },
      },
    })

    expect(mockSendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'energy@example.com',
      html: expect.stringContaining('Solar panel installation'),
    }))
  })
})
