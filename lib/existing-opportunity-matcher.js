import { analyzeTenderForSector } from '@/lib/crawler/keyword-matcher'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
import {
  buildOpportunityDedupeKey,
  evaluateOpportunityMatch,
} from '@/lib/opportunity-radar'
import prisma from '@/lib/prisma'
import { normalizeServiceSector } from '@/lib/service-sectors'

function toNullableDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function serializeJsonText(value) {
  if (!value) return ''
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function buildSourceText(opportunity) {
  // Existing opportunities contain generated match summaries/notes from the
  // original org. Reusing that text can leak one sector's keywords into another
  // sector's backfill pass, so only parsed source fields are analyzed here.
  // Title is passed separately to analyzeTenderForSector, matching the live crawler path.
  return [
    serializeJsonText(opportunity.parsedRequirements),
    serializeJsonText(opportunity.parsedAppointments),
  ].filter(Boolean).join('\n\n')
}

function buildBackfilledSummary(match, sourceOpportunity) {
  return [
    `${match.practiceArea || 'Relevant'} opportunity`,
    match.matchReasons?.slice(0, 2).join(' '),
    sourceOpportunity.entity ? `Issuing entity: ${sourceOpportunity.entity}` : null,
    sourceOpportunity.category ? `Category: ${sourceOpportunity.category}` : null,
  ].filter(Boolean).join('. ')
}

function buildBackfilledNotes(match) {
  const keywordLine = match.matchedKeywords.length > 0
    ? `Matched keywords: ${match.matchedKeywords.join(', ')}`
    : null

  return [
    'Matched from existing Bid360 opportunity radar data after email verification.',
    ...match.matchReasons,
    keywordLine,
  ].filter(Boolean).join('\n\n')
}

async function loadOrganizationForMatching(organizationId) {
  return prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      firmProfile: true,
    },
  })
}

async function loadExistingSourceOpportunities(organizationId, { includeOrganization = false } = {}) {
  const now = new Date()

  return prisma.opportunity.findMany({
    where: {
      ...(includeOrganization ? {} : { organizationId: { not: organizationId } }),
      sourceId: { not: null },
      OR: [
        { deadline: null },
        { deadline: { gte: now } },
      ],
    },
    distinct: ['sourceId', 'externalId', 'reference', 'title', 'entity', 'deadline'],
    orderBy: [
      { deadline: { sort: 'asc', nulls: 'last' } },
      { updatedAt: 'desc' },
    ],
    select: {
      id: true,
      title: true,
      reference: true,
      entity: true,
      externalId: true,
      sourceName: true,
      sourceUrl: true,
      category: true,
      practiceArea: true,
      summary: true,
      estimatedValue: true,
      publishedAt: true,
      deadline: true,
      briefingDate: true,
      siteVisitDate: true,
      contactPerson: true,
      contactEmail: true,
      notes: true,
      parsedRequirements: true,
      parsedAppointments: true,
      sourceId: true,
      sourceRunId: true,
      source: {
        select: {
          key: true,
        },
      },
    },
  })
}

async function clearSourceBackedRadarOpportunities(organizationId) {
  return prisma.opportunity.deleteMany({
    where: {
      organizationId,
      sourceId: { not: null },
      tender: { is: null },
    },
  })
}

export async function matchExistingOpportunitiesForOrganization(
  organizationId,
  { replaceExistingSourceMatches = false } = {}
) {
  const organization = await loadOrganizationForMatching(organizationId)

  if (!organization?.firmProfile) {
    return { matched: 0, created: 0, skipped: 0, cleared: 0 }
  }

  const serviceSector = normalizeServiceSector(organization.firmProfile.serviceSector)
  if (!serviceSector) {
    const clearResult = replaceExistingSourceMatches
      ? await clearSourceBackedRadarOpportunities(organizationId)
      : { count: 0 }

    if (clearResult.count > 0) {
      await expireCacheTags(dashboardCacheTag(organizationId))
    }

    return { matched: 0, created: 0, skipped: 0, cleared: clearResult.count }
  }

  const sourceOpportunities = await loadExistingSourceOpportunities(organizationId, {
    includeOrganization: replaceExistingSourceMatches,
  })
  const clearResult = replaceExistingSourceMatches
    ? await clearSourceBackedRadarOpportunities(organizationId)
    : { count: 0 }
  let matched = 0
  let created = 0
  let skipped = 0

  for (const sourceOpportunity of sourceOpportunities) {
    const sourceText = buildSourceText(sourceOpportunity)
    const tender = {
      title: sourceOpportunity.title,
      reference: sourceOpportunity.reference || sourceOpportunity.externalId,
      description: sourceText,
      category: sourceOpportunity.category,
      deadline: sourceOpportunity.deadline,
      advertised: sourceOpportunity.publishedAt,
      url: sourceOpportunity.sourceUrl,
      entity: sourceOpportunity.entity,
    }
    const tenderDetails = {
      entity: sourceOpportunity.entity,
      briefingDate: sourceOpportunity.briefingDate,
      siteVisitDate: sourceOpportunity.siteVisitDate,
      contactPerson: sourceOpportunity.contactPerson,
      contactEmail: sourceOpportunity.contactEmail,
    }
    const tenderAnalysis = analyzeTenderForSector(
      serviceSector,
      sourceOpportunity.title,
      sourceText,
      ''
    )

    if (!tenderAnalysis.isSectorOpportunity) {
      skipped += 1
      continue
    }

    const match = evaluateOpportunityMatch({
      firmProfile: organization.firmProfile,
      tender,
      tenderDetails,
      tenderAnalysis,
    })

    if (!match.isMatch) {
      skipped += 1
      continue
    }

    matched += 1

    const dedupeKey = buildOpportunityDedupeKey({
      organizationId,
      sourceKey: sourceOpportunity.source?.key || sourceOpportunity.sourceName || 'source',
      externalId: sourceOpportunity.externalId || sourceOpportunity.reference,
      title: sourceOpportunity.title,
      entity: sourceOpportunity.entity,
      deadline: sourceOpportunity.deadline,
    })
    const deadline = toNullableDate(sourceOpportunity.deadline)

    const existingOpportunity = await prisma.opportunity.findUnique({
      where: {
        organizationId_dedupeKey: { organizationId, dedupeKey },
      },
      select: {
        id: true,
        status: true,
      },
    })

    const opportunity = existingOpportunity
      ? await prisma.opportunity.update({
          where: { id: existingOpportunity.id },
          data: {
            practiceArea: match.practiceArea,
            summary: buildBackfilledSummary(match, sourceOpportunity),
            fitScore: match.fitScore,
            sourceRunId: sourceOpportunity.sourceRunId,
          },
          select: { id: true },
        })
      : await prisma.opportunity.create({
          data: {
            organizationId,
            title: sourceOpportunity.title,
            reference: sourceOpportunity.reference,
            externalId: sourceOpportunity.externalId,
            dedupeKey,
            entity: sourceOpportunity.entity,
            sourceName: sourceOpportunity.sourceName,
            sourceUrl: sourceOpportunity.sourceUrl,
            category: sourceOpportunity.category,
            practiceArea: match.practiceArea,
            summary: buildBackfilledSummary(match, sourceOpportunity),
            estimatedValue: sourceOpportunity.estimatedValue,
            publishedAt: toNullableDate(sourceOpportunity.publishedAt),
            deadline,
            briefingDate: toNullableDate(sourceOpportunity.briefingDate),
            siteVisitDate: toNullableDate(sourceOpportunity.siteVisitDate),
            contactPerson: sourceOpportunity.contactPerson,
            contactEmail: sourceOpportunity.contactEmail,
            fitScore: match.fitScore,
            status: match.recommendedStatus,
            notes: buildBackfilledNotes(match),
            parsedRequirements: sourceOpportunity.parsedRequirements,
            parsedAppointments: sourceOpportunity.parsedAppointments,
            sourceId: sourceOpportunity.sourceId,
            sourceRunId: sourceOpportunity.sourceRunId,
          },
          select: { id: true },
        })

    await prisma.opportunityMatch.upsert({
      where: {
        opportunityId_organizationId: {
          opportunityId: opportunity.id,
          organizationId,
        },
      },
      update: {
        verdict: match.verdict,
        fitScore: match.fitScore,
        matchedKeywords: match.matchedKeywords,
        matchReasons: match.matchReasons,
        reviewedAt: existingOpportunity && existingOpportunity.status !== 'New' ? new Date() : null,
      },
      create: {
        opportunityId: opportunity.id,
        organizationId,
        verdict: match.verdict,
        fitScore: match.fitScore,
        matchedKeywords: match.matchedKeywords,
        matchReasons: match.matchReasons,
      },
    })

    if (!existingOpportunity) {
      created += 1
    }
  }

  if (created > 0 || clearResult.count > 0) {
    await expireCacheTags(dashboardCacheTag(organizationId))
  }

  return { matched, created, skipped, cleared: clearResult.count }
}
