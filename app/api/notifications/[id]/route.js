import { getSession } from '@/lib/session'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
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
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id } = await params
  const notificationId = Number.parseInt(id, 10)
  if (Number.isNaN(notificationId)) return Response.json({ error: 'Invalid notification id.' }, { status: 400 })

  const notification = await getAuthorizedNotification(notificationId, session.userId)
  if (!notification) return Response.json({ error: 'Notification not found.' }, { status: 404 })

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  })

  await expireCacheTags(dashboardCacheTag(organizationContext.organization.id))

  return Response.json(updated)
}

export async function DELETE(_request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id } = await params
  const notificationId = Number.parseInt(id, 10)
  if (Number.isNaN(notificationId)) return Response.json({ error: 'Invalid notification id.' }, { status: 400 })

  const notification = await getAuthorizedNotification(notificationId, session.userId)
  if (!notification) return Response.json({ error: 'Notification not found.' }, { status: 404 })

  await prisma.notification.delete({
    where: { id: notificationId },
  })

  await expireCacheTags(dashboardCacheTag(organizationContext.organization.id))

  return Response.json({ success: true })
}
