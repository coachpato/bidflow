import {
  analyzeTenderForSector,
  identifyPracticeAreaForSector,
} from '../crawler/keyword-matcher'
import {
  buildManualMatchData,
  evaluateOpportunityMatch,
} from '../opportunity-radar'

describe('Sector-aware opportunity radar', () => {
  it('detects accounting opportunities without treating them as legal by default', () => {
    const title = 'Panel of auditors for external audit support and asset verification'

    const accountingAnalysis = analyzeTenderForSector('ACCOUNTING', title, '')
    const legalAnalysis = analyzeTenderForSector('LEGAL', title, '')

    expect(accountingAnalysis.isSectorOpportunity).toBe(true)
    expect(accountingAnalysis.matchCount).toBeGreaterThan(0)
    expect(legalAnalysis.isSectorOpportunity).toBe(false)
  })

  it('maps built-environment keywords to a built-environment practice area', () => {
    const title = 'Civil engineering design and contract administration for municipal roads programme'
    const analysis = analyzeTenderForSector('BUILT_ENVIRONMENT', title, '')

    expect(analysis.isSectorOpportunity).toBe(true)
    expect(
      identifyPracticeAreaForSector('BUILT_ENVIRONMENT', analysis.matchedKeywords)
    ).toBe('Civil engineering')
  })

  it('uses sector defaults for manually captured opportunities', () => {
    const accountingManual = buildManualMatchData({
      title: 'Manual accounting opportunity',
      entity: 'National Treasury',
      fitScore: null,
      serviceSector: 'ACCOUNTING',
    })

    const legalManual = buildManualMatchData({
      title: 'Manual legal opportunity',
      entity: 'City of Johannesburg',
      fitScore: null,
      serviceSector: 'LEGAL',
    })

    expect(accountingManual.practiceArea).toBe('Accounting Services')
    expect(legalManual.practiceArea).toBe('Legal Services')
  })

  it('boosts matches using the firm profile answers collected at signup', () => {
    const tender = {
      title: 'Audit panel for public entities in Gauteng',
      description: 'External audit and forensic investigation services',
      entity: 'National Treasury',
    }
    const tenderDetails = {
      entity: 'National Treasury',
    }
    const tenderAnalysis = analyzeTenderForSector(
      'ACCOUNTING',
      tender.title,
      tender.description
    )

    const match = evaluateOpportunityMatch({
      firmProfile: {
        serviceSector: 'ACCOUNTING',
        preferredEntities: ['National Treasury'],
        practiceAreas: ['External audit', 'Forensic accounting'],
        targetWorkTypes: ['Audit panels', 'Forensic investigations'],
        targetProvinces: ['Gauteng'],
      },
      tender,
      tenderDetails,
      tenderAnalysis,
    })

    expect(match.isMatch).toBe(true)
    expect(match.fitScore).toBeGreaterThanOrEqual(40)
    expect(match.practiceArea).toBe('External audit')
    expect(match.matchReasons.join(' ')).toContain('preferred entity focus')
    expect(match.matchReasons.join(' ')).toContain('target work type')
  })
})
