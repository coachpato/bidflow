import { SECTORS } from '@/lib/sectors'
import {
  applyDigestStageGate,
  auditDigestTenderForSubscriber,
} from './digest-stage-gate'

const VALID_DRAFT_TENDERS_BY_SECTOR = {
  agriculture: {
    title: 'Supply of agricultural irrigation equipment',
    category: 'Agriculture, forestry and fishing',
  },
  construction: {
    title: 'Road construction and bridge repair',
    category: 'Civil engineering',
  },
  education: {
    title: 'Accredited training services for municipal staff',
    category: 'Education',
  },
  energy: {
    title: 'Solar electricity generator installation',
    category: 'Services: Electrical',
  },
  finance: {
    title: 'External audit and accounting services',
    category: 'Accounting, bookkeeping and auditing activities; tax consultancy',
  },
  healthcare: {
    title: 'Supply and delivery of medical laboratory consumables',
    category: 'Supplies: Medical',
  },
  'it-technology': {
    title: 'Provision of software and network server support',
    category: 'Computer programming, consultancy and related activities',
  },
  legal: {
    title: 'Appointment of a panel of legal service providers',
    category: 'Legal and accounting activities',
  },
  manufacturing: {
    title: 'Manufacture of industrial machinery',
    category: 'Manufacture of machinery and equipment n.e.c.',
  },
  mining: {
    title: 'Quarry drilling and mineral extraction services',
    category: 'Mining and quarrying',
  },
  'professional-services': {
    title: 'Management consulting and advisory services',
    category: 'Services: Professional',
  },
  security: {
    title: 'Provision of security guarding and surveillance services',
    category: 'Security and investigation activities',
  },
  telecommunications: {
    title: 'Broadband fiber telecommunications services',
    category: 'Telecommunications',
  },
  tourism: {
    title: 'Travel management and conference hospitality services',
    category: 'Travel agency, tour operator, reservation service and related activities',
  },
  'transport-logistics': {
    title: 'Fleet logistics and freight transport services',
    category: 'Transportation and storage',
  },
  'water-sanitation': {
    title: 'Water sanitation pipeline treatment works',
    category: 'Water supply; sewerage, waste management and remediation activities',
  },
}

function buildSubscriber(sector) {
  return {
    id: `sub_${sector}`,
    email: `${sector}@example.com`,
    entityName: `${sector} subscriber`,
    sector,
  }
}

function buildUnrelatedDraftTender(sector) {
  return {
    id: `stale_${sector}`,
    title: 'Supply and delivery of office furniture',
    reference: 'GEN/2026',
    entity: 'Municipality',
    category: 'General goods',
    matchedSectors: [sector],
  }
}

describe('digest stage gate', () => {
  it.each(SECTORS)('re-verifies %s digest cards from draft fields only', sector => {
    const subscriber = buildSubscriber(sector.value)
    const validTender = {
      id: `valid_${sector.value}`,
      reference: 'VALID/2026',
      entity: 'Municipality',
      matchedSectors: [],
      ...VALID_DRAFT_TENDERS_BY_SECTOR[sector.value],
    }
    const staleTender = buildUnrelatedDraftTender(sector.value)

    expect(auditDigestTenderForSubscriber({
      subscriber,
      tender: validTender,
    })).toMatchObject({
      passed: true,
      sector: sector.value,
      reason: 'sector_verified_from_digest_fields',
    })
    expect(auditDigestTenderForSubscriber({
      subscriber,
      tender: staleTender,
    })).toMatchObject({
      passed: false,
      sector: sector.value,
      reason: 'sector_not_verified_from_digest_fields',
    })
  })

  it('filters mixed subscriber groups across non-Legal sectors before delivery', () => {
    const matchMap = new Map([
      ['sub_construction', {
        subscriber: buildSubscriber('construction'),
        tenders: [
          {
            id: 1,
            reference: 'ROAD/2026',
            entity: 'Roads Department',
            matchedSectors: [],
            ...VALID_DRAFT_TENDERS_BY_SECTOR.construction,
          },
          buildUnrelatedDraftTender('construction'),
        ],
      }],
      ['sub_energy', {
        subscriber: buildSubscriber('energy'),
        tenders: [
          {
            id: 2,
            reference: 'SOLAR/2026',
            entity: 'Energy Department',
            matchedSectors: [],
            ...VALID_DRAFT_TENDERS_BY_SECTOR.energy,
          },
          buildUnrelatedDraftTender('energy'),
        ],
      }],
    ])
    const results = {
      subscriberMatchStats: {},
    }

    const gate = applyDigestStageGate({
      subscriberMatchMap: matchMap,
      results,
    })

    expect(matchMap.get('sub_construction').tenders.map(tender => tender.id)).toEqual([1])
    expect(matchMap.get('sub_energy').tenders.map(tender => tender.id)).toEqual([2])
    expect(gate.summary).toMatchObject({
      gateScope: 'all_subscriber_sectors',
      reviewedDigestGroups: 2,
      digestGroupsAfterGate: 2,
      reviewedTenderMatches: 4,
      acceptedTenderMatches: 2,
      removedTenderMatches: 2,
      droppedDigestGroups: 0,
    })
    expect(gate.rejectedTenders).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sector: 'construction',
        tenderId: 'stale_construction',
        reason: 'sector_not_verified_from_digest_fields',
      }),
      expect.objectContaining({
        sector: 'energy',
        tenderId: 'stale_energy',
        reason: 'sector_not_verified_from_digest_fields',
      }),
    ]))
    expect(results.subscriberMatchStats).toMatchObject({
      digestStageGateReviewed: 4,
      digestStageGateAccepted: 2,
      digestStageGateRemoved: 2,
    })
  })

  it('rejects unknown subscriber sectors', () => {
    expect(auditDigestTenderForSubscriber({
      subscriber: buildSubscriber('unknown-sector'),
      tender: {
        title: 'Supply and delivery of office furniture',
        category: 'General goods',
      },
    })).toMatchObject({
      passed: false,
      sector: 'unknown-sector',
      reason: 'unknown_subscriber_sector',
    })
  })
})
