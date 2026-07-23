import * as keywordMatcher from '../crawler/keyword-matcher'
import * as opportunityRadar from '../opportunity-radar'

const analyzeTender = keywordMatcher['analyzeTenderFor' + 'Sector']
const evaluateMatch = opportunityRadar['evaluateOpportunity' + 'Match']

describe('Sector-aware opportunity radar reference behavior', () => {
  it('detects accounting opportunities without treating them as legal by default', () => {
    const title = 'Panel of auditors for external audit support and asset verification'

    const accountingAnalysis = analyzeTender('ACCOUNTING', title, '')
    const legalAnalysis = analyzeTender('LEGAL', title, '')

    expect(accountingAnalysis.isSectorOpportunity).toBe(true)
    expect(accountingAnalysis.matchCount).toBeGreaterThan(0)
    expect(legalAnalysis.isSectorOpportunity).toBe(false)
  })

  it('does not fall back to legal matching when no sector is configured', () => {
    const analysis = analyzeTender(null, 'Panel of attorneys for legal services', '')

    expect(analysis.sector).toBeNull()
    expect(analysis.isSectorOpportunity).toBe(false)
    expect(analysis.matchedKeywords).toEqual([])
  })

  it('matches accounting keywords as whole words instead of substrings', () => {
    const analysis = analyzeTender('ACCOUNTING', 'RFQJW091TN26 - AUDITORIUM UPGRADE', '')

    expect(analysis.isSectorOpportunity).toBe(false)
    expect(analysis.matchedKeywords).toEqual([])
  })

  it('does not treat legal-only generated match text as a financial services signal', () => {
    const analysis = analyzeTender(
      'FINANCIAL_SERVICES',
      'Panel of attorneys to provide legal services',
      'Legal Services opportunity. Legal Services signals found: legal, attorney, attorneys. Matched keywords: legal, attorney, attorneys.'
    )

    expect(analysis.isSectorOpportunity).toBe(false)
  })

  it('maps built-environment keywords to a built-environment practice area', () => {
    const title = 'Civil engineering design and contract administration for municipal roads programme'
    const analysis = analyzeTender('BUILT_ENVIRONMENT', title, '')

    expect(analysis.isSectorOpportunity).toBe(true)
    expect(
      keywordMatcher.identifyPracticeAreaForSector('BUILT_ENVIRONMENT', analysis.matchedKeywords)
    ).toBe('Civil engineering')
  })

  it('uses sector defaults for manually captured opportunities', () => {
    const accountingManual = opportunityRadar.buildManualMatchData({
      title: 'Manual accounting opportunity',
      entity: 'National Treasury',
      fitScore: null,
      serviceSector: 'ACCOUNTING',
    })

    const legalManual = opportunityRadar.buildManualMatchData({
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
    const tenderAnalysis = analyzeTender(
      'ACCOUNTING',
      tender.title,
      tender.description
    )

    const match = evaluateMatch({
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
