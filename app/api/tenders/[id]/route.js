import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { notifyTenderAssignees } from '@/lib/tender-assignment'

// GET /api/tenders/:id — get a single tender with all related data
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const tender = await prisma.tender.findUnique({
    where: { id: parseInt(id) },
    include: {
      createdBy: { select: { name: true, email: true } },
      documents: { orderBy: { uploadedAt: 'desc' } },
      checklistItems: { orderBy: { id: 'asc' } },
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

  const { id } = await params
  const body = await request.json()

  const existing = await prisma.tender.findUnique({ where: { id: parseInt(id) } })
  if (!existing) return Response.json({ error: 'Tender not found' }, { status: 404 })

  const updated = await prisma.tender.update({
    where: { id: parseInt(id) },
    data: {
      title: body.title ?? existing.title,
      reference: body.reference ?? existing.reference,
      entity: body.entity ?? existing.entity,
      description: body.description ?? existing.description,
      deadline: body.deadline ? new Date(body.deadline) : existing.deadline,
      briefingDate: body.briefingDate ? new Date(body.briefingDate) : existing.briefingDate,
      contactPerson: body.contactPerson ?? existing.contactPerson,
      contactEmail: body.contactEmail ?? existing.contactEmail,
      status: body.status ?? existing.status,
      assignedTo: body.assignedTo ?? existing.assignedTo,
      notes: body.notes ?? existing.notes,
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
    assignedTo: updated.assignedTo,
    previousAssignedTo: existing.assignedTo,
    actorName: session.name,
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
