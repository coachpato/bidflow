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

function toNullableString(value) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function toNullableNumber(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toNullableInt(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function toNullableDate(value) {
  if (value === undefined) return undefined
  if (!value) return null

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function serializeOpportunity(opportunity) {
  const [match] = opportunity.matches || []

  return {
    ...opportunity,
    match: match || null,
    matches: undefined,
  }
}

function getOpportunityInclude(organizationId) {
  return {
    createdBy: { select: { name: true } },
    source: { select: { id: true, key: true, name: true, type: true } },
    matches: {
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    },
    tender: { select: { id: true, title: true, status: true } },
    _count: { select: { documents: true } },
  }
}

export async function GET(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const where = {
    organizationId,
  }

  if (status && status !== 'All') {
    where.status = normalizeOpportunityStatus(status)
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { reference: { contains: search } },
      { entity: { contains: search } },
      { practiceArea: { contains: search } },
      { sourceName: { contains: search } },
      { category: { contains: search } },
    ]
  }

  const opportunities = await prisma.opportunity.findMany({
    where,
    orderBy: [{ deadline: 'asc' }, { fitScore: 'desc' }, { createdAt: 'desc' }],
    include: getOpportunityInclude(organizationId),
  })

  return Response.json(opportunities.map(serializeOpportunity), {
    headers: {
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const body = await request.json()

  if (!body.title || !body.entity) {
    return Response.json({ error: 'Title and issuing entity are required.' }, { status: 400 })
  }

  const deadline = toNullableDate(body.deadline)
  const fitScore = toNullableInt(body.fitScore)
  const normalizedStatus = normalizeOpportunityStatus(body.status)
  const manualMatch = buildManualMatchData({
    title: body.title,
    entity: body.entity,
    practiceArea: toNullableString(body.practiceArea),
    fitScore,
  })

  const dedupeKey = buildOpportunityDedupeKey({
    organizationId,
    sourceKey: toNullableString(body.sourceName) || 'manual',
    externalId: toNullableString(body.reference),
    title: body.title,
    entity: body.entity,
    deadline,
  })

  const existingOpportunity = await prisma.opportunity.findUnique({
    where: {
      organizationId_dedupeKey: {
        organizationId,
        dedupeKey,
      },
    },
    include: getOpportunityInclude(organizationId),
  })

  if (existingOpportunity) {
    return Response.json({
      error: 'This opportunity already exists in your radar.',
      opportunity: serializeOpportunity(existingOpportunity),
    }, { status: 409 })
  }

  const opportunity = await prisma.opportunity.create({
    data: {
      organizationId,
      title: body.title,
      reference: toNullableString(body.reference),
      externalId: toNullableString(body.reference),
      dedupeKey,
      entity: body.entity,
      sourceName: toNullableString(body.sourceName) || 'Manual intake',
      sourceUrl: toNullableString(body.sourceUrl),
      category: toNullableString(body.category),
      practiceArea: manualMatch.practiceArea,
      summary: toNullableString(body.summary),
      estimatedValue: toNullableNumber(body.estimatedValue),
      publishedAt: toNullableDate(body.publishedAt),
      deadline,
      briefingDate: toNullableDate(body.briefingDate),
      siteVisitDate: toNullableDate(body.siteVisitDate),
      contactPerson: toNullableString(body.contactPerson),
      contactEmail: toNullableString(body.contactEmail),
      fitScore,
      status: normalizedStatus,
      notes: toNullableString(body.notes),
      parsedRequirements: Array.isArray(body.parsedRequirements) ? body.parsedRequirements : null,
      parsedAppointments: Array.isArray(body.parsedAppointments) ? body.parsedAppointments : null,
      userId: session.userId,
      matches: {
        create: {
          organizationId,
          verdict: manualMatch.verdict,
          fitScore,
          matchedKeywords: manualMatch.matchedKeywords,
          matchReasons: manualMatch.matchReasons,
        },
      },
    },
    include: getOpportunityInclude(organizationId),
  })

  void logActivity(`Captured opportunity: ${opportunity.title}`, {
    userId: session.userId,
  })
  await expireCacheTags(dashboardCacheTag(organizationId))

  return Response.json(serializeOpportunity(opportunity), { status: 201 })
}
