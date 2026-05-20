import { logActivity } from '@/lib/activity'
import { downloadPDF, getPDFLinksFromTender, getTenderDetails } from '@/lib/crawler/etenders-crawler'
import { analyzeTenderForSector } from '@/lib/crawler/keyword-matcher'
import { extractTextFromPDF } from '@/lib/crawler/pdf-extractor'
import { classifyError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import {
  buildOpportunityDedupeKey,
  evaluateOpportunityMatch,
  summarizeMatchReasons,
} from '@/lib/opportunity-radar'
import prisma from '@/lib/prisma'
import { normalizeServiceSector } from '@/lib/service-sectors'
import { createSignedDocumentUrls, ensureStorageBucket, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

const OPPORTUNITIES_URL = 'https://www.etenders.gov.za/Home/opportunities?id=1'

function toNullableDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
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
  const dedupeKey = buildOpportunityDedupeKey({
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

export async function processTenderForOrganizations({ tender, organizations, source, sourceRun, results }) {
  const sourcePack = await buildTenderSourcePack(tender)
  const sectorAnalysisCache = new Map()

  for (const organization of organizations) {
    const serviceSector = normalizeServiceSector(organization.firmProfile?.serviceSector)
    if (!serviceSector) continue

    let tenderAnalysis = sectorAnalysisCache.get(serviceSector)

    if (!tenderAnalysis) {
      tenderAnalysis = analyzeTenderForSector(serviceSector, tender.title, tender.description, sourcePack.pdfText)
      sectorAnalysisCache.set(serviceSector, tenderAnalysis)
    }

    if (!tenderAnalysis.isSectorOpportunity) continue

    const match = evaluateOpportunityMatch({
      firmProfile: organization.firmProfile,
      tender,
      tenderDetails: sourcePack.tenderDetails,
      tenderAnalysis,
    })

    if (!match.isMatch) continue

    const { opportunity, isNew } = await upsertOpportunityForOrganization({
      organization,
      source,
      sourceRun,
      tender,
      tenderDetails: sourcePack.tenderDetails,
      match,
      pdfAssets: sourcePack.pdfAssets,
    })

    results.matchedCount += 1
    if (!isNew) continue

    results.newOpportunitiesCreated += 1
    results.opportunitiesByOrganization[organization.id] ||= {
      organizationId: organization.id,
      organizationName: organization.name,
      opportunities: [],
    }
    results.opportunitiesByOrganization[organization.id].opportunities.push({
      id: opportunity.id,
      title: opportunity.title,
      reference: opportunity.reference,
      entity: opportunity.entity,
      practiceArea: opportunity.practiceArea,
      fitScore: opportunity.fitScore,
      matchSummary: summarizeMatchReasons(match.matchReasons),
    })

    await logActivity(`Opportunity radar matched: ${opportunity.title}`, {})
  }
}
