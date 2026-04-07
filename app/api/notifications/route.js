import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'

// GET /api/notifications — get all notifications (newest first)
export async function GET() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const notifications = await prisma.notification.findMany({
    where: {
      OR: [{ userId: session.userId }, { userId: null }],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return Response.json(notifications)
}

// POST /api/notifications — create a notification (admin/system use)
export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, type, userId } = await request.json()

  const notification = await prisma.notification.create({
    data: {
      message,
      type: type || 'info',
      userId: userId || null,
    },
  })

  return Response.json(notification, { status: 201 })
}
