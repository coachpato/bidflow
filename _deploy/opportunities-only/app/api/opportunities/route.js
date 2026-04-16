import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

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

export async function GET(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const where = {}

  if (status && status !== 'All') {
    where.status = status
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { reference: { contains: search } },
      { entity: { contains: search } },
      { practiceArea: { contains: search } },
    ]
  }

  const opportunities = await prisma.opportunity.findMany({
    where,
    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
    include: {
      createdBy: { select: { name: true } },
      tender: { select: { id: true, title: true, status: true } },
      _count: { select: { documents: true } },
    },
  })

  return Response.json(opportunities)
}

export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  if (!body.title || !body.entity) {
    return Response.json({ error: 'Title and issuing entity are required.' }, { status: 400 })
  }

  const opportunity = await prisma.opportunity.create({
    data: {
      title: body.title,
      reference: toNullableString(body.reference),
      entity: body.entity,
      sourceName: toNullableString(body.sourceName) || 'eTenders.gov.za',
      sourceUrl: toNullableString(body.sourceUrl),
      practiceArea: toNullableString(body.practiceArea),
      summary: toNullableString(body.summary),
      estimatedValue: toNullableNumber(body.estimatedValue),
      deadline: toNullableDate(body.deadline),
      briefingDate: toNullableDate(body.briefingDate),
      siteVisitDate: toNullableDate(body.siteVisitDate),
      contactPerson: toNullableString(body.contactPerson),
      contactEmail: toNullableString(body.contactEmail),
      fitScore: toNullableInt(body.fitScore),
      status: toNullableString(body.status) || 'New',
      notes: toNullableString(body.notes),
      parsedRequirements: Array.isArray(body.parsedRequirements) ? body.parsedRequirements : null,
      parsedAppointments: Array.isArray(body.parsedAppointments) ? body.parsedAppointments : null,
      userId: session.userId,
    },
    include: {
      tender: { select: { id: true, title: true, status: true } },
      _count: { select: { documents: true } },
    },
  })

  await logActivity(`Captured opportunity: ${opportunity.title}`, {
    userId: session.userId,
  })

  return Response.json(opportunity, { status: 201 })
}
