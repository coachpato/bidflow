import { after } from 'next/server'
import { getSession } from '@/lib/session'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
import prisma from '@/lib/prisma'
import { getSessionOrganizationId } from '@/lib/organization'
import { syncComplianceExpiryNotificationsIfNeededSafely } from '@/lib/compliance-documents'

// GET /api/notifications — get all notifications (newest first)
export async function GET() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  after(async () => {
    const syncedDocuments = await syncComplianceExpiryNotificationsIfNeededSafely(organizationId)
    if (syncedDocuments) {
      await expireCacheTags(dashboardCacheTag(organizationId))
    }
  })

  const notifications = await prisma.notification.findMany({
    where: {
      AND: [
        { OR: [{ userId: session.userId }, { userId: null }] },
        { OR: [{ organizationId }, { organizationId: null }] },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return Response.json(notifications)
}

export async function PATCH(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const body = await request.json().catch(() => ({}))

  if (body?.action !== 'markAllRead') {
    return Response.json({ error: 'Unsupported action.' }, { status: 400 })
  }

  const result = await prisma.notification.updateMany({
    where: {
      read: false,
      AND: [
        { OR: [{ userId: session.userId }, { userId: null }] },
        { OR: [{ organizationId }, { organizationId: null }] },
      ],
    },
    data: {
      read: true,
    },
  })

  await expireCacheTags(dashboardCacheTag(organizationId))

  return Response.json({ success: true, updatedCount: result.count })
}

// POST /api/notifications — create a notification (admin/system use)
export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const { title, message, type, userId, linkUrl, linkLabel } = await request.json()

  const notification = await prisma.notification.create({
    data: {
      title: title || null,
      message,
      type: type || 'info',
      userId: userId || null,
      organizationId,
      linkUrl: linkUrl || null,
      linkLabel: linkLabel || null,
    },
  })

  await expireCacheTags(dashboardCacheTag(organizationId))

  return Response.json(notification, { status: 201 })
}
