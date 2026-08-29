import { upsertOpportunityForTender } from './tender-processing'

function makeTender(overrides = {}) {
  return {
    id: 777,
    sourceTenderId: '777',
    title: 'Panel of attorneys',
    reference: 'LEGAL/777/2026',
    description: 'Appointment of a panel of attorneys for legal services.',
    category: 'Legal services',
    advertised: '2026-08-01T00:00:00.000Z',
    deadline: '2026-09-01T12:00:00.000Z',
    sourceStatus: 'Open',
    sourceUrl: 'https://www.etenders.gov.za/Home/tenderDetails?ID=777',
    sourceDetailUrl: 'https://www.etenders.gov.za/Home/tenderDetails?ID=777',
    sourceFallbackUrl: 'https://www.etenders.gov.za/Home?myTab=1',
    ...overrides,
  }
}

function makeDb({ raceOnFirstInsert = false } = {}) {
  const records = new Map()
  const documents = new Map()
  let nextId = 1
  let firstInsert = true

  const db = {
    records,
    documents,
    opportunity: {
      findUnique: jest.fn(async ({ where }) => {
        if (where.sourceIdentityKey) return records.get(where.sourceIdentityKey) || null
        return null
      }),
      findFirst: jest.fn(async ({ where }) => Array.from(records.values()).find(record =>
        record.sourceId === where.sourceId && record.sourceTenderId === where.sourceTenderId
      ) || null),
      update: jest.fn(async ({ where, data }) => {
        const record = Array.from(records.values()).find(item => item.id === where.id)
        Object.assign(record, data, { updatedAt: new Date('2026-08-27T01:00:00.000Z') })
        return record
      }),
      upsert: jest.fn(async ({ where, create, update }) => {
        const existing = records.get(where.sourceIdentityKey)
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date('2026-08-27T01:00:00.000Z') })
          return existing
        }

        const created = {
          ...create,
          id: nextId++,
          createdAt: new Date('2026-08-27T00:00:00.000Z'),
          updatedAt: new Date('2026-08-27T00:00:00.000Z'),
        }
        records.set(where.sourceIdentityKey, created)

        if (raceOnFirstInsert && firstInsert) {
          firstInsert = false
          const error = new Error('Unique constraint')
          error.code = 'P2002'
          throw error
        }

        return created
      }),
    },
    opportunityDocument: {
      upsert: jest.fn(async ({ where, create, update }) => {
        const key = `${where.opportunityId_sourceDocumentId.opportunityId}:${where.opportunityId_sourceDocumentId.sourceDocumentId}`
        const existing = documents.get(key)
        if (existing) {
          Object.assign(existing, update)
          return existing
        }
        const created = { id: documents.size + 1, ...create }
        documents.set(key, created)
        return created
      }),
    },
  }

  return db
}

const baseArgs = {
  storageOrganization: { id: 12 },
  source: { id: 4, key: 'etenders-gov-za', name: 'eTenders.gov.za' },
  sourceRun: { id: 90 },
  tenderDetails: { entity: 'Nkangala TVET College', location: 'Mpumalanga' },
  pdfAssets: [],
  documentMetadata: [{
    name: 'Tender document.pdf',
    documentType: 'PDF',
    sourceUrl: 'https://www.etenders.gov.za/home/Download/?blobName=doc-777.pdf',
    sourceDocumentId: 'doc-777',
    extension: '.pdf',
  }],
}

describe('canonical tender upsert', () => {
  it('creates one record, then updates it when the same source tender changes', async () => {
    const db = makeDb()
    const first = await upsertOpportunityForTender({ ...baseArgs, tender: makeTender() }, db)
    const second = await upsertOpportunityForTender({
      ...baseArgs,
      tender: makeTender({ title: 'Panel of attorneys and counsel', description: 'Updated legal services scope.' }),
    }, db)

    expect(db.records.size).toBe(1)
    expect(first.opportunity.id).toBe(second.opportunity.id)
    expect(first.isNew).toBe(true)
    expect(second.isNew).toBe(false)
    expect(second.sourceContentChanged).toBe(true)
    expect(second.opportunity.title).toBe('Panel of attorneys and counsel')
    expect(db.documents.size).toBe(1)
  })

  it('resolves a unique-constraint race to the one inserted record', async () => {
    const db = makeDb({ raceOnFirstInsert: true })
    const result = await upsertOpportunityForTender({ ...baseArgs, tender: makeTender() }, db)

    expect(db.records.size).toBe(1)
    expect(result.opportunity.id).toBe(1)
    expect(result.isNew).toBe(false)
    expect(db.opportunity.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }))
  })
})
