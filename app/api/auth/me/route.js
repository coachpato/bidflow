import { getSession } from '@/lib/session'

// Returns the currently logged-in user info (used by client components)
export async function GET() {
  const session = await getSession()
  if (!session.userId) {
    return Response.json({ user: null }, { status: 401 })
  }
  return Response.json({
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
    },
  })
}
