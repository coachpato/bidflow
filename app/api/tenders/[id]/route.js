import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { recordTenderStatusChange } from '@/lib/status-changes'
import { validateTenderTransition, ROLE_NAMES } from '@/lib/status-machine'
import { getUserRoleFromSession } from '@/lib/roles'
import {
  buildTenderStatusChangePayload,
  queueWebhook,
  WEBHOOK_EVENTS,
} from '@/lib/webhooks'
import {
  dashboardCacheTag,
  expireCacheTags,
  tenderDetailCacheTag,
  tenderPackCacheTag,
  tendersListCacheTag,
} from '@/lib/cache-tags'
import { findAssignedUser, notifyTenderAssignees } from '@/lib/tender-assignment'
import { getSessionOrganizationId } from '@/lib/organization'
import { findTenderForOrganization, parseRecordId } from '@/lib/tenders'
import { getCachedTenderDetail } from '@/lib/tender-read-model'

function parseAssignedUserId(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function toDateOrExisting(value, existingValue) {
  if (value === undefined) return existingValue
  if (!value) return null
  return new Date(value)
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

// GET /api/tenders/:id — get a single tender with all related data
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id } = await params
  const tenderId = parseRecordId(id)
  if (!tenderId) return Response.json({ error: 'Tender not found' }, { status: 404 })

  const tender = await getCachedTenderDetail({
    organizationId,
    tenderId,
  })

  if (!tender) return Response.json({ error: 'Tender not found' }, { status: 404 })

  return Response.json(tender)
}

// PATCH /api/tenders/:id — update a tender
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id } = await params
  const tenderId = parseRecordId(id)
  if (!tenderId) return Response.json({ error: 'Tender not found' }, { status: 404 })
  const body = await request.json()

  const existing = await findTenderForOrganization({
    tenderId,
    organizationId,
    select: {
      id: true,
      title: true,
      reference: true,
      entity: true,
      description: true,
      deadline: true,
      briefingDate: true,
      contactPerson: true,
      contactEmail: true,
      status: true,
      assignedTo: true,
      assignedUserId: true,
      notes: true,
    },
  })
  if (!existing) return Response.json({ error: 'Tender not found' }, { status: 404 })

  // =========================================================================
  // RBAC CHECK: Validate status transition with role-based access control
  // =========================================================================
  if (body.status && body.status !== existing.status) {
    // Get user's role from session and convert to numeric value
    const userRole = getUserRoleFromSession(session)

    // Validate transition including role permissions
    const validation = validateTenderTransition(existing.status, body.status, userRole)
    if (!validation.isValid) {
      // Return 403 Forbidden if permission issue, 400 for other validation errors
      const statusCode = validation.code === 'INSUFFICIENT_ROLE' ? 403 : 400
      return Response.json(
        {
          error: validation.error,
          code: validation.code,
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

  const updated = await prisma.tender.update({
    where: { id: tenderId },
    data: {
      title: body.title ?? existing.title,
      reference: body.reference ?? existing.reference,
      entity: body.entity ?? existing.entity,
      description: body.description ?? existing.description,
      deadline: toDateOrExisting(body.deadline, existing.deadline),
      briefingDate: toDateOrExisting(body.briefingDate, existing.briefingDate),
      contactPerson: body.contactPerson ?? existing.contactPerson,
      contactEmail: body.contactEmail ?? existing.contactEmail,
      status: body.status ?? existing.status,
      assignedTo: assignment.assignedTo,
      assignedUserId: assignment.assignedUserId,
      notes: body.notes ?? existing.notes,
    },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  })

  // Log status changes specifically
  if (body.status && body.status !== existing.status) {
    // Get user's role for logging purposes
    const userRole = getUserRoleFromSession(session)
    const userRoleName = ROLE_NAMES[userRole]

    void logActivity(
      `Status changed from "${existing.status}" to "${body.status}" on tender: ${updated.title} (by ${userRoleName})`,
      { userId: session.userId, tenderId: updated.id }
    )
    // Record the status change in audit trail with role information
    void recordTenderStatusChange({
      tenderId: updated.id,
      fromStatus: existing.status,
      toStatus: body.status,
      changedByUserId: session.userId,
      userRole: userRoleName, // Include role in audit trail
      reason: body.statusChangeReason || null,
    })

    // Dispatch webhooks to subscribed endpoints
    void dispatchStatusChangeWebhook({
      tender: updated,
      fromStatus: existing.status,
      toStatus: body.status,
      changedBy: session,
      reason: body.statusChangeReason,
      organizationId,
    })
  } else {
    void logActivity(`Updated tender: ${updated.title}`, {
      userId: session.userId,
      tenderId: updated.id,
    })
  }

  await notifyTenderAssignees({
    tender: updated,
    assignedUserId: updated.assignedUserId,
    assignedTo: updated.assignedTo,
    previousAssignedUserId: existing.assignedUserId,
    previousAssignedTo: existing.assignedTo,
    actorName: session.name,
  })
  await expireCacheTags(
    dashboardCacheTag(organizationId),
    tendersListCacheTag(organizationId),
    tenderDetailCacheTag(organizationId, tenderId),
    tenderPackCacheTag(organizationId, tenderId)
  )

  return Response.json(updated)
}

// DELETE /api/tenders/:id — delete a tender (admin only)
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id } = await params
  const tenderId = parseRecordId(id)
  if (!tenderId) return Response.json({ error: 'Tender not found' }, { status: 404 })

  const existing = await findTenderForOrganization({
    tenderId,
    organizationId,
    select: { id: true, title: true },
  })
  if (!existing) return Response.json({ error: 'Tender not found' }, { status: 404 })

  void logActivity(`Deleted tender: ${existing.title}`, { userId: session.userId })

  await prisma.tender.delete({ where: { id: tenderId } })
  await expireCacheTags(
    dashboardCacheTag(organizationId),
    tendersListCacheTag(organizationId),
    tenderDetailCacheTag(organizationId, tenderId),
    tenderPackCacheTag(organizationId, tenderId)
  )

  return Response.json({ success: true })
}

// Helper: Dispatch status change webhooks to subscribed endpoints
async function dispatchStatusChangeWebhook({
  tender,
  fromStatus,
  toStatus,
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
          has: 'tender.status_changed', // Only endpoints subscribed to status changes
        },
      },
    })

    if (endpoints.length === 0) return

    // Build payload
    const payload = buildTenderStatusChangePayload({
      tender,
      fromStatus,
      toStatus,
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
      void queueWebhook(prisma, {
        organizationId,
        event: 'tender.status_changed',
        payload,
        webhookUrl: endpoint.url,
      })
    }
  } catch (error) {
    console.error('Error dispatching status change webhooks:', error)
    // Don't throw - webhook failure shouldn't block the update
  }
}
