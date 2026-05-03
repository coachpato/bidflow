import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

function isValidPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  )
}

export async function POST(request) {
  const session = await getSession()
  if (!session.userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { currentPassword, newPassword } = body

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return Response.json({ error: 'Current password and new password are required.' }, { status: 400 })
  }

  if (!isValidPassword(newPassword)) {
    return Response.json({ error: 'New password must be at least 8 characters and include one letter and one number.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      password: true,
    },
  })

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password)
  if (!passwordMatches) {
    return Response.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  })

  return Response.json({ success: true })
}
