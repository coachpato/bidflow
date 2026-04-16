import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { ensureOrganizationContext } from '@/lib/organization'

function toNullableDate(value, existingValue) {
  if (value === undefined) return existingValue
  if (value === null || value === '') return null
  return new Date(value)
}

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id, milestoneId } = await params
  const contractId = parseInt(id, 10)
  const parsedMilestoneId = parseInt(milestoneId, 10)
  const body = await request.json()

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId: organizationContext.organization.id,
    },
    select: { id: true },
  })

  if (!contract) return Response.json({ error: 'Appointment not found.' }, { status: 404 })

  const existing = await prisma.contractMilestone.findFirst({
    where: {
      id: parsedMilestoneId,
      contractId,
    },
  })

  if (!existing) return Response.json({ error: 'Milestone not found.' }, { status: 404 })

  const milestone = await prisma.contractMilestone.update({
    where: { id: parsedMilestoneId },
    data: {
      title: body.title?.trim() || existing.title,
      dueDate: toNullableDate(body.dueDate, existing.dueDate),
      completedAt: toNullableDate(body.completedAt, existing.completedAt),
      reminderSentAt: body.dueDate !== undefined ? null : existing.reminderSentAt,
      notes: body.notes !== undefined ? body.notes?.trim() || null : existing.notes,
    },
  })

  await logActivity(`Updated appointment milestone: ${milestone.title}`, {
    userId: session.userId,
    contractId,
  })

  return Response.json(milestone)
}

export async function DELETE(_request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id, milestoneId } = await params
  const contractId = parseInt(id, 10)
  const parsedMilestoneId = parseInt(milestoneId, 10)

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId: organizationContext.organization.id,
    },
    select: { id: true },
  })

  if (!contract) return Response.json({ error: 'Appointment not found.' }, { status: 404 })

  const existing = await prisma.contractMilestone.findFirst({
    where: {
      id: parsedMilestoneId,
      contractId,
    },
  })

  if (!existing) return Response.json({ error: 'Milestone not found.' }, { status: 404 })

  await prisma.contractMilestone.delete({
    where: { id: parsedMilestoneId },
  })

  await logActivity(`Removed appointment milestone: ${existing.title}`, {
    userId: session.userId,
    contractId,
  })

  return Response.json({ success: true })
}
