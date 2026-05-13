import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { recordContractStatusChange } from '@/lib/status-changes'
import {
  validateContractAppointmentTransition,
  validateContractInstructionTransition,
  ROLE_NAMES,
} from '@/lib/status-machine'
import { getUserRoleFromSession } from '@/lib/roles'
import {
  buildContractStatusChangePayload,
  queueWebhook,
} from '@/lib/webhooks'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
import { notifyContractAssignees } from '@/lib/contract-notifications'
import { findAssignedUser } from '@/lib/tender-assignment'
import { getSessionOrganizationId } from '@/lib/organization'
import { addSignedDocumentUrlsToList } from '@/lib/supabase'

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
  if (!organizationId) return Response.json({ error: 'Organisation context is missing.' }, { status: 400 })

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

  return Response.json({
    ...contract,
    documents: await addSignedDocumentUrlsToList(contract.documents),
  })
}

// PATCH /api/contracts/:id
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organisation context is missing.' }, { status: 400 })

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

  // =========================================================================
  // RBAC CHECK: Validate status transitions with role-based access control
  // =========================================================================
  // Get user's role once (used for both status fields)
  const userRole = getUserRoleFromSession(session)

  if (body.appointmentStatus && body.appointmentStatus !== existing.appointmentStatus) {
    const validation = validateContractAppointmentTransition(
      existing.appointmentStatus,
      body.appointmentStatus,
      userRole
    )
    if (!validation.isValid) {
      const statusCode = validation.code === 'INSUFFICIENT_ROLE' ? 403 : 400
      return Response.json(
        {
          error: validation.error,
          code: validation.code,
          field: 'appointmentStatus',
          ...(validation.code === 'INSUFFICIENT_ROLE' && {
            requiredRole: ROLE_NAMES[validation.requiredRole],
            userRole: ROLE_NAMES[validation.userRole],
          }),
        },
        { status: statusCode }
      )
    }
  }

  if (body.instructionStatus && body.instructionStatus !== existing.instructionStatus) {
    const validation = validateContractInstructionTransition(
      existing.instructionStatus,
      body.instructionStatus,
      userRole
    )
    if (!validation.isValid) {
      const statusCode = validation.code === 'INSUFFICIENT_ROLE' ? 403 : 400
      return Response.json(
        {
          error: validation.error,
          code: validation.code,
          field: 'instructionStatus',
          ...(validation.code === 'INSUFFICIENT_ROLE' && {
            requiredRole: ROLE_NAMES[validation.requiredRole],
            userRole: ROLE_NAMES[validation.userRole],
          }),
        },
        { status: statusCode }
      )
    }
  }

  const assignment = await resolveAssignedFields(body, existing)

  // Determine new status values
  const newAppointmentStatus = body.appointmentStatus ?? existing.appointmentStatus
  const newInstructionStatus = body.instructionStatus ?? existing.instructionStatus

  const updated = await prisma.contract.update({
    where: { id: contractId },
    data: {
      title: body.title ?? existing.title,
      client: body.client ?? existing.client,
      assignedTo: assignment.assignedTo,
      assignedUserId: assignment.assignedUserId,
      appointmentStatus: newAppointmentStatus,
      instructionStatus: newInstructionStatus,
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

  // Record status changes with role information for audit trail
  const userRoleName = ROLE_NAMES[userRole]

  if (newAppointmentStatus !== existing.appointmentStatus) {
    void recordContractStatusChange({
      contractId: updated.id,
      fieldName: 'appointmentStatus',
      oldValue: existing.appointmentStatus,
      newValue: newAppointmentStatus,
      changedByUserId: session.userId,
      userRole: userRoleName, // Include role in audit trail
      reason: body.statusChangeReason || null,
    })

    // Dispatch webhook
    void dispatchContractStatusChangeWebhook({
      contract: updated,
      fieldName: 'appointmentStatus',
      oldValue: existing.appointmentStatus,
      newValue: newAppointmentStatus,
      changedBy: session,
      userRole: userRoleName, // Include role in webhook payload
      reason: body.statusChangeReason,
      organizationId,
    })
  }

  if (newInstructionStatus !== existing.instructionStatus) {
    void recordContractStatusChange({
      contractId: updated.id,
      fieldName: 'instructionStatus',
      oldValue: existing.instructionStatus,
      newValue: newInstructionStatus,
      changedByUserId: session.userId,
      userRole: userRoleName, // Include role in audit trail
      reason: body.statusChangeReason || null,
    })

    // Dispatch webhook
    void dispatchContractStatusChangeWebhook({
      contract: updated,
      fieldName: 'instructionStatus',
      oldValue: existing.instructionStatus,
      newValue: newInstructionStatus,
      changedBy: session,
      userRole: userRoleName, // Include role in webhook payload
      reason: body.statusChangeReason,
      organizationId,
    })
  }

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
  if (!organizationId) return Response.json({ error: 'Organisation context is missing.' }, { status: 400 })

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

// Helper: Dispatch contract status change webhooks to subscribed endpoints
async function dispatchContractStatusChangeWebhook({
  contract,
  fieldName,
  oldValue,
  newValue,
  changedBy,
  reason,
  organizationId,
}) {
  try {
    // Get all active webhook endpoints for this organization
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        organizationId,
        isActive: true,
        events: {
          hasSome: [
            `contract.${fieldName === 'appointmentStatus' ? 'appointment_status' : 'instruction_status'}_changed`,
            'contract.status_changed', // Wildcard subscription
          ],
        },
      },
    })

    if (endpoints.length === 0) return

    // Build payload
    const payload = buildContractStatusChangePayload({
      contract,
      fieldName,
      oldValue,
      newValue,
      changedBy: {
        id: changedBy.userId,
        name: changedBy.name,
        email: changedBy.email,
      },
      reason,
      organizationId,
    })

    // Queue webhooks for async dispatch
    for (const endpoint of endpoints) {
      const eventName = fieldName === 'appointmentStatus'
        ? 'contract.appointment_status_changed'
        : 'contract.instruction_status_changed'

      void queueWebhook(prisma, {
        organizationId,
        event: eventName,
        payload,
        webhookUrl: endpoint.url,
      })
    }
  } catch (error) {
    console.error('Error dispatching contract status change webhooks:', error)
    // Don't throw - webhook failure shouldn't block the update
  }
}
