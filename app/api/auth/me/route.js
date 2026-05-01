import { getSession } from '@/lib/session'
import {
  applyOrganizationToSession,
  ensureOrganizationContext,
  getSessionOrganizationId,
} from '@/lib/organization'
import { buildAuthUserPayload } from '@/lib/auth-response'

// Returns the currently logged-in user info (used by client components)
export async function GET() {
  const session = await getSession()
  if (!session.userId) {
    return Response.json({ user: null }, { status: 401 })
  }

  const organizationId = getSessionOrganizationId(session)

  if (organizationId && session.organizationName && session.organizationRole) {
    const organizationContext = {
      user: {
        role: session.role,
      },
      organization: {
        id: organizationId,
        name: session.organizationName,
      },
      membership: {
        role: session.organizationRole,
      },
      firmProfile: null,
    }

    return Response.json({
      user: buildAuthUserPayload({
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
      }, organizationContext),
    })
  }

  const organizationContext = await ensureOrganizationContext(session.userId)
  applyOrganizationToSession(session, organizationContext)
  await session.save()

  return Response.json({
    user: buildAuthUserPayload({
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
    }, organizationContext),
  })
}
