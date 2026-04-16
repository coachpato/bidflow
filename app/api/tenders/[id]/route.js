import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { findAssignedUser, notifyTenderAssignees } from '@/lib/tender-assignment'
import { ensureOrganizationContext } from '@/lib/organization'
import { refreshTenderQualification } from '@/lib/tender-qualification'
import { refreshSubmissionPack } from '@/lib/submission-pack'

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
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id } = await params
  const tenderId = parseInt(id)

  await refreshTenderQualification({
    tenderId,
    organizationId: organizationContext.organization.id,
  })
  await refreshSubmissionPack({
    tenderId,
    organizationId: organizationContext.organization.id,
  })

  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      createdBy: { select: { name: true, email: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      opportunity: { select: { id: true, title: true, status: true, sourceUrl: true, fitScore: true, estimatedValue: true, practiceArea: true } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      checklistItems: { orderBy: { id: 'asc' } },
      requirements: { orderBy: { label: 'asc' } },
      qualification: {
        include: {
          checks: { orderBy: { sortOrder: 'asc' } },
        },
      },
      generatedDocuments: { orderBy: [{ documentType: 'asc' }, { updatedAt: 'desc' }] },
      submissionPack: true,
      appeals: { orderBy: { createdAt: 'desc' } },
      contract: true,
    },
  })

  if (!tender) return Response.json({ error: 'Tender not found' }, { status: 404 })

  return Response.json(tender)
}

// PATCH /api/tenders/:id — update a tender
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id } = await params
  const body = await request.json()

  const existing = await prisma.tender.findUnique({ where: { id: parseInt(id) } })
  if (!existing) return Response.json({ error: 'Tender not found' }, { status: 404 })

  const assignment = await resolveAssignedFields(body, existing)

  const updated = await prisma.tender.update({
    where: { id: parseInt(id) },
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
    await logActivity(
      `Status changed from "${existing.status}" to "${body.status}" on tender: ${updated.title}`,
      { userId: session.userId, tenderId: updated.id }
    )
  } else {
    await logActivity(`Updated tender: ${updated.title}`, {
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

  await refreshTenderQualification({
    tenderId: updated.id,
    organizationId: organizationContext.organization.id,
  })
  await refreshSubmissionPack({
    tenderId: updated.id,
    organizationId: organizationContext.organization.id,
  })

  return Response.json(updated)
}

// DELETE /api/tenders/:id — delete a tender (admin only)
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params

  const existing = await prisma.tender.findUnique({ where: { id: parseInt(id) } })
  if (!existing) return Response.json({ error: 'Tender not found' }, { status: 404 })

  await logActivity(`Deleted tender: ${existing.title}`, { userId: session.userId })

  await prisma.tender.delete({ where: { id: parseInt(id) } })

  return Response.json({ success: true })
}
