import { RUN_STATUSES } from '@/lib/run-state'
import { runCrawlerOrchestration } from './orchestrator'
import { processTenderForOrganizations } from './tender-processing'
import { fetchETendersPage, getPDFLinksFromTender, getTenderDetails } from './etenders-crawler'
import { validateAndStoreSourceFingerprint } from './source-fingerprint'

jest.mock('@/lib/activity', () => ({
  logActivity: jest.fn(),
}))

jest.mock('./etenders-crawler', () => ({
  fetchETendersPage: jest.fn(),
  fetchETendersStructureHtml: jest.fn(async () => '<body><table></table></body>'),
  getTenderDetails: jest.fn(),
  getPDFLinksFromTender: jest.fn(),
  downloadPDF: jest.fn(),
}))

jest.mock('./source-fingerprint', () => ({
  validateAndStoreSourceFingerprint: jest.fn(),
}))

jest.mock('./run-diff', () => ({
  createTenderSnapshot: jest.fn(tender => ({ reference: tender.reference, hash: tender.title })),
  buildRunDiffMetrics: jest.fn(async () => ({
    runDiff: { previousTenderCount: 0, currentTenderCount: 1 },
    tenderReferences: ['BID-ROAD/2026'],
    tenderHashes: { 'BID-ROAD/2026': 'hash' },
  })),
}))

function pageBatch() {
  return {
    pageNumber: 1,
    pageSize: 100,
    totalRecords: 1,
    totalPages: 1,
    rowCount: 1,
    isLastPage: true,
    tenders: [
      {
        reference: 'BID-ROAD/2026',
        title: 'Road construction tender',
        description: 'Construction of a municipal access road and bridge.',
        deadline: '2026-08-30T00:00:00.000Z',
        category: 'Infrastructure',
        url: 'https://www.etenders.gov.za/Home/opportunities?id=road',
        raw: {
          tender_No: 'BID-ROAD/2026',
        },
      },
    ],
  }
}

function createDb() {
  const sourceRuns = []
  const updates = []
  const opportunities = new Map()
  let nextOpportunityId = 500

  const db = {
    updates,
    $executeRawUnsafe: jest.fn(async () => 1),
    $transaction: jest.fn(callback => callback(db)),
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
          name: 'Bid360 Storage',
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
          id: 200,
          startedAt: new Date('2026-07-23T08:00:00.000Z'),
          ...data,
        }
        sourceRuns.push(run)
        return run
      }),
      findUnique: jest.fn(async ({ where }) => sourceRuns.find(run => run.id === where.id) || null),
      update: jest.fn(async ({ where, data }) => {
        const run = sourceRuns.find(item => item.id === where.id)
        Object.assign(run, data)
        updates.push({ id: run.id, ...data })
        return run
      }),
    },
    deadLetter: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async ({ data }) => ({ id: 1, ...data })),
      update: jest.fn(async ({ data }) => ({ id: 1, ...data })),
    },
    opportunity: {
      findUnique: jest.fn(async ({ where }) => {
        const key = JSON.stringify(where.organizationId_dedupeKey)
        const opportunity = opportunities.get(key)
        if (!opportunity) return null

        return {
          id: opportunity.id,
          status: opportunity.status,
          notes: opportunity.notes,
          _count: { documents: 0 },
        }
      }),
      upsert: jest.fn(async ({ where, create, update }) => {
        const key = JSON.stringify(where.organizationId_dedupeKey)
        const existing = opportunities.get(key)

        if (existing) {
          const updated = {
            ...existing,
            ...update,
            updatedAt: new Date('2026-07-23T08:10:00.000Z'),
          }
          opportunities.set(key, updated)
          return updated
        }

        const createdAt = new Date('2026-07-23T08:00:00.000Z')
        const created = {
          ...create,
          id: nextOpportunityId,
          createdAt,
          updatedAt: createdAt,
        }
        nextOpportunityId += 1
        opportunities.set(key, created)
        return created
      }),
    },
    opportunityDocument: {
      create: jest.fn(async ({ data }) => ({ id: 1, ...data })),
    },
    subscriber: {
      findMany: jest.fn(async ({ where }) => [
        {
          id: 'sub_construction',
          email: 'builder@example.com',
          entityName: 'Builder Co',
          sector: 'construction',
          keywords: null,
          location: null,
          unsubscribeToken: 'token_construction',
        },
      ].filter(subscriber =>
        subscriber.sector && where.sector.in.includes(subscriber.sector)
      )),
    },
  }

  return db
}

describe('subscriber crawl flow integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    fetchETendersPage.mockResolvedValue(pageBatch())
    getTenderDetails.mockResolvedValue({
      entity: 'Department of Roads',
      briefingDate: null,
      siteVisitDate: null,
      contactPerson: 'Procurement Office',
      contactEmail: 'procurement@example.gov.za',
    })
    getPDFLinksFromTender.mockResolvedValue([])
    validateAndStoreSourceFingerprint.mockResolvedValue({
      severity: 'none',
      changed: false,
      reasons: [],
    })
  })

  it('populates the subscriber match map and passes it to digest delivery during a mini crawl', async () => {
    const db = createDb()
    let capturedMatchMap = null
    const deliverDigests = jest.fn(async ({ subscriberMatchMap, results }) => {
      capturedMatchMap = subscriberMatchMap
      results.digestsSent += subscriberMatchMap.size
    })

    const result = await runCrawlerOrchestration({
      sourceConfig: {
        key: 'etenders-gov-za',
        name: 'eTenders.gov.za',
        type: 'portal',
        baseUrl: 'https://www.etenders.gov.za',
      },
      deadlineMs: 240_000,
      db,
      logger: { crawler: jest.fn() },
      processTender: processTenderForOrganizations,
      deliverDigests,
    })

    expect(result.status).toBe(200)
    expect(deliverDigests).toHaveBeenCalledTimes(1)
    expect(capturedMatchMap).toBeInstanceOf(Map)
    expect(capturedMatchMap.get('sub_construction')).toMatchObject({
      subscriber: {
        email: 'builder@example.com',
        sector: 'construction',
      },
      tenders: [
        {
          title: 'Road construction tender',
          entity: 'Department of Roads',
          subscriberSector: 'construction',
        },
      ],
    })
    expect(db.updates.find(update => update.runStatus === RUN_STATUSES.COMPLETED)).toMatchObject({
      notificationSentAt: expect.any(Date),
      notificationError: null,
      summary: expect.objectContaining({
        subscriberDigestGroups: 1,
      }),
    })
  })
})
