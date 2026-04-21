import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { applyOrganizationToSession, ensureOrganizationContextForUser } from '@/lib/organization'

export async function POST(request) {
  try {
    const { email, password } = await request.json()
    const normalizedEmail = email?.trim().toLowerCase()
    const trimmedPassword = password?.trim()

    if (!normalizedEmail || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Normalize email input so login is not blocked by case or accidental spaces.
    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      include: {
        memberships: {
          orderBy: { id: 'asc' },
          take: 1,
          include: {
            organization: {
              include: {
                firmProfile: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      return Response.json({ error: 'No account exists for this email address.' }, { status: 404 })
    }

    // Allow a trimmed retry so pasted passwords with stray spaces still work.
    const passwordMatches = await bcrypt.compare(password, user.password) || (
      trimmedPassword &&
      trimmedPassword !== password &&
      await bcrypt.compare(trimmedPassword, user.password)
    )

    if (!passwordMatches) {
      const error = user.googleSubject
        ? 'The password for this account is incorrect. This account is also linked to Google.'
        : 'The password for this account is incorrect.'

      return Response.json({ error }, { status: 401 })
    }

    const organizationContext = await ensureOrganizationContextForUser(user)

    // Save session
    const session = await getSession()
    session.userId = user.id
    session.name = user.name
    session.email = user.email
    session.role = user.role
    applyOrganizationToSession(session, organizationContext)
    await session.save()

    return Response.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        organization: {
          id: organizationContext.organization.id,
          name: organizationContext.organization.name,
          role: organizationContext.membership.role,
        },
      },
    })
  } catch (err) {
    console.error('Login error:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
