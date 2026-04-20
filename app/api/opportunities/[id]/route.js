import { logActivity } from '@/lib/activity'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
import {
  buildManualMatchData,
  buildOpportunityDedupeKey,
  normalizeOpportunityStatus,
} from '@/lib/opportunity-radar'
import { getSessionOrganizationId } from '@/lib/organization'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

async function getOrganizationServiceSector(organizationId) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      firmProfile: {
        select: {
          serviceSector: true,
        },
      },
    },
  })

  return organization?.firmProfile?.serviceSector || null
}

function toNullableString(value, existingValue) {
  if (value === undefined) return existingValue
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function toNullableNumber(value, existingValue) {
  if (value === undefined) return existingValue
  if (value === null || value === '') return null

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toNullableInt(value, existingValue) {
  if (value === undefined) return existingValue
  if (value === null || value === '') return null

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function toNullableDate(value, existingValue) {
  if (value === undefined) return existingValue
  if (!value) return null

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getOpportunityInclude(organizationId) {
  return {
    createdBy: { select: { name: true, email: true } },
    source: { select: { id: true, key: true, name: true, type: true, baseUrl: true } },
    documents: { orderBy: { uploadedAt: 'desc' } },
    matches: {
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    },
    tender: { select: { id: true, title: true, status: true } },
  }
}

function serializeOpportunity(opportunity) {
  const [match] = opportunity.matches || []

  return {
    ...opportunity,
    match: match || null,
    matches: undefined,
  }
}

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const { id } = await params
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: parseInt(id, 10),
      organizationId,
    },
    include: getOpportunityInclude(organizationId),
  })

  if (!opportunity) {
    return Response.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  return Response.json(serializeOpportunity(opportunity))
}

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const { id } = await params
  const opportunityId = parseInt(id, 10)
  const body = await request.json()

  const existing = await prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      organizationId,
    },
  })

  if (!existing) {
    return Response.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  const nextFitScore = toNullableInt(body.fitScore, existing.fitScore)
  const nextPracticeArea = toNullableString(body.practiceArea, existing.practiceArea)
  const nextReference = toNullableString(body.reference, existing.reference)
  const nextDeadline = toNullableDate(body.deadline, existing.deadline)
  const nextSourceName = toNullableString(body.sourceName, existing.sourceName) || 'Manual intake'
  const serviceSector = await getOrganizationServiceSector(organizationId)
  const existingMatch = await prisma.opportunityMatch.findUnique({
    where: {
      opportunityId_organizationId: {
        opportunityId,
        organizationId,
      },
    },
  })
  const manualMatch = buildManualMatchData({
    title: body.title ?? existing.title,
    entity: body.entity ?? existing.entity,
    practiceArea: nextPracticeArea,
    fitScore: nextFitScore,
    serviceSector,
  })

  const nextDedupeKey = buildOpportunityDedupeKey({
    organizationId,
    sourceKey: nextSourceName,
    externalId: nextReference,
    title: body.title ?? existing.title,
    entity: body.entity ?? existing.entity,
    deadline: nextDeadline,
  })

  const duplicateOpportunity = nextDedupeKey === existing.dedupeKey
    ? null
    : await prisma.opportunity.findUnique({
        where: {
          organizationId_dedupeKey: {
            organizationId,
            dedupeKey: nextDedupeKey,
          },
        },
        select: { id: true },
      })

  if (duplicateOpportunity && duplicateOpportunity.id !== opportunityId) {
    return Response.json({ error: 'Another opportunity in your radar already uses this source record.' }, { status: 409 })
  }

  const updated = await prisma.$transaction(async tx => {
    await tx.opportunity.update({
      where: { id: opportunityId },
      data: {
        title: body.title ?? existing.title,
        reference: nextReference,
        externalId: nextReference,
        entity: body.entity ?? existing.entity,
        dedupeKey: nextDedupeKey,
        sourceName: nextSourceName,
        sourceUrl: toNullableString(body.sourceUrl, existing.sourceUrl),
        category: toNullableString(body.category, existing.category),
        practiceArea: nextPracticeArea || manualMatch.practiceArea,
        summary: toNullableString(body.summary, existing.summary),
        estimatedValue: toNullableNumber(body.estimatedValue, existing.estimatedValue),
        publishedAt: toNullableDate(body.publishedAt, existing.publishedAt),
        deadline: nextDeadline,
        briefingDate: toNullableDate(body.briefingDate, existing.briefingDate),
        siteVisitDate: toNullableDate(body.siteVisitDate, existing.siteVisitDate),
        contactPerson: toNullableString(body.contactPerson, existing.contactPerson),
        contactEmail: toNullableString(body.contactEmail, existing.contactEmail),
        fitScore: nextFitScore,
        status: normalizeOpportunityStatus(body.status, existing.status),
        notes: toNullableString(body.notes, existing.notes),
        parsedRequirements: body.parsedRequirements !== undefined
          ? (Array.isArray(body.parsedRequirements) ? body.parsedRequirements : null)
          : existing.parsedRequirements,
        parsedAppointments: body.parsedAppointments !== undefined
          ? (Array.isArray(body.parsedAppointments) ? body.parsedAppointments : null)
          : existing.parsedAppointments,
      },
    })

    await tx.opportunityMatch.upsert({
      where: {
        opportunityId_organizationId: {
          opportunityId,
          organizationId,
        },
      },
      update: {
        verdict: existing.sourceId ? (existingMatch?.verdict || manualMatch.verdict) : manualMatch.verdict,
        fitScore: nextFitScore,
        matchedKeywords: existing.sourceId ? (existingMatch?.matchedKeywords || []) : manualMatch.matchedKeywords,
        matchReasons: existing.sourceId ? (existingMatch?.matchReasons || manualMatch.matchReasons) : manualMatch.matchReasons,
      },
      create: {
        organizationId,
        opportunityId,
        verdict: manualMatch.verdict,
        fitScore: nextFitScore,
        matchedKeywords: manualMatch.matchedKeywords,
        matchReasons: manualMatch.matchReasons,
      },
    })

    return tx.opportunity.findUnique({
      where: { id: opportunityId },
      include: getOpportunityInclude(organizationId),
    })
  })

  void logActivity(`Updated opportunity: ${updated.title}`, {
    userId: session.userId,
  })
  await expireCacheTags(dashboardCacheTag(organizationId))

  return Response.json(serializeOpportunity(updated))
}

export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const { id } = await params
  const opportunityId = parseInt(id, 10)
  const existing = await prisma.opportunity.findFirst({
    where: {
      id: opportunityId,
      organizationId,
    },
  })

  if (!existing) {
    return Response.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  if (existing.status === 'Converted') {
    return Response.json({ error: 'Converted opportunities cannot be deleted.' }, { status: 400 })
  }

  await prisma.opportunity.delete({ where: { id: opportunityId } })

  void logActivity(`Deleted opportunity: ${existing.title}`, {
    userId: session.userId,
  })
  await expireCacheTags(dashboardCacheTag(organizationId))

  return Response.json({ success: true })
}
