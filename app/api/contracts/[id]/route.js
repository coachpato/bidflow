import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
import { notifyContractAssignees } from '@/lib/contract-notifications'
import { findAssignedUser } from '@/lib/tender-assignment'
import { getSessionOrganizationId } from '@/lib/organization'

function toDateOrExisting(value, existingValue) {
  if (value === undefined) return existingValue
  if (!value) return null
  return new Date(value)
}

function sameDate(left, right) {
  if (!left && !right) return true
  if (!left || !right) return false
  return new Date(left).getTime() === new Date(right).getTime()
}

function toNullableNumber(value, existingValue) {
  if (value === undefined) return existingValue
  if (value === null || value === '') return null
  return parseFloat(value)
}

function parseAssignedUserId(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

async function resolveAssignedFields(body, existing) {
  const assignedUserId = parseAssignedUserId(body.assignedUserId)

  if (body.assignedUserId === undefined) {
    return {
      assignedUserId: existing.assignedUserId,
      assignedTo: body.assignedTo !== undefined ? body.assignedTo?.trim() || null : existing.assignedTo,
    }
  }

  if (assignedUserId) {
    const assignedUser = await findAssignedUser(assignedUserId)

    if (assignedUser) {
      return {
        assignedUserId: assignedUser.id,
        assignedTo: assignedUser.name || assignedUser.email,
      }
    }
  }

  return {
    assignedUserId: null,
    assignedTo: body.assignedTo?.trim() || null,
  }
}

// GET /api/contracts/:id
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id } = await params
  const contract = await prisma.contract.findFirst({
    where: {
      id: parseInt(id, 10),
      organizationId,
    },
    include: {
      tender: { select: { title: true, id: true, entity: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      milestones: { orderBy: [{ completedAt: 'asc' }, { dueDate: 'asc' }, { id: 'asc' }] },
      activities: { orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { name: true } } } },
    },
  })

  if (!contract) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json(contract)
}

// PATCH /api/contracts/:id
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id } = await params
  const contractId = parseInt(id, 10)
  const body = await request.json()

  const existing = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId,
    },
  })
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  const assignment = await resolveAssignedFields(body, existing)

  const updated = await prisma.contract.update({
    where: { id: contractId },
    data: {
      title: body.title ?? existing.title,
      client: body.client ?? existing.client,
      assignedTo: assignment.assignedTo,
      assignedUserId: assignment.assignedUserId,
      appointmentStatus: body.appointmentStatus ?? existing.appointmentStatus,
      instructionStatus: body.instructionStatus ?? existing.instructionStatus,
      appointmentDate: toDateOrExisting(body.appointmentDate, existing.appointmentDate),
      startDate: toDateOrExisting(body.startDate, existing.startDate),
      endDate: toDateOrExisting(body.endDate, existing.endDate),
      endDateReminderSentAt: body.endDate !== undefined && !sameDate(body.endDate, existing.endDate)
        ? null
        : existing.endDateReminderSentAt,
      renewalDate: toDateOrExisting(body.renewalDate, existing.renewalDate),
      renewalDateReminderSentAt: body.renewalDate !== undefined && !sameDate(body.renewalDate, existing.renewalDate)
        ? null
        : existing.renewalDateReminderSentAt,
      cancelDate: toDateOrExisting(body.cancelDate, existing.cancelDate),
      firstInstructionDate: toDateOrExisting(body.firstInstructionDate, existing.firstInstructionDate),
      lastFollowUpAt: toDateOrExisting(body.lastFollowUpAt, existing.lastFollowUpAt),
      nextFollowUpAt: toDateOrExisting(body.nextFollowUpAt, existing.nextFollowUpAt),
      nextFollowUpReminderSentAt: body.nextFollowUpAt !== undefined && !sameDate(body.nextFollowUpAt, existing.nextFollowUpAt)
        ? null
        : existing.nextFollowUpReminderSentAt,
      dormantReminderSentAt: body.instructionStatus !== undefined && body.instructionStatus !== existing.instructionStatus
        ? null
        : existing.dormantReminderSentAt,
      value: toNullableNumber(body.value, existing.value),
      milestoneSummary: body.milestoneSummary ?? existing.milestoneSummary,
      notes: body.notes ?? existing.notes,
    },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  })

  await logActivity(`Updated contract: ${updated.title}`, {
    userId: session.userId,
    contractId: updated.id,
  })

  await notifyContractAssignees({
    contract: updated,
    assignedUserId: updated.assignedUserId,
    assignedTo: updated.assignedTo,
    previousAssignedUserId: existing.assignedUserId,
    previousAssignedTo: existing.assignedTo,
    actorName: session.name,
  })
  await expireCacheTags(dashboardCacheTag(organizationId))

  return Response.json(updated)
}

// DELETE /api/contracts/:id
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id } = await params
  const contractId = parseInt(id, 10)
  const existing = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId,
    },
  })
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  await logActivity(`Deleted contract: ${existing.title}`, { userId: session.userId })
  await prisma.contract.delete({ where: { id: contractId } })
  await expireCacheTags(dashboardCacheTag(organizationId))

  return Response.json({ success: true })
}
