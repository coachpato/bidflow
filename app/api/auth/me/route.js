import { getSession } from '@/lib/session'
import { applyOrganizationToSession, ensureOrganizationContext } from '@/lib/organization'

// Returns the currently logged-in user info (used by client components)
export async function GET() {
  const session = await getSession()
  if (!session.userId) {
    return Response.json({ user: null }, { status: 401 })
  }

  const organizationContext = await ensureOrganizationContext(session.userId)

  if (session.organizationId !== organizationContext.organization.id || session.organizationRole !== organizationContext.membership.role) {
    applyOrganizationToSession(session, organizationContext)
    await session.save()
  }

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
