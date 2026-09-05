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
    expect(mockSendEmail.mock.calls[0][0].html).not.toContain('https://www.etenders.gov.za/Home/opportunities?id=101')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('View opportunities on eTenders')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('src="https://bid360.example/logo.png"')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('Construction Sector Digest')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('1 New Tender Match Found')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('Reference Number')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('Municipality / Entity')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('Closing Date')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('View Opportunity')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('User Preferences')
    expect(mockSendEmail.mock.calls[0][0].text).toContain('https://www.etenders.gov.za/Home?myTab=1')
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
    expect(mockSendEmail.mock.calls[0][0].html).toContain('href="http://localhost:3000/tenders/202/appointment-of-a-panel-of-legal-service-providers"')
    expect(mockSendEmail.mock.calls[0][0].html).not.toContain('id=1')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('https://www.etenders.gov.za/Home?myTab=1')
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

  it('does not add irrelevant stored tenders to a Legal catch-up digest', async () => {
    mockSendEmail.mockResolvedValue({ data: { id: 'email_1' } })
    const createMany = jest.fn(async ({ data }) => ({ count: data.length }))
    const results = buildResults(new Map())

    await deliverDigestNotifications({
      sourceRun: {
        id: 95,
        startedAt: new Date('2026-08-29T08:00:00.000Z'),
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
              keywords: null,
              location: null,
              unsubscribeToken: 'token_legal',
              createdAt: new Date('2026-08-01T00:00:00.000Z'),
            },
          ]),
        },
        opportunity: {
          findMany: jest.fn(async () => [
            {
              id: 401,
              title: 'Manufacture, testing, supply and delivery of high voltage current limiting fuse-links',
              reference: '59G/2026/27',
              entity: 'City of Cape Town',
              category: 'Supplies: Electrical Equipment',
              sourceUrl: 'https://www.etenders.gov.za/Home/opportunities?id=1',
              summary: 'Electrical equipment supply.',
              publishedAt: new Date('2026-08-29T00:00:00.000Z'),
              deadline: new Date('2026-10-06T00:00:00.000Z'),
              createdAt: new Date('2026-08-29T04:00:00.000Z'),
            },
            {
              id: 402,
              title: 'Supply and delivery of cleaning materials and equipment',
              reference: 'CED 13/2026-2027',
              entity: 'Cederberg Municipality',
              category: 'Other service activities',
              sourceUrl: 'https://www.etenders.gov.za/Home/opportunities?id=1',
              summary: 'Cleaning materials and equipment.',
              publishedAt: new Date('2026-08-29T00:00:00.000Z'),
              deadline: new Date('2026-09-30T00:00:00.000Z'),
              createdAt: new Date('2026-08-29T04:00:00.000Z'),
            },
            {
              id: 403,
              title: 'Appointment of a service provider for fire station doors and door motors',
              reference: 'PS 08/2026',
              entity: 'Alfred Duma Local Municipality',
              category: 'Services: Functional (Including Cleaning and Security Services)',
              sourceUrl: 'https://www.etenders.gov.za/Home/opportunities?id=1',
              summary: 'Door maintenance and repairs.',
              publishedAt: new Date('2026-08-29T00:00:00.000Z'),
              deadline: new Date('2026-09-30T00:00:00.000Z'),
              createdAt: new Date('2026-08-29T04:00:00.000Z'),
            },
            {
              id: 404,
              title: 'Appointment of a panel of service providers to supply and deliver petroleum products',
              reference: 'DF 05/2026',
              entity: 'Alfred Duma Local Municipality',
              category: 'Manufacture of coke and refined petroleum products',
              sourceUrl: 'https://www.etenders.gov.za/Home/opportunities?id=1',
              summary: 'Fuel and petroleum products.',
              publishedAt: new Date('2026-08-29T00:00:00.000Z'),
              deadline: new Date('2026-10-01T00:00:00.000Z'),
              createdAt: new Date('2026-08-29T04:00:00.000Z'),
            },
            {
              id: 405,
              title: 'Panel of debt collectors for outstanding municipal accounts',
              reference: 'DEBT/2026',
              entity: 'Municipal Finance',
              category: 'Professional services',
              sourceUrl: 'https://www.etenders.gov.za/Home/opportunities?id=1',
              summary: 'Collection of outstanding debt and arrear accounts.',
              publishedAt: new Date('2026-08-29T00:00:00.000Z'),
              deadline: new Date('2026-10-15T00:00:00.000Z'),
              createdAt: new Date('2026-08-29T04:00:00.000Z'),
            },
          ]),
        },
        subscriberTenderDelivery: {
          findMany: jest.fn(async () => []),
          createMany,
        },
      },
    })

    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    const html = mockSendEmail.mock.calls[0][0].html

    expect(html).toContain('Panel of debt collectors for outstanding municipal accounts')
    expect(html).not.toContain('current limiting fuse-links')
    expect(html).not.toContain('cleaning materials and equipment')
    expect(html).not.toContain('fire station doors')
    expect(html).not.toContain('petroleum products')
    expect(html).toContain('href="http://localhost:3000/tenders/405/panel-of-debt-collectors-for-outstanding-municipal-accounts"')
    expect(html).not.toContain('id=1')
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({
          subscriberId: 'sub_legal',
          opportunityId: 405,
          sourceRunId: 95,
        }),
      ],
    }))
    expect(results.subscriberMatchStats.storedSubscriberTenderMatchesQueued).toBe(1)
  })

  it('links digest titles to the shared Bid360 tender page', async () => {
    mockSendEmail.mockResolvedValue({ data: { id: 'email_1' } })
    const detailUrl = 'https://www.etenders.gov.za/Home/tenderDetails?ID=166951'
    const results = buildResults(new Map([
      ['sub_legal', {
        subscriber: {
          id: 'sub_legal',
          email: 'legal@example.com',
          entityName: 'Legal Co',
          sector: 'legal',
          unsubscribeToken: 'token_legal',
        },
        tenders: [
          {
            id: 202,
            title: 'Appointment of a panel of legal service providers',
            reference: 'LEGAL/2026',
            entity: 'Provincial Treasury',
            category: 'Legal and accounting activities',
            sourceUrl: detailUrl,
            deadline: new Date('2026-08-13T11:00:00.000Z'),
          },
          {
            id: 203,
            title: 'Debt collection services for outstanding accounts',
            reference: 'DEBT/2026',
            entity: 'Municipal Finance',
            category: 'Professional services',
            sourceUrl: detailUrl,
            deadline: new Date('2026-08-15T11:00:00.000Z'),
          },
        ],
      }],
    ]))

    await deliverDigestNotifications({
      sourceRun: {
        id: 94,
        startedAt: new Date('2026-07-31T08:00:00.000Z'),
      },
      results,
      crawlerLogger: { crawler: jest.fn() },
    })

    expect(mockSendEmail.mock.calls[0][0].html).toContain('href="http://localhost:3000/tenders/202/appointment-of-a-panel-of-legal-service-providers"')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('href="http://localhost:3000/tenders/203/debt-collection-services-for-outstanding-accounts"')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('Appointment of a panel of legal service providers</a>')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('View opportunities on eTenders')
    expect(mockSendEmail.mock.calls[0][0].html).toContain('https://www.etenders.gov.za/Home?myTab=1')
    expect(mockSendEmail.mock.calls[0][0].text).not.toContain(detailUrl)
    expect(mockSendEmail.mock.calls[0][0].text).toContain('Source: View opportunities on eTenders - https://www.etenders.gov.za/Home?myTab=1')
  })

  it('removes Legal digest cards that fail draft-only sector verification before sending', async () => {
    mockSendEmail.mockResolvedValue({ data: { id: 'email_1' } })
    const createMany = jest.fn(async ({ data }) => ({ count: data.length }))
    const crawler = jest.fn()
    const results = buildResults(new Map([
      ['sub_legal', {
        subscriber: {
          id: 'sub_legal',
          email: 'legal@example.com',
          entityName: 'Legal Co',
          sector: 'legal',
          unsubscribeToken: 'token_legal',
        },
        tenders: [
          {
            id: 12439,
            title: 'The Appointment for the Labour Relations Panel Bid for a Period of Three Years',
            reference: 'ARC/67/03/2026/2',
            entity: 'Agricultural Research Council',
            category: 'Services: Professional',
            matchedSectors: ['legal'],
          },
          {
            id: 12718,
            title: 'The Appointment of a Multi-Disciplinary Team Consisting of a Lead Architectural Entity for Design and Supervision on Construction',
            reference: 'ARCH/2026',
            entity: 'Public Works',
            category: 'Architectural and engineering activities; technical testing and analysis',
            matchedSectors: ['legal'],
          },
          {
            id: 13369,
            title: 'Appointment of a Multi-Disciplinary Professional Company for the Integrated Infrastructure Upgrade',
            reference: 'INFRA/2026',
            entity: 'Department of Health',
            category: 'Services: Professional',
            matchedSectors: ['legal'],
          },
          {
            id: 15370,
            title: 'Appointment of a Panel of Service Providers for Legal Attorneys',
            reference: 'LEGAL/2026',
            entity: 'Municipality',
            category: 'Other service activities',
            matchedSectors: ['legal'],
          },
        ],
      }],
    ]))

    await deliverDigestNotifications({
      sourceRun: {
        id: 137,
        startedAt: new Date('2026-09-05T08:00:00.000Z'),
      },
      results,
      crawlerLogger: { crawler },
      db: {
        subscriberTenderDelivery: {
          createMany,
        },
      },
    })

    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    const email = mockSendEmail.mock.calls[0][0]

    expect(email.html).toContain('The Appointment for the Labour Relations Panel Bid')
    expect(email.html).toContain('Appointment of a Panel of Service Providers for Legal Attorneys')
    expect(email.html).not.toContain('Multi-Disciplinary Team Consisting of a Lead Architectural Entity')
    expect(email.html).not.toContain('Integrated Infrastructure Upgrade')
    expect(email.text).not.toContain('Integrated Infrastructure Upgrade')
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          subscriberId: 'sub_legal',
          opportunityId: 12439,
          sourceRunId: 137,
        },
        {
          subscriberId: 'sub_legal',
          opportunityId: 15370,
          sourceRunId: 137,
        },
      ],
      skipDuplicates: true,
    })
    expect(results.subscriberDigestStageGate).toMatchObject({
      reviewedDigestGroups: 1,
      digestGroupsAfterGate: 1,
      reviewedTenderMatches: 4,
      acceptedTenderMatches: 2,
      removedTenderMatches: 2,
      droppedDigestGroups: 0,
    })
    expect(results.subscriberMatchStats).toMatchObject({
      digestStageGateReviewed: 4,
      digestStageGateAccepted: 2,
      digestStageGateRemoved: 2,
      digestStageGateDroppedGroups: 0,
    })
    expect(crawler).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      message: 'crawler_subscriber_digest_stage_gate_completed',
      data: expect.objectContaining({
        sourceRunId: 137,
        removedTenderMatches: 2,
      }),
    }))
  })

  it('skips a subscriber digest when every draft card fails the stage gate', async () => {
    mockSendEmail.mockResolvedValue({ data: { id: 'email_1' } })
    const crawler = jest.fn()
    const results = buildResults(new Map([
      ['sub_legal', {
        subscriber: {
          id: 'sub_legal',
          email: 'legal@example.com',
          entityName: 'Legal Co',
          sector: 'legal',
          unsubscribeToken: 'token_legal',
        },
        tenders: [
          {
            id: 13369,
            title: 'Appointment of a Multi-Disciplinary Professional Company for the Integrated Infrastructure Upgrade',
            reference: 'INFRA/2026',
            entity: 'Department of Health',
            category: 'Services: Professional',
            matchedSectors: ['legal'],
          },
        ],
      }],
    ]))

    await deliverDigestNotifications({
      sourceRun: {
        id: 138,
        startedAt: new Date('2026-09-05T08:00:00.000Z'),
      },
      results,
      crawlerLogger: { crawler },
    })

    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(results).toMatchObject({
      digestsSent: 0,
      emailsAttempted: 0,
      emailsSent: 0,
      emailsSkipped: 0,
      subscriberDigestGroups: 0,
      subscriberDigestsDelivered: [],
    })
    expect(results.subscriberDigestStageGate).toMatchObject({
      reviewedDigestGroups: 1,
      digestGroupsAfterGate: 0,
      reviewedTenderMatches: 1,
      acceptedTenderMatches: 0,
      removedTenderMatches: 1,
      droppedDigestGroups: 1,
    })
    expect(crawler).toHaveBeenCalledWith(expect.objectContaining({
      level: 'warn',
      message: 'crawler_subscriber_digest_email_send_decision',
      data: expect.objectContaining({
        sourceRunId: 138,
        subscriberId: 'sub_legal',
        tendersCount: 0,
        skipStage: 'subscriber_digest_stage_gate',
        skipReason: 'no_verified_digest_tenders',
        sendSkipped: true,
      }),
    }))
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
