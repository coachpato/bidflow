import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'

// PATCH /api/notifications/:id — mark as read
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const updated = await prisma.notification.update({
    where: { id: parseInt(id) },
    data: { read: true },
  })

  return Response.json(updated)
}

// DELETE /api/notifications/:id
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.notification.delete({ where: { id: parseInt(id) } })

  return Response.json({ success: true })
}
