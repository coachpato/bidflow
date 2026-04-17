import { unstable_cache } from 'next/cache'
import prisma from '@/lib/prisma'
import {
  dashboardCacheTag,
  tenderDetailCacheTag,
  tenderPackCacheTag,
  tendersListCacheTag,
} from '@/lib/cache-tags'

export function getCachedTenderList({ organizationId, status, search }) {
  const normalizedStatus = status || 'all'
  const normalizedSearch = (search || '').trim().toLowerCase()

  return unstable_cache(
    async () => {
      const where = {
        organizationId,
      }

      if (status && status !== 'active') {
        where.status = status
      } else if (status === 'active') {
        where.status = { in: ['New', 'Under Review', 'In Progress'] }
      }

      if (normalizedSearch) {
        where.OR = [
          { title: { contains: normalizedSearch, mode: 'insensitive' } },
          { reference: { contains: normalizedSearch, mode: 'insensitive' } },
          { entity: { contains: normalizedSearch, mode: 'insensitive' } },
        ]
      }

      return prisma.tender.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { name: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
          qualification: {
            select: {
              verdict: true,
              readinessPercent: true,
              blockerCount: true,
              warningCount: true,
            },
          },
          _count: { select: { checklistItems: true, documents: true } },
        },
      })
    },
    [`tenders-list-${organizationId}-${normalizedStatus}-${normalizedSearch || 'none'}`],
    {
      revalidate: 60,
      tags: [tendersListCacheTag(organizationId), dashboardCacheTag(organizationId)],
    }
  )()
}

export function getCachedTenderDetail({ organizationId, tenderId }) {
  return unstable_cache(
    async () => prisma.tender.findFirst({
      where: {
        id: tenderId,
        organizationId,
      },
      include: {
        createdBy: { select: { name: true, email: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        opportunity: {
          select: {
            id: true,
            title: true,
            status: true,
            sourceUrl: true,
            fitScore: true,
            estimatedValue: true,
            practiceArea: true,
          },
        },
        documents: { orderBy: { uploadedAt: 'desc' } },
        checklistItems: { orderBy: { id: 'asc' } },
        requirements: { orderBy: { label: 'asc' } },
        qualification: {
          include: {
            checks: { orderBy: { sortOrder: 'asc' } },
          },
        },
        appeals: { orderBy: { createdAt: 'desc' } },
        contract: true,
      },
    }),
    [`tender-detail-${organizationId}-${tenderId}`],
    {
      revalidate: 60,
      tags: [
        tendersListCacheTag(organizationId),
        tenderDetailCacheTag(organizationId, tenderId),
      ],
    }
  )()
}

export function getCachedTenderSubmissionPack({ organizationId, tenderId }) {
  return unstable_cache(
    async () => {
      const [submissionPack, generatedDocuments] = await prisma.$transaction([
        prisma.submissionPack.findFirst({
          where: {
            tenderId,
            tender: { organizationId },
          },
        }),
        prisma.generatedDocument.findMany({
          where: {
            tenderId,
            tender: { organizationId },
          },
          orderBy: [{ documentType: 'asc' }, { updatedAt: 'desc' }],
        }),
      ])

      return {
        submissionPack,
        generatedDocuments,
      }
    },
    [`tender-pack-${organizationId}-${tenderId}`],
    {
      revalidate: 60,
      tags: [
        tenderDetailCacheTag(organizationId, tenderId),
        tenderPackCacheTag(organizationId, tenderId),
      ],
    }
  )()
}
