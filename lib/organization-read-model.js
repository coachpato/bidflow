import { unstable_cache } from 'next/cache'
import prisma from '@/lib/prisma'
import { organizationCacheTag } from '@/lib/cache-tags'

export function getCachedOrganizationProfile(organizationId) {
  return unstable_cache(
    async () => prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        firmProfile: true,
      },
    }),
    [`organization-profile-${organizationId}`],
    {
      revalidate: 300,
      tags: [organizationCacheTag(organizationId)],
    }
  )()
}
