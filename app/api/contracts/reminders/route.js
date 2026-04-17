import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
import { sendAppointmentFollowUpReminder, sendContractDateReminder } from '@/lib/contract-notifications'
import { resolveAssignedRecipients } from '@/lib/tender-assignment'

const REMINDER_WINDOW_DAYS = 30
const MILESTONE_WINDOW_DAYS = 14

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

  const contracts = await prisma.contract.findMany({
    where: {
      AND: [
        {
          OR: [
            { assignedUserId: { not: null } },
            { assignedTo: { not: null } },
          ],
        },
        {
          OR: [
            {
              endDate: { gte: today, lte: windowEnd },
              endDateReminderSentAt: null,
            },
            {
              renewalDate: { gte: today, lte: windowEnd },
              renewalDateReminderSentAt: null,
            },
            {
              nextFollowUpAt: { gte: today, lte: windowEnd },
              nextFollowUpReminderSentAt: null,
            },
          ],
        },
      ],
    },
    select: {
      id: true,
      title: true,
      client: true,
      assignedUserId: true,
      assignedTo: true,
      endDate: true,
      renewalDate: true,
      endDateReminderSentAt: true,
      renewalDateReminderSentAt: true,
      nextFollowUpAt: true,
      nextFollowUpReminderSentAt: true,
      organizationId: true,
    },
  })

  const milestoneWindowEnd = addDays(today, MILESTONE_WINDOW_DAYS)
  const milestones = await prisma.contractMilestone.findMany({
    where: {
      dueDate: { gte: today, lte: milestoneWindowEnd },
      reminderSentAt: null,
      contract: {
        OR: [
          { assignedUserId: { not: null } },
          { assignedTo: { not: null } },
        ],
      },
    },
    include: {
      contract: {
        select: {
          id: true,
          title: true,
          client: true,
          assignedUserId: true,
          assignedTo: true,
          organizationId: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  })

  let remindersSent = 0
  const touchedOrganizationIds = new Set()

  for (const contract of contracts) {
    if (contract.endDate && !contract.endDateReminderSentAt) {
      await sendContractDateReminder({ contract, dateField: 'endDate' })
      await prisma.contract.update({
        where: { id: contract.id },
        data: { endDateReminderSentAt: reminderRunAt },
      })
      remindersSent += 1
      touchedOrganizationIds.add(contract.organizationId)
    }

    if (contract.renewalDate && !contract.renewalDateReminderSentAt) {
      await sendContractDateReminder({ contract, dateField: 'renewalDate' })
      await prisma.contract.update({
        where: { id: contract.id },
        data: { renewalDateReminderSentAt: reminderRunAt },
      })
      remindersSent += 1
      touchedOrganizationIds.add(contract.organizationId)
    }

    if (contract.nextFollowUpAt && !contract.nextFollowUpReminderSentAt) {
      await sendAppointmentFollowUpReminder({ contract })
      await prisma.contract.update({
        where: { id: contract.id },
        data: { nextFollowUpReminderSentAt: reminderRunAt },
      })
      remindersSent += 1
      touchedOrganizationIds.add(contract.organizationId)
    }
  }

  for (const milestone of milestones) {
    const recipients = await resolveAssignedRecipients({
      assignedUserId: milestone.contract.assignedUserId,
      assignedTo: milestone.contract.assignedTo,
    })

    const linkedUsers = recipients.filter(recipient => recipient.id)
    if (linkedUsers.length > 0) {
      await prisma.notification.createMany({
        data: linkedUsers.map(user => ({
          title: 'Appointment milestone due',
          message: `Milestone "${milestone.title}" for appointment "${milestone.contract.title}" is due soon.`,
          type: 'warning',
          userId: user.id,
          organizationId: milestone.contract.organizationId,
          linkUrl: `/appointments/${milestone.contract.id}`,
          linkLabel: 'Open appointment',
        })),
      })
    }

    await prisma.contractMilestone.update({
      where: { id: milestone.id },
      data: { reminderSentAt: reminderRunAt },
    })
    remindersSent += 1
    touchedOrganizationIds.add(milestone.contract.organizationId)
  }

  if (touchedOrganizationIds.size > 0) {
    await expireCacheTags(
      Array.from(touchedOrganizationIds, organizationId => dashboardCacheTag(organizationId))
    )
  }

  return Response.json({
    success: true,
    contractsScanned: contracts.length,
    milestonesScanned: milestones.length,
    remindersSent,
    windowDays: REMINDER_WINDOW_DAYS,
  })
}
