import { getSession } from '@/lib/session'
import {
  applyOrganizationToSession,
  ensureOrganizationContext,
  getSessionOrganizationId,
} from '@/lib/organization'

// Returns the currently logged-in user info (used by client components)
export async function GET() {
  const session = await getSession()
  if (!session.userId) {
    return Response.json({ user: null }, { status: 401 })
  }

  const organizationId = getSessionOrganizationId(session)

  if (organizationId && session.organizationName && session.organizationRole) {
    return Response.json({
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
        organization: {
          id: organizationId,
          name: session.organizationName,
          role: session.organizationRole,
        },
      },
    })
  }

  const organizationContext = await ensureOrganizationContext(session.userId)
  applyOrganizationToSession(session, organizationContext)
  await session.save()

  return Response.json({
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
      organization: {
        id: organizationContext.organization.id,
        name: organizationContext.organization.name,
        role: organizationContext.membership.role,
      },
    },
  })
}
