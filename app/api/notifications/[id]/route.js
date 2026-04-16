import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { ensureOrganizationContext } from '@/lib/organization'

async function getAuthorizedNotification(id, userId) {
  const organizationContext = await ensureOrganizationContext(userId)

  return prisma.notification.findFirst({
    where: {
      id,
      AND: [
        { OR: [{ userId }, { userId: null }] },
        { OR: [{ organizationId: organizationContext.organization.id }, { organizationId: null }] },
      ],
    },
  })
}

export async function PATCH(_request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const notificationId = Number.parseInt(id, 10)
  if (Number.isNaN(notificationId)) return Response.json({ error: 'Invalid notification id.' }, { status: 400 })

  const notification = await getAuthorizedNotification(notificationId, session.userId)
  if (!notification) return Response.json({ error: 'Notification not found.' }, { status: 404 })

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  })

  return Response.json(updated)
}

export async function DELETE(_request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const notificationId = Number.parseInt(id, 10)
  if (Number.isNaN(notificationId)) return Response.json({ error: 'Invalid notification id.' }, { status: 400 })

  const notification = await getAuthorizedNotification(notificationId, session.userId)
  if (!notification) return Response.json({ error: 'Notification not found.' }, { status: 404 })

  await prisma.notification.delete({
    where: { id: notificationId },
  })

  return Response.json({ success: true })
}
