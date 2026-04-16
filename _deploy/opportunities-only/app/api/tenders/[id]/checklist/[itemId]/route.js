import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

// PATCH /api/tenders/:id/checklist/:itemId — update item (toggle done, etc.)
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

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

  return Response.json(item)
}

// DELETE /api/tenders/:id/checklist/:itemId
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId } = await params

  await prisma.tenderChecklistItem.delete({ where: { id: parseInt(itemId) } })

  return Response.json({ success: true })
}
