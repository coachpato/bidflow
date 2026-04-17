import { Prisma } from '@prisma/client'
import { unstable_cache } from 'next/cache'
import prisma from '@/lib/prisma'
import { ACTIVE_OPPORTUNITY_STATUSES } from '@/lib/opportunity-radar'
import { dashboardCacheTag } from '@/lib/cache-tags'

const DEADLINE_WARNING_DAYS = 14
const CONTRACT_EXPIRY_WARNING_DAYS = 30
const OPPORTUNITY_WARNING_DAYS = 10
const COMPLIANCE_WARNING_DAYS = 30

function addDays(date, days) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function buildAssignmentPredicate(userId, legacyAssigneeTokens) {
  if (legacyAssigneeTokens.length > 0) {
    return Prisma.sql`("assignedUserId" = ${userId} OR ("assignedUserId" IS NULL AND "assignedTo" IN (${Prisma.join(legacyAssigneeTokens)})))`
  }

  return Prisma.sql`"assignedUserId" = ${userId}`
}

export function getCachedDashboardOrganizationData(organizationId) {
  return unstable_cache(
    async () => {
      const now = new Date()
      const deadlineCutoff = addDays(now, DEADLINE_WARNING_DAYS)
      const contractExpiryCutoff = addDays(now, CONTRACT_EXPIRY_WARNING_DAYS)
      const opportunityCutoff = addDays(now, OPPORTUNITY_WARNING_DAYS)
      const complianceCutoff = addDays(now, COMPLIANCE_WARNING_DAYS)

      const [
        dashboardStats,
        upcomingDeadlines,
        expiringContracts,
        opportunitiesToReview,
        expiringComplianceDocuments,
      ] = await prisma.$transaction([
        prisma.$queryRaw`
          WITH tender_stats AS (
            SELECT
              COUNT(*) FILTER (WHERE "status" IN ('New', 'Under Review', 'In Progress'))::int AS "activeTenders",
              COUNT(*) FILTER (WHERE "status" = 'Submitted')::int AS "submittedTenders",
              COUNT(*) FILTER (WHERE "status" = 'Awarded')::int AS "awardedTenders",
              COUNT(*) FILTER (WHERE "status" = 'Lost')::int AS "lostTenders"
            FROM "tender"
            WHERE "organizationId" = ${organizationId}
          ),
          contract_stats AS (
            SELECT
              COUNT(*) FILTER (
                WHERE "endDate" IS NOT NULL
                  AND "endDate" >= ${now}
                  AND "endDate" <= ${contractExpiryCutoff}
              )::int AS "expiringContractsCount"
            FROM "contract"
            WHERE "organizationId" = ${organizationId}
          ),
          opportunity_stats AS (
            SELECT
              COUNT(*) FILTER (WHERE "status" IN (${Prisma.join(ACTIVE_OPPORTUNITY_STATUSES)}))::int AS "opportunityQueueCount",
              COUNT(*) FILTER (
                WHERE "status" IN (${Prisma.join(ACTIVE_OPPORTUNITY_STATUSES)})
                  AND COALESCE("fitScore", 0) >= 75
              )::int AS "highFitOpportunityCount",
              COUNT(*) FILTER (
                WHERE "status" IN (${Prisma.join(ACTIVE_OPPORTUNITY_STATUSES)})
                  AND "deadline" IS NOT NULL
                  AND "deadline" >= ${now}
                  AND "deadline" <= ${opportunityCutoff}
              )::int AS "dueSoonOpportunities"
            FROM "opportunity"
            WHERE "organizationId" = ${organizationId}
          ),
          appeal_stats AS (
            SELECT COUNT(*)::int AS "pendingAppeals"
            FROM "appeal"
            WHERE "organizationId" = ${organizationId}
              AND "status" = 'Pending'
          ),
          membership_stats AS (
            SELECT COUNT(*)::int AS "teamMemberCount"
            FROM "membership"
            WHERE "organizationId" = ${organizationId}
          )
          SELECT *
          FROM tender_stats
          CROSS JOIN contract_stats
          CROSS JOIN opportunity_stats
          CROSS JOIN appeal_stats
          CROSS JOIN membership_stats
        `,
        prisma.tender.findMany({
          where: {
            organizationId,
            deadline: {
              gte: now,
              lte: deadlineCutoff,
            },
            status: {
              notIn: ['Submitted', 'Awarded', 'Lost', 'Cancelled'],
            },
          },
          select: {
            id: true,
            title: true,
            entity: true,
            deadline: true,
            status: true,
          },
          orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
          take: 5,
        }),
        prisma.contract.findMany({
          where: {
            organizationId,
            endDate: {
              gte: now,
              lte: contractExpiryCutoff,
            },
          },
          select: {
            id: true,
            title: true,
            client: true,
            endDate: true,
          },
          orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }],
          take: 5,
        }),
        prisma.opportunity.findMany({
          where: {
            organizationId,
            status: { in: ACTIVE_OPPORTUNITY_STATUSES },
          },
          select: {
            id: true,
            title: true,
            entity: true,
            deadline: true,
            fitScore: true,
            status: true,
            matches: {
              where: { organizationId },
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: {
                matchReasons: true,
              },
            },
          },
          orderBy: [
            { deadline: { sort: 'asc', nulls: 'last' } },
            { fitScore: { sort: 'desc', nulls: 'last' } },
            { id: 'asc' },
          ],
          take: 5,
        }),
        prisma.complianceDocument.findMany({
          where: {
            organizationId,
            expiryDate: {
              not: null,
              lte: complianceCutoff,
            },
          },
          select: {
            id: true,
            filename: true,
            documentType: true,
            expiryDate: true,
          },
          orderBy: { expiryDate: 'asc' },
          take: 4,
        }),
      ])

      return {
        summary: dashboardStats[0] || {},
        upcomingDeadlines,
        expiringContracts,
        opportunitiesToReview,
        expiringComplianceDocuments,
      }
    },
    [`dashboard-organization-${organizationId}`],
    {
      revalidate: 60,
      tags: [dashboardCacheTag(organizationId)],
    }
  )()
}

export function getCachedDashboardUserData({ organizationId, userId, legacyAssigneeTokens = [] }) {
  const normalizedTokens = [...legacyAssigneeTokens].filter(Boolean).sort()
  const tokensKey = normalizedTokens.join('|') || 'none'

  return unstable_cache(
    async () => {
      const assignmentPredicate = buildAssignmentPredicate(userId, normalizedTokens)

      const [dashboardUserStats] = await prisma.$queryRaw`
        WITH tender_stats AS (
          SELECT COUNT(*) FILTER (
            WHERE "status" IN ('New', 'Under Review', 'In Progress', 'Submitted')
              AND ${assignmentPredicate}
          )::int AS "myTenders"
          FROM "tender"
          WHERE "organizationId" = ${organizationId}
        ),
        contract_stats AS (
          SELECT COUNT(*) FILTER (
            WHERE ${assignmentPredicate}
          )::int AS "myContracts"
          FROM "contract"
          WHERE "organizationId" = ${organizationId}
        ),
        notification_stats AS (
          SELECT COUNT(*)::int AS "unreadNotifications"
          FROM "notification"
          WHERE "read" = false
            AND ("userId" = ${userId} OR "userId" IS NULL)
            AND ("organizationId" = ${organizationId} OR "organizationId" IS NULL)
        )
        SELECT *
        FROM tender_stats
        CROSS JOIN contract_stats
        CROSS JOIN notification_stats
      `

      return dashboardUserStats || {}
    },
    [`dashboard-user-${organizationId}-${userId}-${tokensKey}`],
    {
      revalidate: 30,
      tags: [dashboardCacheTag(organizationId)],
    }
  )()
}
