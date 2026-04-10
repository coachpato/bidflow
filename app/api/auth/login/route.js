import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function POST(request) {
  try {
    const { email, password } = await request.json()
    const normalizedEmail = email?.trim().toLowerCase()

    if (!normalizedEmail || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Normalize email input so login is not blocked by case or accidental spaces.
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
    })

    // Check password (use same error message for both cases for security)
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return Response.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    // Save session
    const session = await getSession()
    session.userId = user.id
    session.name = user.name
    session.email = user.email
    session.role = user.role
    await session.save()

    return Response.json({ success: true, user: { id: user.id, name: user.name, role: user.role } })
  } catch (err) {
    console.error('Login error:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
