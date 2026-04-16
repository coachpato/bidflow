import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { ensureOrganizationContext } from '@/lib/organization'
import { refreshTenderQualification } from '@/lib/tender-qualification'
import { refreshSubmissionPack } from '@/lib/submission-pack'

// PATCH /api/tenders/:id/checklist/:itemId — update item (toggle done, etc.)
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id, itemId } = await params
  const body = await request.json()

  const item = await prisma.tenderChecklistItem.update({
    where: { id: parseInt(itemId) },
    data: {
      done: body.done !== undefined ? body.done : undefined,
      label: body.label || undefined,
      responsible: body.responsible !== undefined ? body.responsible : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
    },
  })

  if (body.done !== undefined) {
    await logActivity(
      `Checklist item "${item.label}" marked as ${item.done ? 'done' : 'not done'}`,
      { userId: session.userId, tenderId: parseInt(id) }
    )
  }

  await refreshTenderQualification({
    tenderId: parseInt(id),
    organizationId: organizationContext.organization.id,
  })
  await refreshSubmissionPack({
    tenderId: parseInt(id),
    organizationId: organizationContext.organization.id,
  })

  return Response.json(item)
}

// DELETE /api/tenders/:id/checklist/:itemId
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id, itemId } = await params

  await prisma.tenderChecklistItem.delete({ where: { id: parseInt(itemId) } })

  await refreshTenderQualification({
    tenderId: parseInt(id),
    organizationId: organizationContext.organization.id,
  })
  await refreshSubmissionPack({
    tenderId: parseInt(id),
    organizationId: organizationContext.organization.id,
  })

  return Response.json({ success: true })
}
