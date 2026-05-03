import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function PATCH(request) {
  const session = await getSession()
  if (!session.userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!name) {
    return Response.json({ error: 'Display name is required.' }, { status: 400 })
  }

  if (name.length > 120) {
    return Response.json({ error: 'Display name must be under 120 characters.' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { name },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  })

  session.name = user.name
  await session.save()

  return Response.json(user)
}
