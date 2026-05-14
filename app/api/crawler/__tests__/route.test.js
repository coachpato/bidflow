import { upsertOpportunityForOrganization } from '../route'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {},
}))

function createConcurrentOpportunityDb() {
  const opportunities = new Map()
  let findUniqueCalls = 0
  let releaseFindUnique
  const findUniqueBarrier = new Promise(resolve => {
    releaseFindUnique = resolve
  })
  const createdAt = new Date('2026-05-13T08:00:00.000Z')
  const updatedAt = new Date('2026-05-13T08:00:01.000Z')
  const createCount = { value: 0 }
  const updateCount = { value: 0 }

  return {
    opportunities,
    createCount,
    updateCount,
    db: {
      opportunity: {
        findUnique: jest.fn(async () => {
          findUniqueCalls += 1
          if (findUniqueCalls === 2) {
            releaseFindUnique()
          }
          await findUniqueBarrier
          return null
        }),
        upsert: jest.fn(async ({ where, create, update }) => {
          const key = JSON.stringify(where.organizationId_dedupeKey)
          const existing = opportunities.get(key)

          if (existing) {
            updateCount.value += 1
            const refreshed = {
              ...existing,
              ...update,
              updatedAt,
            }
            opportunities.set(key, refreshed)
            return refreshed
          }

          createCount.value += 1
          const created = {
            ...create,
            id: 1,
            createdAt,
            updatedAt: createdAt,
          }
          opportunities.set(key, created)
          return created
        }),
      },
      opportunityMatch: {
        upsert: jest.fn(async () => ({})),
      },
      opportunityDocument: {
        create: jest.fn(async () => ({})),
      },
    },
  }
}

function buildCrawlerWriteInput() {
  return {
    organization: {
      id: 10,
      name: 'Acme Legal',
      firmProfile: { serviceSector: 'LEGAL_SERVICES' },
    },
    source: {
      id: 20,
      key: 'etenders-gov-za',
      name: 'eTenders.gov.za',
    },
    sourceRun: {
      id: 30,
    },
    tender: {
      title: 'Panel of attorneys for litigation support',
      reference: 'BID-123/2026',
      description: 'Appointment of a panel of attorneys for legal services.',
      category: 'Legal Services',
      advertised: '2026-05-13T00:00:00.000Z',
      deadline: '2026-06-30T00:00:00.000Z',
      url: 'https://www.etenders.gov.za/Home/opportunities?id=1',
    },
    tenderDetails: {
      entity: 'Department of Public Works',
      briefingDate: null,
      siteVisitDate: null,
      contactPerson: 'Procurement Office',
      contactEmail: 'procurement@example.gov.za',
    },
    match: {
      practiceArea: 'Litigation and disputes',
      fitScore: 82,
      verdict: 'Strong match',
      matchedKeywords: ['panel of attorneys', 'litigation'],
      matchReasons: ['Legal services signals found.'],
      recommendedStatus: 'Pursue',
    },
    pdfAssets: [],
  }
}

describe('upsertOpportunityForOrganization', () => {
  it('uses atomic upsert so concurrent writes with the same dedupe key create one opportunity', async () => {
    const { db, opportunities, createCount, updateCount } = createConcurrentOpportunityDb()
    const input = buildCrawlerWriteInput()

    const [left, right] = await Promise.all([
      upsertOpportunityForOrganization(input, db),
      upsertOpportunityForOrganization(input, db),
    ])

    expect(opportunities.size).toBe(1)
    expect(createCount.value).toBe(1)
    expect(updateCount.value).toBe(1)
    expect(db.opportunity.upsert).toHaveBeenCalledTimes(2)
    expect(db.opportunityMatch.upsert).toHaveBeenCalledTimes(2)
    expect(db.opportunityDocument.create).not.toHaveBeenCalled()
    expect([left.isNew, right.isNew].sort()).toEqual([false, true])
  })

  it('does not overwrite manually updated opportunity status or notes on refresh', async () => {
    const input = buildCrawlerWriteInput()
    const db = {
      opportunity: {
        findUnique: jest.fn(async () => ({
          id: 1,
          status: 'Manual Review',
          notes: 'Human-authored note',
          _count: { documents: 1 },
        })),
        upsert: jest.fn(async ({ update }) => ({
          id: 1,
          ...update,
          status: 'Manual Review',
          notes: 'Human-authored note',
          createdAt: new Date('2026-05-13T08:00:00.000Z'),
          updatedAt: new Date('2026-05-13T08:10:00.000Z'),
        })),
      },
      opportunityMatch: {
        upsert: jest.fn(async () => ({})),
      },
      opportunityDocument: {
        create: jest.fn(async () => ({})),
      },
    }

    await upsertOpportunityForOrganization(input, db)

    const upsertArgs = db.opportunity.upsert.mock.calls[0][0]
    expect(upsertArgs.create).toHaveProperty('status', input.match.recommendedStatus)
    expect(upsertArgs.create).toHaveProperty('notes')
    expect(upsertArgs.update).not.toHaveProperty('status')
    expect(upsertArgs.update).not.toHaveProperty('notes')
    expect(db.opportunityDocument.create).not.toHaveBeenCalled()
  })
})
