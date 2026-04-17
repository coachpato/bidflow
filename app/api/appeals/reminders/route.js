import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
import { sendChallengeDeadlineReminder } from '@/lib/challenge-notifications'

const REMINDER_WINDOW_DAYS = 7

function startOfDay(value = new Date()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(value, days) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}

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

  const today = startOfDay()
  const windowEnd = addDays(today, REMINDER_WINDOW_DAYS)
  const reminderRunAt = new Date()

  const challenges = await prisma.appeal.findMany({
    where: {
      deadline: { gte: today, lte: windowEnd },
      deadlineReminderSentAt: null,
      status: { in: ['Pending', 'Submitted'] },
    },
    include: {
      tender: {
        select: {
          title: true,
          assignedUserId: true,
          assignedTo: true,
        },
      },
    },
    orderBy: { deadline: 'asc' },
  })

  let remindersSent = 0
  const touchedOrganizationIds = new Set()

  for (const challenge of challenges) {
    await sendChallengeDeadlineReminder({ challenge })
    await prisma.appeal.update({
      where: { id: challenge.id },
      data: { deadlineReminderSentAt: reminderRunAt },
    })
    remindersSent += 1
    touchedOrganizationIds.add(challenge.organizationId)
  }

  if (touchedOrganizationIds.size > 0) {
    await expireCacheTags(
      Array.from(touchedOrganizationIds, organizationId => dashboardCacheTag(organizationId))
    )
  }

  return Response.json({
    success: true,
    challengesScanned: challenges.length,
    remindersSent,
    windowDays: REMINDER_WINDOW_DAYS,
  })
}
