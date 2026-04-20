import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { expireCacheTags, tendersListCacheTag } from '@/lib/cache-tags'
import { getSessionOrganizationId } from '@/lib/organization'
import { parseRecordId } from '@/lib/tenders'

// PATCH /api/tenders/:id/checklist/:itemId — update item (toggle done, etc.)
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id, itemId } = await params
  const tenderId = parseRecordId(id)
  const checklistItemId = parseRecordId(itemId)
  if (!tenderId || !checklistItemId) return Response.json({ error: 'Checklist item not found' }, { status: 404 })
  const body = await request.json()

  const existing = await prisma.tenderChecklistItem.findFirst({
    where: {
      id: checklistItemId,
      tenderId,
      tender: { organizationId },
    },
    select: {
      id: true,
      label: true,
    },
  })

  if (!existing) {
    return Response.json({ error: 'Checklist item not found' }, { status: 404 })
  }

  const item = await prisma.tenderChecklistItem.update({
    where: { id: checklistItemId },
    data: {
      done: body.done !== undefined ? body.done : undefined,
      label: body.label || undefined,
      responsible: body.responsible !== undefined ? body.responsible : undefined,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
    },
  })

  if (body.done !== undefined) {
    void logActivity(
      `Checklist item "${item.label}" marked as ${item.done ? 'done' : 'not done'}`,
      { userId: session.userId, tenderId }
    )
  }

  await expireCacheTags(tendersListCacheTag(organizationId))

  return Response.json(item)
}

// DELETE /api/tenders/:id/checklist/:itemId
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id, itemId } = await params
  const tenderId = parseRecordId(id)
  const checklistItemId = parseRecordId(itemId)
  if (!tenderId || !checklistItemId) return Response.json({ error: 'Checklist item not found' }, { status: 404 })

  const existing = await prisma.tenderChecklistItem.findFirst({
    where: {
      id: checklistItemId,
      tenderId,
      tender: { organizationId },
    },
    select: { id: true },
  })

  if (!existing) {
    return Response.json({ error: 'Checklist item not found' }, { status: 404 })
  }

  await prisma.tenderChecklistItem.delete({ where: { id: checklistItemId } })

  await expireCacheTags(tendersListCacheTag(organizationId))

  return Response.json({ success: true })
}
