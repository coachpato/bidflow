import prisma from '@/lib/prisma'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
import { sendPursuitDeadlineAlert } from '@/lib/bid360-notifications'
import { getSession } from '@/lib/session'

const REMINDER_WINDOW_HOURS = 48

function isAuthorizedCron(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    const session = await getSession()
    if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })
  }

  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000)

  const pursuits = await prisma.tender.findMany({
    where: {
      status: {
        in: ['New', 'Under Review', 'In Progress', 'Submitted'],
      },
      deadline: {
        gte: now,
        lte: windowEnd,
      },
      deadlineReminderSentAt: null,
    },
    select: {
      id: true,
      title: true,
      entity: true,
      deadline: true,
      assignedUserId: true,
      assignedTo: true,
      organizationId: true,
    },
    orderBy: { deadline: 'asc' },
  })

  let remindersSent = 0
  const touchedOrganizationIds = new Set()

  for (const pursuit of pursuits) {
    await sendPursuitDeadlineAlert({
      organizationId: pursuit.organizationId,
      pursuit,
    })

    await prisma.tender.update({
      where: { id: pursuit.id },
      data: {
        deadlineReminderSentAt: now,
      },
    })

    remindersSent += 1
    touchedOrganizationIds.add(pursuit.organizationId)
  }

  if (touchedOrganizationIds.size > 0) {
    await expireCacheTags(
      Array.from(touchedOrganizationIds, organizationId => dashboardCacheTag(organizationId))
    )
  }

  return Response.json({
    success: true,
    pursuitsScanned: pursuits.length,
    remindersSent,
    windowHours: REMINDER_WINDOW_HOURS,
  })
}
