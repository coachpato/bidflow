import { logActivity } from '@/lib/activity'
import { downloadPDF, getPDFLinksFromTender, getTenderDetails } from '@/lib/crawler/etenders-crawler'
import { extractTextFromPDF } from '@/lib/crawler/pdf-extractor'
import { classifyError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { matchTenderToSectors } from '@/lib/matching/sector-matcher'
import { matchSubscribersToTender } from '@/lib/matching/subscriber-matcher'
import prisma from '@/lib/prisma'
import { getSectorLabel } from '@/lib/sectors'
import { createSignedDocumentUrls, ensureStorageBucket, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

const OPPORTUNITIES_URL = 'https://www.etenders.gov.za/Home/opportunities?id=1'

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

async function buildTenderSourcePack(tender) {
  const tenderDetails = await getTenderDetails(tender)
  const pdfLinks = await getPDFLinksFromTender(tender)
  const pdfAssets = []
  const extractedTextSnippets = []

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
  ].filter(Boolean).join(' ')
}

function buildStoredOpportunityNotes() {
  return 'Identified through the Bid360 sector subscription crawler.'
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
    sourceUrl: opportunity.sourceUrl || tender.url || OPPORTUNITIES_URL,
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

function updateSubscriberMatchStats(results, { matchedSectors, matchingSubscribers, isNew }) {
  results.subscriberMatchStats ||= {
    tendersMatchedToSectors: 0,
    tendersWithoutSector: 0,
    tendersWithSubscriberMatches: 0,
    tendersWithoutSubscribers: 0,
    subscriberMatches: 0,
    newSubscriberTenderMatches: 0,
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
    sourceUrl: tender.url || OPPORTUNITIES_URL,
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

export async function upsertOpportunityForTender({
  storageOrganization,
  source,
  sourceRun,
  tender,
  tenderDetails,
  pdfAssets,
}, db = prisma) {
  const deadline = toNullableDate(tender.deadline)
  const entity = buildTenderEntity(tender, tenderDetails)
  const dedupeKey = buildStorageDedupeKey({
    organizationId: storageOrganization.id,
    sourceKey: source.key,
    externalId: tender.reference,
    title: tender.title,
    entity,
    deadline,
  })

  const existingSnapshot = await db.opportunity.findUnique({
    where: {
      organizationId_dedupeKey: {
        organizationId: storageOrganization.id,
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
    organizationId: storageOrganization.id,
    title: tender.title,
    reference: tender.reference || null,
    externalId: tender.reference || null,
    dedupeKey,
    entity,
    sourceName: source.name,
    sourceUrl: tender.url || OPPORTUNITIES_URL,
    category: tender.category || null,
    practiceArea: null,
    summary: buildStoredOpportunitySummary(tender, tenderDetails),
    publishedAt: toNullableDate(tender.advertised),
    deadline,
    briefingDate: toNullableDate(tenderDetails.briefingDate),
    siteVisitDate: toNullableDate(tenderDetails.siteVisitDate),
    contactPerson: tenderDetails.contactPerson || null,
    contactEmail: tenderDetails.contactEmail || null,
    fitScore: null,
    sourceId: source.id,
    sourceRunId: sourceRun.id,
  }

  const opportunity = await db.opportunity.upsert({
    where: {
      organizationId_dedupeKey: {
        organizationId: storageOrganization.id,
        dedupeKey,
      },
    },
    create: {
      ...mutableOpportunityFields,
      status: 'New',
      notes: buildStoredOpportunityNotes(),
    },
    update: {
      ...mutableOpportunityFields,
    },
    select: {
      id: true,
      title: true,
      reference: true,
      entity: true,
      category: true,
      sourceUrl: true,
      summary: true,
      publishedAt: true,
      deadline: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const wasCreatedByUpsert = opportunity.createdAt.getTime() === opportunity.updatedAt.getTime()

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

  const { opportunity, isNew } = await upsertOpportunityForTender({
    storageOrganization,
    source,
    sourceRun,
    tender,
    tenderDetails: sourcePack.tenderDetails,
    pdfAssets: sourcePack.pdfAssets,
  }, db)

  if (isNew) {
    results.newOpportunitiesCreated += 1
  }

  const matchingTender = createTenderMatchingPayload({
    tender,
    tenderDetails: sourcePack.tenderDetails,
    pdfText: sourcePack.pdfText,
    opportunity,
  })
  const matchedSectors = matchTenderToSectors(matchingTender)
  const matchingSubscribers = await matchSubscribersToTender(matchingTender, matchedSectors, db)

  results.matchedCount += matchingSubscribers.length
  updateSubscriberMatchStats(results, { matchedSectors, matchingSubscribers, isNew })

  if (isNew && matchingSubscribers.length > 0) {
    addSubscriberTenderMatches({
      results,
      subscribers: matchingSubscribers,
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
      digestGroupCount: results.subscriberDigestGroups || 0,
    },
  })

  if (isNew && matchingSubscribers.length > 0) {
    await logActivity(`Sector subscription matched: ${opportunity.title}`, {})
  }
}
