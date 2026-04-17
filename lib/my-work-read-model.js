import { unstable_cache } from 'next/cache'
import prisma from '@/lib/prisma'
import { dashboardCacheTag } from '@/lib/cache-tags'

const TENDER_STATUSES = ['New', 'Under Review', 'In Progress', 'Submitted', 'Awarded']

function buildAssignmentWhere(userId, legacyAssigneeTokens) {
  if (legacyAssigneeTokens.length > 0) {
    return {
      OR: [
        { assignedUserId: userId },
        { assignedUserId: null, assignedTo: { in: legacyAssigneeTokens } },
      ],
    }
  }

  return { assignedUserId: userId }
}

export function getCachedMyWorkData({ organizationId, userId, legacyAssigneeTokens = [] }) {
  const normalizedTokens = [...legacyAssigneeTokens].filter(Boolean).sort()
  const tokensKey = normalizedTokens.join('|') || 'none'

  return unstable_cache(
    async () => {
      const assignmentWhere = buildAssignmentWhere(userId, normalizedTokens)

      const [tenders, contracts, unreadNotifications] = await prisma.$transaction([
        prisma.tender.findMany({
          where: {
            AND: [
              { organizationId },
              assignmentWhere,
              { status: { in: TENDER_STATUSES } },
            ],
          },
          select: {
            id: true,
            title: true,
            entity: true,
            reference: true,
            deadline: true,
            status: true,
          },
          orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
          take: 12,
        }),
        prisma.contract.findMany({
          where: {
            AND: [
              assignmentWhere,
              { organizationId },
            ],
          },
          select: {
            id: true,
            title: true,
            client: true,
            appointmentStatus: true,
            instructionStatus: true,
            nextFollowUpAt: true,
            startDate: true,
            endDate: true,
            renewalDate: true,
            value: true,
            tender: { select: { id: true, title: true } },
          },
          orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }],
          take: 12,
        }),
        prisma.notification.count({
          where: {
            AND: [
              { read: false },
              { OR: [{ userId }, { userId: null }] },
              { OR: [{ organizationId }, { organizationId: null }] },
            ],
          },
        }),
      ])

      return {
        tenders,
        contracts,
        unreadNotifications,
      }
    },
    [`my-work-${organizationId}-${userId}-${tokensKey}`],
    {
      revalidate: 60,
      tags: [dashboardCacheTag(organizationId)],
    }
  )()
}
