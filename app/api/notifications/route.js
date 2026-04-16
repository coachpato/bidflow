import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { ensureOrganizationContext } from '@/lib/organization'
import { syncComplianceExpiryNotifications } from '@/lib/compliance-documents'

// GET /api/notifications — get all notifications (newest first)
export async function GET() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationContext = await ensureOrganizationContext(session.userId)
  await syncComplianceExpiryNotifications(organizationContext.organization.id)

  const notifications = await prisma.notification.findMany({
    where: {
      AND: [
        { OR: [{ userId: session.userId }, { userId: null }] },
        { OR: [{ organizationId: organizationContext.organization.id }, { organizationId: null }] },
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

  const organizationContext = await ensureOrganizationContext(session.userId)
  const body = await request.json().catch(() => ({}))

  if (body?.action !== 'markAllRead') {
    return Response.json({ error: 'Unsupported action.' }, { status: 400 })
  }

  const result = await prisma.notification.updateMany({
    where: {
      read: false,
      AND: [
        { OR: [{ userId: session.userId }, { userId: null }] },
        { OR: [{ organizationId: organizationContext.organization.id }, { organizationId: null }] },
      ],
    },
    data: {
      read: true,
    },
  })

  return Response.json({ success: true, updatedCount: result.count })
}

// POST /api/notifications — create a notification (admin/system use)
export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationContext = await ensureOrganizationContext(session.userId)
  const { title, message, type, userId, linkUrl, linkLabel } = await request.json()

  const notification = await prisma.notification.create({
    data: {
      title: title || null,
      message,
      type: type || 'info',
      userId: userId || null,
      organizationId: organizationContext.organization.id,
      linkUrl: linkUrl || null,
      linkLabel: linkLabel || null,
    },
  })

  return Response.json(notification, { status: 201 })
}
