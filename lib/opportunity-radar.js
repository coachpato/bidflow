import {
  getDefaultPracticeAreaForSector,
  getRelevantKeywordsForSector,
  identifyPracticeAreaForSector,
} from '@/lib/crawler/keyword-matcher'
import {
  SOUTH_AFRICA_PROVINCES,
  getDefaultPracticeAreasForSector,
  getServiceSectorLabel,
  normalizeServiceSector,
} from '@/lib/service-sectors'

export const OPPORTUNITY_STATUSES = ['New', 'Watch', 'Pursue', 'Ignore', 'Converted']

export const ACTIVE_OPPORTUNITY_STATUSES = ['New', 'Watch', 'Pursue']

const LEGACY_STATUS_MAP = {
  Reviewing: 'Watch',
  Skipped: 'Ignore',
}

function normalizeText(value) {
  return value
    ?.toString()
    .trim()
    .toLowerCase() || ''
}

function normalizeList(values) {
  if (!Array.isArray(values)) return []
  return values.map(item => item?.trim()).filter(Boolean)
}

function buildNeedleVariants(value) {
  const normalized = normalizeText(value)
  if (!normalized) return []

  const variants = new Set([normalized])

  if (normalized.endsWith('s')) {
    variants.add(normalized.slice(0, -1))
  }

  if (normalized.includes('ies')) {
    variants.add(normalized.replace(/ies\b/g, 'y'))
  }

  return [...variants].filter(Boolean)
}

function includesAnyValue(haystack, needles) {
  const normalizedHaystack = normalizeText(haystack)

  return normalizeList(needles).find(item =>
    buildNeedleVariants(item).some(variant => normalizedHaystack.includes(variant))
  ) || null
}

function detectProvince(text) {
  const normalized = normalizeText(text)
  if (!normalized) return null

  return SOUTH_AFRICA_PROVINCES.find(province => normalized.includes(province.toLowerCase())) || null
}

function formatMatchReason(reason) {
  return reason.endsWith('.') ? reason : `${reason}.`
}

export function normalizeOpportunityStatus(status, fallback = 'New') {
  const normalized = LEGACY_STATUS_MAP[status] || status
  return OPPORTUNITY_STATUSES.includes(normalized) ? normalized : fallback
}

export function getOpportunityStatusOptions(includeConverted = false) {
  return includeConverted
    ? OPPORTUNITY_STATUSES
    : OPPORTUNITY_STATUSES.filter(status => status !== 'Converted')
}

export function buildOpportunityDedupeKey({
  organizationId,
  sourceKey,
  externalId,
  title,
  entity,
  deadline,
}) {
  const deadlineKey = deadline
    ? new Date(deadline).toISOString().slice(0, 10)
    : 'no-deadline'

  const baseParts = [
    organizationId,
    sourceKey || 'manual',
    externalId || title || 'untitled',
    entity || 'unknown-entity',
    deadlineKey,
  ]

  return baseParts
    .map(part => normalizeText(part).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'na')
    .join(':')
}

export function getMatchVerdict(score) {
  if (score >= 80) return 'Strong match'
  if (score >= 60) return 'Relevant'
  if (score >= 40) return 'Needs review'
  return 'Weak match'
}

export function getRecommendedOpportunityStatus(score) {
  if (score >= 75) return 'Pursue'
  if (score >= 45) return 'Watch'
  return 'Ignore'
}

export function summarizeMatchReasons(reasons) {
  return normalizeList(reasons).slice(0, 2).join(' ')
}

export function buildManualMatchData({
  title,
  entity,
  practiceArea,
  fitScore,
  serviceSector,
}) {
  const score = Number.isFinite(fitScore) ? fitScore : null
  const normalizedSector = normalizeServiceSector(serviceSector) || 'LEGAL'
  const defaultPracticeArea = getDefaultPracticeAreasForSector(normalizedSector)[0]
    || getDefaultPracticeAreaForSector(normalizedSector)
    || 'General Services'
  const reasons = [
    `Captured manually for ${entity || 'internal review'}`,
    practiceArea ? `Practice area tagged as ${practiceArea}` : null,
  ].filter(Boolean)

  return {
    fitScore: score,
    verdict: score == null ? 'Manual intake' : getMatchVerdict(score),
    matchedKeywords: [],
    matchReasons: reasons,
    practiceArea: practiceArea || defaultPracticeArea,
  }
}

export function evaluateOpportunityMatch({
  firmProfile,
  tender,
  tenderDetails,
  tenderAnalysis,
}) {
  const serviceSector = normalizeServiceSector(firmProfile?.serviceSector) || 'LEGAL'
  const serviceSectorLabel = getServiceSectorLabel(serviceSector)
  const matchedKeywords = getRelevantKeywordsForSector(serviceSector, tenderAnalysis.matchedKeywords || [], 6)
  const practiceArea = identifyPracticeAreaForSector(serviceSector, matchedKeywords)
  const reasons = []
  let score = Math.round(tenderAnalysis.score || 0)

  if (!tenderAnalysis.isSectorOpportunity) {
    return {
      isMatch: false,
      fitScore: score,
      verdict: 'Weak match',
      matchedKeywords,
      practiceArea,
      recommendedStatus: 'Ignore',
      matchReasons: [`No ${serviceSectorLabel.toLowerCase()} indicators were detected in the source material.`],
      province: detectProvince([tender.title, tender.description, tenderDetails.entity].join(' ')),
    }
  }

  if (matchedKeywords.length > 0) {
    reasons.push(`${serviceSectorLabel} signals found: ${matchedKeywords.join(', ')}`)
  }

  if (practiceArea) {
    reasons.push(`Mapped to ${practiceArea} work`)
  }

  const preferredEntity = includesAnyValue(
    `${tenderDetails.entity || ''} ${tender.entity || ''} ${tender.title || ''}`,
    firmProfile?.preferredEntities
  )

  if (preferredEntity) {
    score += 15
    reasons.push(`Matches preferred entity focus: ${preferredEntity}`)
  }

  const matchedPracticeArea = includesAnyValue(
    `${practiceArea} ${tender.title || ''} ${tender.description || ''}`,
    firmProfile?.practiceAreas
  )

  if (matchedPracticeArea) {
    score += 10
    reasons.push(`Aligned with firm practice area: ${matchedPracticeArea}`)
  }

  const matchedWorkType = includesAnyValue(
    `${tender.title || ''} ${tender.description || ''} ${practiceArea}`,
    firmProfile?.targetWorkTypes
  )

  if (matchedWorkType) {
    score += 8
    reasons.push(`Matches target work type: ${matchedWorkType}`)
  }

  const detectedProvince = detectProvince(
    [tender.title, tender.description, tenderDetails.entity, tender.entity].filter(Boolean).join(' ')
  )

  const matchedProvince = normalizeList(firmProfile?.targetProvinces).find(
    province => normalizeText(province) === normalizeText(detectedProvince)
  )

  if (detectedProvince && matchedProvince) {
    score += 7
    reasons.push(`Falls inside target province: ${detectedProvince}`)
  }

  score = Math.max(0, Math.min(100, score))

  if (reasons.length === 0) {
    reasons.push(`${serviceSectorLabel} indicators suggest this opportunity is relevant for review`)
  }

  const fitScore = Math.round(score)

  return {
    isMatch: fitScore >= 40,
    fitScore,
    verdict: getMatchVerdict(fitScore),
    matchedKeywords,
    practiceArea,
    recommendedStatus: getRecommendedOpportunityStatus(fitScore),
    matchReasons: reasons.map(formatMatchReason),
    province: detectedProvince,
  }
}
