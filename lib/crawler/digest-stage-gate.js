import { getSectorsForEtendersCategory } from '@/lib/matching/source-category-sectors'
import { matchTenderToSectors } from '@/lib/matching/sector-matcher'
import { isValidSector } from '@/lib/sectors'

const DIGEST_AUDIT_FIELDS = [
  'title',
  'reference',
  'entity',
  'category',
]

const DIGEST_STAGE_GATE_SCOPE = 'all_subscriber_sectors'
const MAX_REMOVAL_SAMPLES = 25

function normalizeDraftString(value) {
  if (value === null || value === undefined) return ''

  return String(value).trim().replace(/\s+/g, ' ')
}

function getSubscriberSector(subscriber, tender) {
  return normalizeDraftString(subscriber?.sector || tender?.subscriberSector).toLowerCase()
}

function hasDraftEvidence(auditTender) {
  return DIGEST_AUDIT_FIELDS.some(field => Boolean(auditTender[field]))
}

function countReasons(items) {
  return items.reduce((counts, item) => {
    const reason = item.reason || 'unknown'
    counts[reason] = (counts[reason] || 0) + 1
    return counts
  }, {})
}

function buildRemovalSample({ subscriber, tender, audit }) {
  return {
    subscriberId: subscriber?.id || null,
    email: subscriber?.email || null,
    sector: audit.sector,
    tenderId: tender?.id || null,
    title: audit.auditTender.title,
    reference: audit.auditTender.reference,
    entity: audit.auditTender.entity,
    category: audit.auditTender.category,
    verifiedSectors: audit.verifiedSectors,
    categorySectors: audit.categorySectors,
    reason: audit.reason,
  }
}

export function buildDigestAuditTender(tender = {}) {
  return {
    title: normalizeDraftString(tender.title),
    reference: normalizeDraftString(tender.reference),
    entity: normalizeDraftString(tender.entity),
    category: normalizeDraftString(tender.category),
  }
}

export function auditDigestTenderForSubscriber({ subscriber = {}, tender = {} } = {}) {
  const sector = getSubscriberSector(subscriber, tender)
  if (!sector) {
    return {
      passed: false,
      reason: 'missing_subscriber_sector',
      sector: null,
      verifiedSectors: [],
      categorySectors: [],
      auditTender: buildDigestAuditTender(tender),
    }
  }

  const auditTender = buildDigestAuditTender(tender)
  if (!isValidSector(sector)) {
    return {
      passed: false,
      reason: 'unknown_subscriber_sector',
      sector,
      verifiedSectors: [],
      categorySectors: [],
      auditTender,
    }
  }

  if (!hasDraftEvidence(auditTender)) {
    return {
      passed: false,
      reason: 'missing_digest_tender_fields',
      sector,
      verifiedSectors: [],
      categorySectors: [],
      auditTender,
    }
  }

  const verifiedSectors = matchTenderToSectors(auditTender)
  const categorySectors = getSectorsForEtendersCategory(auditTender.category)
  const passed = verifiedSectors.includes(sector)

  return {
    passed,
    reason: passed
      ? 'sector_verified_from_digest_fields'
      : 'sector_not_verified_from_digest_fields',
    sector,
    verifiedSectors,
    categorySectors,
    auditTender,
  }
}

export function applyDigestStageGate({ subscriberMatchMap, results } = {}) {
  const matchMap = subscriberMatchMap || results?.subscriberMatchMap
  if (!(matchMap instanceof Map)) {
    const summary = {
      skipped: true,
      reason: 'subscriber_match_map_unavailable',
      reviewedDigestGroups: 0,
      digestGroupsAfterGate: 0,
      reviewedTenderMatches: 0,
      acceptedTenderMatches: 0,
      removedTenderMatches: 0,
      droppedDigestGroups: 0,
      gateScope: DIGEST_STAGE_GATE_SCOPE,
      auditFields: DIGEST_AUDIT_FIELDS,
      removalReasons: {},
      removalSamples: [],
    }

    if (results) {
      results.subscriberDigestStageGate = summary
    }

    return {
      summary,
      droppedGroups: [],
      rejectedTenders: [],
    }
  }

  const groups = Array.from(matchMap.values())
    .filter(group => group?.subscriber && Array.isArray(group.tenders))
  const rejectedTenders = []
  const droppedGroups = []
  let reviewedTenderMatches = 0
  let acceptedTenderMatches = 0

  for (const group of groups) {
    const originalTenders = group.tenders
    const acceptedTenders = []
    const rejectedInGroup = []

    for (const tender of originalTenders) {
      reviewedTenderMatches += 1
      const audit = auditDigestTenderForSubscriber({
        subscriber: group.subscriber,
        tender,
      })

      if (audit.passed) {
        acceptedTenderMatches += 1
        acceptedTenders.push(tender)
      } else {
        const removal = buildRemovalSample({
          subscriber: group.subscriber,
          tender,
          audit,
        })
        rejectedTenders.push(removal)
        rejectedInGroup.push(removal)
      }
    }

    group.tenders = acceptedTenders

    if (originalTenders.length > 0 && acceptedTenders.length === 0 && rejectedInGroup.length > 0) {
      droppedGroups.push({
        subscriber: group.subscriber,
        reviewedTenderMatches: originalTenders.length,
        removedTenderMatches: rejectedInGroup.length,
        removalReasons: countReasons(rejectedInGroup),
      })
    }
  }

  const digestGroupsAfterGate = groups.filter(group => group.tenders.length > 0).length
  const removedTenderMatches = rejectedTenders.length
  const summary = {
    skipped: false,
    reviewedDigestGroups: groups.length,
    digestGroupsAfterGate,
    reviewedTenderMatches,
    acceptedTenderMatches,
    removedTenderMatches,
    droppedDigestGroups: droppedGroups.length,
    gateScope: DIGEST_STAGE_GATE_SCOPE,
    auditFields: DIGEST_AUDIT_FIELDS,
    removalReasons: countReasons(rejectedTenders),
    removalSamples: rejectedTenders.slice(0, MAX_REMOVAL_SAMPLES),
  }

  if (results) {
    results.subscriberDigestGroups = digestGroupsAfterGate
    results.subscriberDigestStageGate = summary
    results.subscriberMatchStats ||= {}
    results.subscriberMatchStats.digestStageGateReviewed =
      (results.subscriberMatchStats.digestStageGateReviewed || 0) + reviewedTenderMatches
    results.subscriberMatchStats.digestStageGateAccepted =
      (results.subscriberMatchStats.digestStageGateAccepted || 0) + acceptedTenderMatches
    results.subscriberMatchStats.digestStageGateRemoved =
      (results.subscriberMatchStats.digestStageGateRemoved || 0) + removedTenderMatches
    results.subscriberMatchStats.digestStageGateDroppedGroups =
      (results.subscriberMatchStats.digestStageGateDroppedGroups || 0) + droppedGroups.length
  }

  return {
    summary,
    droppedGroups,
    rejectedTenders,
  }
}
