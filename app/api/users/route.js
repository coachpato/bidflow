import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { ensureOrganizationContext } from '@/lib/organization'

export async function GET() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationContext = await ensureOrganizationContext(session.userId)

  const users = await prisma.user.findMany({
    where: {
      memberships: {
        some: {
          organizationId: organizationContext.organization.id,
        },
      },
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  })

  return Response.json(users)
}
