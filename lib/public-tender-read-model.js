import { unstable_cache } from 'next/cache'
import { publicTenderCacheTag } from '@/lib/cache-tags'
import prisma from '@/lib/prisma'

const publicTenderSelect = {
  id: true,
  title: true,
  reference: true,
  entity: true,
  category: true,
  practiceArea: true,
  matchedSectors: true,
  sourceName: true,
  sourceUrl: true,
  sourceDetailUrl: true,
  sourceFallbackUrl: true,
  sourceStatus: true,
  publishedAt: true,
  deadline: true,
  briefingDate: true,
  briefingDetails: true,
  siteVisitDate: true,
  location: true,
  contactPerson: true,
  contactEmail: true,
  status: true,
  firstSeenAt: true,
  lastSeenAt: true,
  lastVerifiedAt: true,
  archivedAt: true,
  sourceMissingAt: true,
  updatedAt: true,
  documents: {
    where: { sourceUrl: { not: null } },
    orderBy: { firstSeenAt: 'asc' },
    select: {
      id: true,
      filename: true,
      sourceUrl: true,
      sourceDocumentId: true,
      documentType: true,
      extension: true,
      fileSize: true,
      checksum: true,
      firstSeenAt: true,
      lastVerifiedAt: true,
    },
  },
}

export async function findPublicTenderById(tenderId, db = prisma) {
  if (!Number.isInteger(tenderId) || tenderId <= 0) return null
  return db.opportunity.findUnique({
    where: { id: tenderId },
    select: publicTenderSelect,
  })
}

export async function getCachedPublicTender(tenderId) {
  if (!Number.isInteger(tenderId) || tenderId <= 0) return null

  return unstable_cache(
    () => findPublicTenderById(tenderId),
    ['public-tender', String(tenderId)],
    {
      revalidate: 300,
      tags: [publicTenderCacheTag(tenderId)],
    }
  )()
}

export { publicTenderSelect }
