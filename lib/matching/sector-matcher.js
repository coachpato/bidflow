import { SECTORS } from '@/lib/sectors'
import { getTenderSearchText, includesKeyword } from '@/lib/matching/tender-text'

const LEGAL_EVIDENCE_TEXT_FIELDS = [
  'title',
  'description',
  'pdfText',
  'documentText',
]

const LEGAL_NESTED_TEXT_FIELDS = [
  'title',
  'description',
  'pdfText',
  'documentText',
]

const LEGAL_RAW_TEXT_FIELDS = [
  'description',
  'conditions',
  'requirement',
  'requirements',
  'scope',
]

function addTextPart(parts, value) {
  if (value === null || value === undefined) return

  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim()
    if (normalized) parts.push(normalized)
  }
}

function addObjectFields(parts, object, fields) {
  if (!object || typeof object !== 'object') return

  for (const field of fields) {
    addTextPart(parts, object[field])
  }
}

function addArrayObjectFields(parts, values, fields) {
  if (!Array.isArray(values)) return

  for (const value of values) {
    addObjectFields(parts, value, fields)
  }
}

export function getLegalTenderEvidenceText(tender = {}) {
  const parts = []

  addObjectFields(parts, tender, LEGAL_EVIDENCE_TEXT_FIELDS)
  addObjectFields(parts, tender.opportunity, LEGAL_NESTED_TEXT_FIELDS)
  addObjectFields(parts, tender.raw, LEGAL_RAW_TEXT_FIELDS)
  addArrayObjectFields(parts, tender.pdfAssets, ['text'])
  addArrayObjectFields(parts, tender.documents, ['text'])

  return parts.join(' ').toLowerCase()
}

const LEGAL_CONTEXT_RULES = [
  {
    label: 'panel of attorneys',
    pattern: /\bpanel\s+of\s+(attorneys?|law\s+firms?|lawyers?|advocates?|legal\s+practitioners?|legal\s+service\s+providers?|legal\s+services\s+providers?)\b/i,
  },
  {
    label: 'legal practitioner requested',
    pattern: /\b(appointment|appoint|appointed|appointing|bid|bidders?|proposal|provision|provide|providing|rendering|required|requires?|seeking|service\s+providers?|panel)\b.{0,140}\b(attorneys?|law\s+firms?|lawyers?|advocates?|legal\s+counsel|legal\s+practitioners?)\b/i,
  },
  {
    label: 'legal practitioner requested',
    pattern: /\b(attorneys?|law\s+firms?|lawyers?|advocates?|legal\s+counsel|legal\s+practitioners?)\b.{0,140}\b(services?|panel|appointment|appoint|appointed|provide|provision|advice|advisory|litigation|representation|opinions?)\b/i,
  },
  {
    label: 'legal service provider requested',
    pattern: /\b(appointment|appoint|appointed|appointing|bid|bidders?|proposal|provision|provide|providing|rendering|required|requires?|seeking|panel|service\s+providers?)\b.{0,140}\blegal\s+(services?|advice|advisory|consultants?|consultancy|opinions?|representation|practitioners?|counsel)\b/i,
  },
  {
    label: 'legal service provider requested',
    pattern: /\blegal\s+(services?|advice|advisory|consultants?|consultancy|opinions?|representation|practitioners?|counsel)\b.{0,140}\b(services?|service\s+providers?|panel|appointment|appoint|appointed|provide|provision|required|requires?|seeking)\b/i,
  },
  {
    label: 'LLB or admitted legal qualification',
    pattern: /\b(l\.?\s*l\.?\s*b\.?|llb|law\s+degree|admitted\s+attorneys?|admitted\s+advocates?|legal\s+qualification|legal\s+qualifications)\b/i,
  },
  {
    label: 'litigation or legal representation services',
    pattern: /\b(litigation|arbitration|dispute\s+resolution|conveyancing|prosecution|legal\s+representation|legal\s+opinions?)\b.{0,100}\b(services?|service\s+providers?|panel|appointment|appoint|provide|provision|representation|attorneys?|law\s+firms?|lawyers?|advocates?|legal\s+counsel)\b/i,
  },
  {
    label: 'litigation or legal representation services',
    pattern: /\b(services?|service\s+providers?|panel|appointment|appoint|provide|provision|representation|attorneys?|law\s+firms?|lawyers?|advocates?|legal\s+counsel)\b.{0,100}\b(litigation|arbitration|dispute\s+resolution|conveyancing|prosecution|legal\s+representation|legal\s+opinions?)\b/i,
  },
  {
    label: 'specialist law services',
    pattern: /\b(commercial|contract|labour|employment|administrative|constitutional|property|regulatory)\s+law\b.{0,100}\b(services?|advice|advisory|representation|opinions?|attorneys?|law\s+firms?|lawyers?|advocates?|legal\s+counsel)\b/i,
  },
  {
    label: 'specialist law services',
    pattern: /\b(services?|advice|advisory|representation|opinions?|attorneys?|law\s+firms?|lawyers?|advocates?|legal\s+counsel)\b.{0,100}\b(commercial|contract|labour|employment|administrative|constitutional|property|regulatory)\s+law\b/i,
  },
  {
    label: 'debt collection',
    pattern: /\bdebt\s+(collection|collector|collectors|recovery|recoveries|management)\b|\bdebt\s+collectors?\b/i,
  },
  {
    label: 'collection of outstanding debt',
    pattern: /\b(collection|recovery)\s+of\s+(outstanding|arrear|arrears)\s+(accounts?|amounts?|debt|tv\s+licen[cs]es)\b/i,
  },
  {
    label: 'collection of outstanding debt',
    pattern: /\b(outstanding|arrear|arrears)\s+(accounts?|amounts?|debt|tv\s+licen[cs]es)\b.{0,120}\b(collection|recovery|recoveries)\b/i,
  },
  {
    label: 'credit-control collection services',
    pattern: /\bcredit[-\s]?control\b.{0,80}\b(collection|debt\s+recovery|recoveries)\b/i,
  },
  {
    label: 'tracing and recovery',
    pattern: /\btracing\b.{0,80}\b(debt|recovery|recoveries|arrears?|outstanding\s+accounts?)\b/i,
  },
  {
    label: 'tracing and recovery',
    pattern: /\b(debt|recovery|recoveries|arrears?|outstanding\s+accounts?)\b.{0,80}\btracing\b/i,
  },
]

export function getLegalTenderMatchDetails(tender = {}) {
  const tenderText = getLegalTenderEvidenceText(tender)
  const matchedLegalSignals = LEGAL_CONTEXT_RULES
    .filter(rule => rule.pattern.test(tenderText))
    .map(rule => rule.label)

  return {
    isLegal: matchedLegalSignals.length > 0,
    matchedLegalSignals: Array.from(new Set(matchedLegalSignals)),
  }
}

export function matchTenderToSectors(tender = {}) {
  const tenderText = getTenderSearchText(tender)
  const legalMatchDetails = getLegalTenderMatchDetails(tender)
  if (!tenderText && !legalMatchDetails.isLegal) return []

  return SECTORS
    .filter(sector => {
      if (sector.value === 'legal') {
        return legalMatchDetails.isLegal
      }

      return sector.keywords.some(keyword => includesKeyword(tenderText, keyword))
    })
    .map(sector => sector.value)
}
