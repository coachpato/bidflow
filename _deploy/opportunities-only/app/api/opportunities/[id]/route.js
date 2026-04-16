import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

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

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: parseInt(id, 10) },
    include: {
      createdBy: { select: { name: true, email: true } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      tender: { select: { id: true, title: true, status: true } },
    },
  })

  if (!opportunity) {
    return Response.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  return Response.json(opportunity)
}

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const opportunityId = parseInt(id, 10)
  const body = await request.json()

  const existing = await prisma.opportunity.findUnique({ where: { id: opportunityId } })
  if (!existing) {
    return Response.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  const updated = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      title: body.title ?? existing.title,
      reference: toNullableString(body.reference, existing.reference),
      entity: body.entity ?? existing.entity,
      sourceName: toNullableString(body.sourceName, existing.sourceName) || 'eTenders.gov.za',
      sourceUrl: toNullableString(body.sourceUrl, existing.sourceUrl),
      practiceArea: toNullableString(body.practiceArea, existing.practiceArea),
      summary: toNullableString(body.summary, existing.summary),
      estimatedValue: toNullableNumber(body.estimatedValue, existing.estimatedValue),
      deadline: toNullableDate(body.deadline, existing.deadline),
      briefingDate: toNullableDate(body.briefingDate, existing.briefingDate),
      siteVisitDate: toNullableDate(body.siteVisitDate, existing.siteVisitDate),
      contactPerson: toNullableString(body.contactPerson, existing.contactPerson),
      contactEmail: toNullableString(body.contactEmail, existing.contactEmail),
      fitScore: toNullableInt(body.fitScore, existing.fitScore),
      status: toNullableString(body.status, existing.status) || 'New',
      notes: toNullableString(body.notes, existing.notes),
      parsedRequirements: body.parsedRequirements !== undefined
        ? (Array.isArray(body.parsedRequirements) ? body.parsedRequirements : null)
        : existing.parsedRequirements,
      parsedAppointments: body.parsedAppointments !== undefined
        ? (Array.isArray(body.parsedAppointments) ? body.parsedAppointments : null)
        : existing.parsedAppointments,
    },
    include: {
      createdBy: { select: { name: true, email: true } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      tender: { select: { id: true, title: true, status: true } },
    },
  })

  await logActivity(`Updated opportunity: ${updated.title}`, {
    userId: session.userId,
  })

  return Response.json(updated)
}

export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const opportunityId = parseInt(id, 10)
  const existing = await prisma.opportunity.findUnique({ where: { id: opportunityId } })

  if (!existing) {
    return Response.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  if (existing.status === 'Converted') {
    return Response.json({ error: 'Converted opportunities cannot be deleted.' }, { status: 400 })
  }

  await prisma.opportunity.delete({ where: { id: opportunityId } })

  await logActivity(`Deleted opportunity: ${existing.title}`, {
    userId: session.userId,
  })

  return Response.json({ success: true })
}
