import prisma from '@/lib/prisma'

export function parseRecordId(value) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isNaN(parsed) ? null : parsed
}

export async function findTenderForOrganization({ tenderId, organizationId, select, include }) {
  if (!organizationId || !tenderId) return null

  return prisma.tender.findFirst({
    where: {
      id: tenderId,
      organizationId,
    },
    ...(select ? { select } : {}),
    ...(include ? { include } : {}),
  })
}
