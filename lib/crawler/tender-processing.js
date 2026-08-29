import { logActivity } from '@/lib/activity'
import { expireCacheTags, publicTenderCacheTag } from '@/lib/cache-tags'
import { downloadPDF, getPDFLinksFromTender, getTenderDetails } from '@/lib/crawler/etenders-crawler'
import {
  ETENDERS_GENERAL_OPPORTUNITIES_URL,
  normalizeEtendersDigestUrl,
  normalizeEtendersSourceUrl,
} from '@/lib/crawler/etenders-links'
import {
  buildBid360TenderUrl,
  buildTenderSourceIdentityKey,
  computeTenderContentHash,
  getTenderSourceTenderId,
} from '@/lib/crawler/tender-identity'
import { extractTextFromPDF } from '@/lib/crawler/pdf-extractor'
import { classifyError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { matchTenderToSectors } from '@/lib/matching/sector-matcher'
import { matchSubscribersToTender } from '@/lib/matching/subscriber-matcher'
import prisma from '@/lib/prisma'
import { getSectorLabel } from '@/lib/sectors'
import { createSignedDocumentUrls, ensureStorageBucket, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

function toNullableDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeText(value) {
  return value
    ?.toString()
    .trim()
    .toLowerCase() || ''
}

function normalizeDedupePart(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'na'
}

function buildStorageDedupeKey({
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

  return [
    organizationId,
    sourceKey || 'manual',
    externalId || title || 'untitled',
    entity || 'unknown-entity',
    deadlineKey,
  ].map(normalizeDedupePart).join(':')
}

function summarizeMatchReasons(reasons) {
  if (!Array.isArray(reasons)) return ''

  return reasons
    .map(reason => String(reason || '').trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' ')
}

async function uploadPDFToSupabase(fileName, pdfBuffer, opportunityId) {
  try {
    await ensureStorageBucket()

    const supabase = getSupabaseAdmin()
    const filePath = `opportunities/${opportunityId}/${Date.now()}_${fileName.replace(/[^a-z0-9._-]/gi, '_')}`

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (error) {
      throw new Error(`Supabase upload error: ${error.message}`)
    }

    const { viewUrl } = await createSignedDocumentUrls(filePath)

    return {
      fileName,
      filePath: viewUrl,
      storagePath: filePath,
    }
  } catch (error) {
    const classifiedError = classifyError(error)
    logger.crawler({
      level: 'error',
      message: 'crawler_pdf_upload_failed',
      phase: 'processing',
      error: classifiedError,
      data: {
        opportunityId,
        fileName,
        errorType: classifiedError.type,
      },
    })
    return null
  }
}

function shouldArchiveTenderDocuments() {
  return process.env.CRAWLER_ARCHIVE_TENDER_DOCUMENTS === 'true'
}

function normalizeDocumentDate(value, fallback = null) {
  return toNullableDate(value) || fallback
}

function normalizeSourceDocumentMetadata({ tender, pdfLinks }) {
  const candidates = [
    ...(Array.isArray(tender.documentMetadata) ? tender.documentMetadata : []),
    ...pdfLinks.map(link => ({
      name: link.text || 'Tender document',
      documentType: 'PDF',
      sourceUrl: link.url,
      sourceDocumentId: link.sourceDocumentId || null,
      extension: '.pdf',
      fileSize: null,
      checksum: null,
      lastVerifiedAt: null,
      sourceMetadata: null,
    })),
  ]
  const seen = new Set()
  const documents = []

  for (const candidate of candidates) {
    const sourceUrl = normalizeEtendersSourceUrl(candidate.sourceUrl || candidate.url)
    const sourceDocumentId = String(candidate.sourceDocumentId || candidate.supportDocumentID || candidate.documentID || '').trim()
    const key = sourceDocumentId || sourceUrl || candidate.name

    if (!key || seen.has(key)) continue
    seen.add(key)

    documents.push({
      name: String(candidate.name || candidate.fileName || candidate.text || 'Tender document').trim() || 'Tender document',
      documentType: candidate.documentType || 'SOURCE',
      sourceUrl,
      sourceDocumentId: sourceDocumentId || null,
      extension: candidate.extension || null,
      fileSize: Number.isInteger(candidate.fileSize) ? candidate.fileSize : null,
      checksum: candidate.checksum || null,
      firstSeenAt: normalizeDocumentDate(candidate.firstSeenAt),
      lastVerifiedAt: normalizeDocumentDate(candidate.lastVerifiedAt),
      sourceMetadata: candidate.sourceMetadata || null,
    })
  }

  return documents
}

async function buildTenderSourcePack(tender) {
  const tenderDetails = await getTenderDetails(tender)
  const pdfLinks = await getPDFLinksFromTender(tender)
  const documentMetadata = normalizeSourceDocumentMetadata({ tender, pdfLinks })
  const pdfAssets = []
  const extractedTextSnippets = []

  if (!shouldArchiveTenderDocuments()) {
    return {
      tenderDetails,
      documentMetadata,
      pdfAssets,
      pdfText: '',
    }
  }

  for (const pdfLink of pdfLinks) {
    try {
      const pdfBuffer = await downloadPDF(pdfLink.url)
      if (!pdfBuffer) continue

      const pdfContent = await extractTextFromPDF(pdfBuffer)
      const extractedText = pdfContent?.text || ''

      if (extractedText) {
        extractedTextSnippets.push(extractedText)
      }

      pdfAssets.push({
        ...pdfLink,
        fileName: pdfLink.text || 'tender-document.pdf',
        buffer: pdfBuffer,
        text: extractedText,
      })
    } catch (error) {
      const classifiedError = classifyError(error)
      logger.crawler({
        level: 'error',
        message: 'crawler_pdf_processing_failed',
        phase: 'processing',
        error: classifiedError,
        data: {
          pdfText: pdfLink.text,
          pdfUrl: pdfLink.url,
          errorType: classifiedError.type,
        },
      })
    }
  }

  return {
    tenderDetails,
    documentMetadata,
    pdfAssets,
    pdfText: extractedTextSnippets.join('\n\n'),
  }
}

function buildOpportunitySummary(match, tender, tenderDetails) {
  const summaryBits = [
    `${match.practiceArea || 'Relevant'} opportunity`,
    summarizeMatchReasons(match.matchReasons),
    tenderDetails.entity ? `Issuing entity: ${tenderDetails.entity}` : null,
    tender.category ? `Category: ${tender.category}` : null,
  ].filter(Boolean)

  return summaryBits.join('. ')
}

function buildOpportunityNotes(match) {
  const keywordLine = match.matchedKeywords.length > 0
    ? `Matched keywords: ${match.matchedKeywords.join(', ')}`
    : null

  return [
    'Identified through the Bid360 opportunity radar.',
    ...match.matchReasons,
    keywordLine,
  ].filter(Boolean).join('\n\n')
}

function buildTenderEntity(tender, tenderDetails) {
  return tenderDetails.entity || tender.entity || tender.category || 'Unknown Entity'
}

function buildStoredOpportunitySummary(tender, tenderDetails) {
  return [
    'Imported by the Bid360 crawler for sector subscription matching.',
    tenderDetails.entity ? `Issuing entity: ${tenderDetails.entity}` : null,
    tender.category ? `Category: ${tender.category}` : null,
    tender.description ? `Description: ${String(tender.description).trim().slice(0, 5000)}` : null,
  ].filter(Boolean).join(' ')
}

function buildStoredOpportunityNotes() {
  return 'Identified through the Bid360 sector subscription crawler.'
}

function resolveStoredSourceUrl(tender) {
  return normalizeEtendersSourceUrl(tender.sourceUrl || tender.url)
}

function resolveSourceFallbackUrl(tender) {
  return normalizeEtendersDigestUrl(tender.sourceFallbackUrl || ETENDERS_GENERAL_OPPORTUNITIES_URL)
}

function resolveSourceDetailUrl(tender) {
  return normalizeEtendersSourceUrl(tender.sourceDetailUrl || tender.sourceUrl || tender.url)
}

async function invalidatePublicTenderCache(opportunityId, crawlerLogger = logger, sourceRunId = null) {
  try {
    await expireCacheTags(publicTenderCacheTag(opportunityId))
  } catch (error) {
    crawlerLogger.crawler?.({
      level: 'warn',
      phase: 'processing',
      runId: sourceRunId,
      message: 'crawler_tender_cache_invalidation_skipped',
      data: { opportunityId, errorType: error?.name || 'cache_invalidation_error' },
    })
  }
}

function createTenderMatchingPayload({ tender, tenderDetails, pdfText, opportunity }) {
  return {
    ...tender,
    tenderDetails,
    pdfText,
    opportunity: {
      title: opportunity.title,
      reference: opportunity.reference,
      entity: opportunity.entity,
      category: opportunity.category,
      summary: opportunity.summary,
    },
  }
}

function ensureSubscriberMatchMap(results) {
  if (results.subscriberMatchMap instanceof Map) {
    return results.subscriberMatchMap
  }

  Object.defineProperty(results, 'subscriberMatchMap', {
    value: new Map(),
    writable: true,
    enumerable: false,
  })

  return results.subscriberMatchMap
}

function buildDigestTender({ opportunity, tender, matchedSectors }) {
  return {
    id: opportunity.id,
    title: opportunity.title,
    reference: opportunity.reference,
    entity: opportunity.entity,
    category: opportunity.category,
    canonicalUrl: buildBid360TenderUrl(opportunity.id, opportunity.title),
    sourceUrl: normalizeEtendersDigestUrl(opportunity.sourceFallbackUrl || opportunity.sourceUrl || tender.sourceFallbackUrl),
    deadline: opportunity.deadline || toNullableDate(tender.deadline),
    publishedAt: opportunity.publishedAt || toNullableDate(tender.advertised),
    matchedSectors,
  }
}

function addSubscriberTenderMatches({ results, subscribers, opportunity, tender, matchedSectors }) {
  const subscriberMatchMap = ensureSubscriberMatchMap(results)
  const digestTender = buildDigestTender({ opportunity, tender, matchedSectors })

  for (const subscriber of subscribers) {
    if (!subscriberMatchMap.has(subscriber.id)) {
      subscriberMatchMap.set(subscriber.id, {
        subscriber,
        tenders: [],
      })
    }

    const group = subscriberMatchMap.get(subscriber.id)
    const alreadyAdded = group.tenders.some(item => item.id === digestTender.id)

    if (!alreadyAdded) {
      group.tenders.push({
        ...digestTender,
        subscriberSector: subscriber.sector,
      })
    }
  }

  results.subscriberDigestGroups = subscriberMatchMap.size
}

async function filterSubscribersNeedingDigest({ db, subscribers, opportunity }) {
  if (subscribers.length === 0 || !opportunity?.id) return []
  if (typeof db?.subscriberTenderDelivery?.findMany !== 'function') return subscribers

  const deliveredRows = await db.subscriberTenderDelivery.findMany({
    where: {
      opportunityId: opportunity.id,
      subscriberId: { in: subscribers.map(subscriber => subscriber.id) },
    },
    select: { subscriberId: true },
  })
  const deliveredSubscriberIds = new Set(deliveredRows.map(row => row.subscriberId))

  return subscribers.filter(subscriber => !deliveredSubscriberIds.has(subscriber.id))
}

function updateSubscriberMatchStats(results, { matchedSectors, matchingSubscribers, subscribersNeedingDigest, isNew }) {
  results.subscriberMatchStats ||= {
    tendersMatchedToSectors: 0,
    tendersWithoutSector: 0,
    tendersWithSubscriberMatches: 0,
    tendersWithoutSubscribers: 0,
    subscriberMatches: 0,
    newSubscriberTenderMatches: 0,
    queuedSubscriberTenderMatches: 0,
    alreadyDeliveredSubscriberMatches: 0,
  }

  if (matchedSectors.length > 0) {
    results.subscriberMatchStats.tendersMatchedToSectors += 1
    const knownSectors = new Set(results.subscriberMatchStats.matchedSectors || [])
    for (const sector of matchedSectors) {
      knownSectors.add(sector)
    }
    results.subscriberMatchStats.matchedSectors = Array.from(knownSectors)
  } else {
    results.subscriberMatchStats.tendersWithoutSector += 1
  }

  if (matchingSubscribers.length > 0) {
    results.subscriberMatchStats.tendersWithSubscriberMatches += 1
  } else {
    results.subscriberMatchStats.tendersWithoutSubscribers += 1
  }

  results.subscriberMatchStats.subscriberMatches += matchingSubscribers.length
  results.subscriberMatchStats.queuedSubscriberTenderMatches += subscribersNeedingDigest.length
  results.subscriberMatchStats.alreadyDeliveredSubscriberMatches +=
    matchingSubscribers.length - subscribersNeedingDigest.length

  if (isNew) {
    results.subscriberMatchStats.newSubscriberTenderMatches += matchingSubscribers.length
  }
}

export async function upsertOpportunityForOrganization({
  organization,
  source,
  sourceRun,
  tender,
  tenderDetails,
  match,
  pdfAssets,
}, db = prisma) {
  const deadline = toNullableDate(tender.deadline)
  const dedupeKey = buildStorageDedupeKey({
    organizationId: organization.id,
    sourceKey: source.key,
    externalId: tender.reference,
    title: tender.title,
    entity: tenderDetails.entity || tender.category || 'Unknown Entity',
    deadline,
  })

  const existingSnapshot = await db.opportunity.findUnique({
    where: {
      organizationId_dedupeKey: {
        organizationId: organization.id,
        dedupeKey,
      },
    },
    select: {
      id: true,
      status: true,
      notes: true,
      _count: {
        select: {
          documents: true,
        },
      },
    },
  })

  const mutableOpportunityFields = {
    organizationId: organization.id,
    title: tender.title,
    reference: tender.reference || null,
    externalId: tender.reference || null,
    dedupeKey,
    entity: tenderDetails.entity || tender.category || 'Unknown Entity',
    sourceName: source.name,
    sourceUrl: resolveStoredSourceUrl(tender),
    category: tender.category || null,
    practiceArea: match.practiceArea,
    summary: buildOpportunitySummary(match, tender, tenderDetails),
    publishedAt: toNullableDate(tender.advertised),
    deadline,
    briefingDate: toNullableDate(tenderDetails.briefingDate),
    siteVisitDate: toNullableDate(tenderDetails.siteVisitDate),
    contactPerson: tenderDetails.contactPerson || null,
    contactEmail: tenderDetails.contactEmail || null,
    fitScore: match.fitScore,
    sourceId: source.id,
    sourceRunId: sourceRun.id,
  }
  const createOpportunityFields = {
    ...mutableOpportunityFields,
    status: match.recommendedStatus,
    notes: buildOpportunityNotes(match),
  }

  // Existing user decisions are immutable crawler-side: status and notes are only set on first discovery.
  // Source freshness fields remain mutable so reruns can refresh dates, contact details, score, and sourceRunId.
  const opportunity = await db.opportunity.upsert({
    where: {
      organizationId_dedupeKey: {
        organizationId: organization.id,
        dedupeKey,
      },
    },
    create: {
      ...createOpportunityFields,
    },
    update: {
      ...mutableOpportunityFields,
    },
    select: {
      id: true,
      title: true,
      reference: true,
      entity: true,
      practiceArea: true,
      fitScore: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const wasCreatedByUpsert = opportunity.createdAt.getTime() === opportunity.updatedAt.getTime()

  await db.opportunityMatch.upsert({
    where: {
      opportunityId_organizationId: {
        opportunityId: opportunity.id,
        organizationId: organization.id,
      },
    },
    update: {
      verdict: match.verdict,
      fitScore: match.fitScore,
      matchedKeywords: match.matchedKeywords,
      matchReasons: match.matchReasons,
      reviewedAt: existingSnapshot && existingSnapshot.status !== 'New' ? new Date() : null,
    },
    create: {
      organizationId: organization.id,
      opportunityId: opportunity.id,
      verdict: match.verdict,
      fitScore: match.fitScore,
      matchedKeywords: match.matchedKeywords,
      matchReasons: match.matchReasons,
    },
  })

  if (
    (wasCreatedByUpsert || (existingSnapshot && existingSnapshot._count.documents === 0))
    && pdfAssets.length > 0
  ) {
    for (const pdfAsset of pdfAssets) {
      const uploadResult = await uploadPDFToSupabase(
        pdfAsset.fileName,
        pdfAsset.buffer,
        opportunity.id
      )

      if (!uploadResult) continue

      await db.opportunityDocument.create({
        data: {
          filename: uploadResult.fileName,
          filepath: uploadResult.filePath,
          storagePath: uploadResult.storagePath,
          opportunityId: opportunity.id,
        },
      })
    }
  }

  return {
    opportunity,
    isNew: wasCreatedByUpsert,
  }
}

export async function upsertOpportunityDocumentMetadata({
  db,
  opportunityId,
  documents = [],
  now = new Date(),
  crawlerLogger = logger,
  sourceRunId = null,
}) {
  if (!opportunityId || !Array.isArray(documents) || documents.length === 0) {
    return { found: 0, upserted: 0, skippedMissingUrl: 0, skippedMissingId: 0 }
  }

  if (typeof db?.opportunityDocument?.upsert !== 'function') {
    return { found: documents.length, upserted: 0, skippedMissingUrl: 0, skippedMissingId: 0, skippedUnsupportedDb: documents.length }
  }

  let upserted = 0
  let skippedMissingUrl = 0
  let skippedMissingId = 0

  for (const document of documents) {
    const sourceUrl = normalizeEtendersSourceUrl(document.sourceUrl)
    const sourceDocumentId = String(document.sourceDocumentId || '').trim()

    if (!sourceUrl) {
      skippedMissingUrl += 1
      continue
    }

    if (!sourceDocumentId) {
      skippedMissingId += 1
      continue
    }

    await db.opportunityDocument.upsert({
      where: {
        opportunityId_sourceDocumentId: {
          opportunityId,
          sourceDocumentId,
        },
      },
      create: {
        opportunityId,
        filename: document.name || 'Tender document',
        filepath: sourceUrl,
        sourceUrl,
        sourceDocumentId,
        documentType: document.documentType || 'SOURCE',
        extension: document.extension || null,
        fileSize: document.fileSize || null,
        checksum: document.checksum || null,
        sourceMetadata: document.sourceMetadata || null,
        firstSeenAt: document.firstSeenAt || now,
        lastVerifiedAt: document.lastVerifiedAt || now,
        uploadedAt: now,
      },
      update: {
        filename: document.name || 'Tender document',
        filepath: sourceUrl,
        sourceUrl,
        documentType: document.documentType || 'SOURCE',
        extension: document.extension || null,
        fileSize: document.fileSize || null,
        checksum: document.checksum || null,
        sourceMetadata: document.sourceMetadata || null,
        lastVerifiedAt: document.lastVerifiedAt || now,
      },
    })
    upserted += 1
  }

  if (skippedMissingUrl > 0 || skippedMissingId > 0) {
    crawlerLogger.crawler?.({
      level: 'warn',
      phase: 'processing',
      runId: sourceRunId,
      message: 'crawler_tender_documents_skipped',
      data: {
        opportunityId,
        documentsFound: documents.length,
        skippedMissingUrl,
        skippedMissingId,
      },
    })
  }

  return { found: documents.length, upserted, skippedMissingUrl, skippedMissingId }
}

export async function upsertOpportunityForTender({
  storageOrganization,
  source,
  sourceRun,
  tender,
  tenderDetails,
  pdfAssets,
  documentMetadata = [],
}, db = prisma) {
  const now = new Date()
  const deadline = toNullableDate(tender.deadline)
  const entity = buildTenderEntity(tender, tenderDetails)
  const sourceTenderId = getTenderSourceTenderId(tender)
  const sourceContentHash = computeTenderContentHash({ tender, tenderDetails, documents: documentMetadata })
  const sourceIdentityKey = buildTenderSourceIdentityKey({
    sourceKey: source.key,
    tender,
    tenderDetails,
    contentHash: sourceContentHash,
  })
  const dedupeKey = buildStorageDedupeKey({
    organizationId: storageOrganization.id,
    sourceKey: source.key,
    externalId: tender.reference,
    title: tender.title,
    entity,
    deadline,
  })

  const existingSelect = {
    id: true,
    status: true,
    notes: true,
    sourceContentHash: true,
    sourceIdentityKey: true,
    createdAt: true,
    updatedAt: true,
  }

  // Prefer the immutable source identity, then an exact source-id lookup, and
  // finally the legacy organization-scoped key for existing records created by
  // older crawler versions. Ambiguous title/reference candidates are ignored.
  let existingSnapshot = null
  if (typeof db.opportunity.findUnique === 'function') {
    existingSnapshot = await db.opportunity.findUnique({
      where: { sourceIdentityKey },
      select: existingSelect,
    })
  }

  if (!existingSnapshot && sourceTenderId && typeof db.opportunity.findFirst === 'function') {
    existingSnapshot = await db.opportunity.findFirst({
      where: { sourceId: source.id, sourceTenderId },
      orderBy: { id: 'asc' },
      select: existingSelect,
    })
  }

  if (!existingSnapshot && typeof db.opportunity.findUnique === 'function') {
    existingSnapshot = await db.opportunity.findUnique({
      where: {
        organizationId_dedupeKey: {
          organizationId: storageOrganization.id,
          dedupeKey,
        },
      },
      select: existingSelect,
    })
  }

  const previousSourceContentHash = existingSnapshot?.sourceContentHash || null

  const mutableOpportunityFields = {
    organizationId: storageOrganization.id,
    title: tender.title,
    reference: tender.reference || null,
    externalId: tender.reference || null,
    dedupeKey,
    sourceTenderId,
    sourceIdentityKey,
    sourceContentHash,
    sourceStatus: tender.sourceStatus || tender.status || null,
    entity,
    sourceName: source.name,
    sourceUrl: resolveStoredSourceUrl(tender),
    sourceDetailUrl: resolveSourceDetailUrl(tender),
    sourceFallbackUrl: resolveSourceFallbackUrl(tender),
    category: tender.category || null,
    practiceArea: null,
    summary: buildStoredOpportunitySummary(tender, tenderDetails),
    publishedAt: toNullableDate(tender.advertised),
    deadline,
    briefingDate: toNullableDate(tenderDetails.briefingDate),
    briefingDetails: tenderDetails.briefingDetails || null,
    siteVisitDate: toNullableDate(tenderDetails.siteVisitDate),
    location: tenderDetails.location || tenderDetails.province || null,
    contactPerson: tenderDetails.contactPerson || null,
    contactEmail: tenderDetails.contactEmail || null,
    fitScore: null,
    sourceId: source.id,
    sourceRunId: sourceRun.id,
    lastSeenAt: now,
    lastVerifiedAt: now,
    sourceMissingAt: null,
  }

  let opportunity
  let createdByRace = false

  if (existingSnapshot) {
    opportunity = await db.opportunity.update({
      where: { id: existingSnapshot.id },
      data: mutableOpportunityFields,
      select: {
        id: true,
        title: true,
        reference: true,
        entity: true,
        category: true,
        sourceUrl: true,
        sourceFallbackUrl: true,
        summary: true,
        publishedAt: true,
        deadline: true,
        matchedSectors: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  } else {
    try {
      opportunity = await db.opportunity.upsert({
        where: { sourceIdentityKey },
        create: {
          ...mutableOpportunityFields,
          matchedSectors: [],
          firstSeenAt: now,
          status: 'New',
          notes: buildStoredOpportunityNotes(),
        },
        update: mutableOpportunityFields,
        select: {
          id: true,
          title: true,
          reference: true,
          entity: true,
          category: true,
          sourceUrl: true,
          sourceFallbackUrl: true,
          summary: true,
          publishedAt: true,
          deadline: true,
          matchedSectors: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    } catch (error) {
      if (error?.code !== 'P2002' || typeof db.opportunity.findUnique !== 'function') throw error

      // A concurrent worker may have inserted the same source identity after
      // the lookup. Resolve the winner and update it instead of creating a copy.
      const racedOpportunity = await db.opportunity.findUnique({
        where: { sourceIdentityKey },
        select: { id: true },
      })
      if (!racedOpportunity) throw error

      createdByRace = true
      opportunity = await db.opportunity.update({
        where: { id: racedOpportunity.id },
        data: mutableOpportunityFields,
        select: {
          id: true,
          title: true,
          reference: true,
          entity: true,
          category: true,
          sourceUrl: true,
          sourceFallbackUrl: true,
          summary: true,
          publishedAt: true,
          deadline: true,
          matchedSectors: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    }
  }

  const documentStats = await upsertOpportunityDocumentMetadata({
    db,
    opportunityId: opportunity.id,
    documents: documentMetadata,
    now,
    sourceRunId: sourceRun.id,
    crawlerLogger: logger,
  })

  if (shouldArchiveTenderDocuments() && pdfAssets.length > 0) {
    for (const pdfAsset of pdfAssets) {
      const uploadResult = await uploadPDFToSupabase(
        pdfAsset.fileName,
        pdfAsset.buffer,
        opportunity.id
      )

      if (!uploadResult) continue

      await db.opportunityDocument.create({
        data: {
          filename: uploadResult.fileName,
          filepath: uploadResult.filePath,
          storagePath: uploadResult.storagePath,
          opportunityId: opportunity.id,
        },
      })
    }
  }

  await invalidatePublicTenderCache(opportunity.id, logger, sourceRun.id)

  return {
    opportunity,
    isNew: !existingSnapshot && !createdByRace,
    sourceIdentityKey,
    sourceContentChanged: Boolean(
      previousSourceContentHash
      && previousSourceContentHash !== sourceContentHash
    ),
    documentStats,
  }
}

export async function processTenderForOrganizations({
  tender,
  organizations,
  source,
  sourceRun,
  results,
  db = prisma,
  crawlerLogger = logger,
}) {
  const sourcePack = await buildTenderSourcePack(tender)

  const storageOrganization = organizations[0]
  if (!storageOrganization) {
    results.warnings.push({
      message: 'Tender could not be stored because no organization storage scope is available.',
      tenderRef: tender.reference || null,
    })
    crawlerLogger.crawler({
      level: 'warn',
      phase: 'processing',
      runId: sourceRun.id,
      message: 'crawler_tender_storage_scope_missing',
      data: {
        tenderRef: tender.reference || null,
        tenderTitle: tender.title,
      },
    })
    return
  }

  const { opportunity, isNew, sourceContentChanged, documentStats } = await upsertOpportunityForTender({
    storageOrganization,
    source,
    sourceRun,
    tender,
    tenderDetails: sourcePack.tenderDetails,
    pdfAssets: sourcePack.pdfAssets,
    documentMetadata: sourcePack.documentMetadata,
  }, db)

  if (isNew) {
    results.newOpportunitiesCreated += 1
  }

  results.tenderLinking ||= {}
  results.tenderLinking.tendersCreated = (results.tenderLinking.tendersCreated || 0) + (isNew ? 1 : 0)
  results.tenderLinking.tendersUpdated = (results.tenderLinking.tendersUpdated || 0) + (isNew ? 0 : 1)
  results.tenderLinking.duplicateUpsertsAvoided = (results.tenderLinking.duplicateUpsertsAvoided || 0) + (isNew ? 0 : 1)
  results.tenderLinking.sourceContentChanges = (results.tenderLinking.sourceContentChanges || 0) + (sourceContentChanged ? 1 : 0)
  results.tenderLinking.documentsFound = (results.tenderLinking.documentsFound || 0) + (documentStats?.found || 0)
  results.tenderLinking.documentsUpserted = (results.tenderLinking.documentsUpserted || 0) + (documentStats?.upserted || 0)
  results.tenderLinking.documentsSkippedMissingUrl = (results.tenderLinking.documentsSkippedMissingUrl || 0) + (documentStats?.skippedMissingUrl || 0)
  results.tenderLinking.documentsSkippedMissingId = (results.tenderLinking.documentsSkippedMissingId || 0) + (documentStats?.skippedMissingId || 0)

  if (!opportunity.sourceUrl) {
    results.tenderLinking.tendersWithoutDirectSourceLink = (results.tenderLinking.tendersWithoutDirectSourceLink || 0) + 1
    results.tenderLinking.tendersUsingGeneralSourceFallback = (results.tenderLinking.tendersUsingGeneralSourceFallback || 0) + 1
    crawlerLogger.crawler({
      level: 'info',
      phase: 'processing',
      runId: sourceRun.id,
      message: 'crawler_tender_using_general_source_fallback',
      data: { opportunityId: opportunity.id, sourceName: source.name },
    })
  }

  const matchingTender = createTenderMatchingPayload({
    tender,
    tenderDetails: sourcePack.tenderDetails,
    pdfText: sourcePack.pdfText,
    opportunity,
  })
  const matchedSectors = matchTenderToSectors(matchingTender)

  if (typeof db.opportunity.update === 'function') {
    await db.opportunity.update({
      where: { id: opportunity.id },
      data: { matchedSectors },
      select: { id: true },
    })
    await invalidatePublicTenderCache(opportunity.id, crawlerLogger, sourceRun.id)
  }

  const matchingSubscribers = await matchSubscribersToTender(matchingTender, matchedSectors, db)
  const subscribersNeedingDigest = await filterSubscribersNeedingDigest({
    db,
    subscribers: matchingSubscribers,
    opportunity,
  })

  results.matchedCount += matchingSubscribers.length
  updateSubscriberMatchStats(results, {
    matchedSectors,
    matchingSubscribers,
    subscribersNeedingDigest,
    isNew,
  })

  if (subscribersNeedingDigest.length > 0) {
    addSubscriberTenderMatches({
      results,
      subscribers: subscribersNeedingDigest,
      opportunity,
      tender,
      matchedSectors,
    })
  }

  crawlerLogger.crawler({
    level: matchingSubscribers.length > 0 ? 'info' : 'debug',
    phase: 'processing',
    runId: sourceRun.id,
    message: 'crawler_subscriber_matching_completed',
    data: {
      tenderRef: tender.reference || null,
      tenderTitle: tender.title,
      opportunityId: opportunity.id,
      isNew,
      matchedSectors,
      matchedSectorLabels: matchedSectors.map(getSectorLabel),
      subscriberMatches: matchingSubscribers.length,
      queuedSubscriberTenderMatches: subscribersNeedingDigest.length,
      digestGroupCount: results.subscriberDigestGroups || 0,
    },
  })

  if (subscribersNeedingDigest.length > 0) {
    await logActivity(`Sector subscription matched: ${opportunity.title}`, {})
  }
}
