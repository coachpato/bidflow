import { unstable_cache } from 'next/cache'
import prisma from '@/lib/prisma'
import { pilotLeadsCacheTag } from '@/lib/cache-tags'

export function getCachedPilotLeadCount() {
  return unstable_cache(
    async () => prisma.pilotLead.count(),
    ['pilot-lead-count'],
    {
      revalidate: 300,
      tags: [pilotLeadsCacheTag()],
    }
  )()
}
