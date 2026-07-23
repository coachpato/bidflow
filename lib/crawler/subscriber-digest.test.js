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
})
