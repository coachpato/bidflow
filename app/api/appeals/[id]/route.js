import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { ensureOrganizationContext } from '@/lib/organization'

// GET /api/appeals/:id
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id } = await params
  const appeal = await prisma.appeal.findFirst({
    where: {
      id: parseInt(id, 10),
      organizationId: organizationContext.organization.id,
    },
    include: {
      tender: {
        select: {
          title: true,
          id: true,
          entity: true,
          reference: true,
          assignedUserId: true,
          assignedTo: true,
        },
      },
      documents: { orderBy: { uploadedAt: 'desc' } },
      activities: { orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { name: true } } } },
    },
  })

  if (!appeal) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json(appeal)
}

// PATCH /api/appeals/:id
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id } = await params
  const body = await request.json()

  const existing = await prisma.appeal.findFirst({
    where: {
      id: parseInt(id, 10),
      organizationId: organizationContext.organization.id,
    },
  })
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.appeal.update({
    where: { id: parseInt(id, 10) },
    data: {
      reason: body.reason ?? existing.reason,
      challengeType: body.challengeType ?? existing.challengeType,
      exclusionReason: body.exclusionReason ?? existing.exclusionReason,
      exclusionDate: body.exclusionDate ? new Date(body.exclusionDate) : body.exclusionDate === null ? null : existing.exclusionDate,
      deadline: body.deadline ? new Date(body.deadline) : body.deadline === null ? null : existing.deadline,
      deadlineReminderSentAt: body.deadline !== undefined && body.deadline !== existing.deadline
        ? null
        : existing.deadlineReminderSentAt,
      status: body.status ?? existing.status,
      submittedAt: body.submittedAt ? new Date(body.submittedAt) : body.submittedAt === null ? null : existing.submittedAt,
      resolvedAt: body.resolvedAt ? new Date(body.resolvedAt) : body.resolvedAt === null ? null : existing.resolvedAt,
      requestedRelief: body.requestedRelief ?? existing.requestedRelief,
      nextStep: body.nextStep ?? existing.nextStep,
      evidenceChecklist: Array.isArray(body.evidenceChecklist) ? body.evidenceChecklist : body.evidenceChecklist === null ? null : existing.evidenceChecklist,
      notes: body.notes ?? existing.notes,
      template: body.template ?? existing.template,
    },
  })

  await logActivity(`Updated appeal: ${updated.reason.substring(0, 60)}`, {
    userId: session.userId,
    appealId: updated.id,
  })

  return Response.json(updated)
}

// DELETE /api/appeals/:id
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id } = await params
  const appealId = parseInt(id, 10)
  const existing = await prisma.appeal.findFirst({
    where: {
      id: appealId,
      organizationId: organizationContext.organization.id,
    },
  })

  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  await prisma.appeal.delete({ where: { id: appealId } })

  return Response.json({ success: true })
}
