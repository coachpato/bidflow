import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { isPublicRegistrationEnabled } from '@/lib/env'
import { applyOrganizationToSession, ensureOrganizationContextForUser } from '@/lib/organization'

export async function POST(request) {
  try {
    const { name, email, password, role } = await request.json()
    const normalizedName = name?.trim()
    const normalizedEmail = email?.trim().toLowerCase()

    // Basic validation
    if (!normalizedName || !normalizedEmail || !password) {
      return Response.json({ error: 'Name, email and password are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Check if email is already registered
    const existing = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    })
    if (existing) {
      return Response.json({ error: 'An account with this email already exists' }, { status: 400 })
    }

    const userCount = await prisma.user.count()
    if (userCount > 0 && !isPublicRegistrationEnabled()) {
      return Response.json({ error: 'Registration is disabled. Please ask an admin to create your account.' }, { status: 403 })
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create the user (first user becomes admin automatically)
    const assignedRole = userCount === 0 ? 'admin' : (role || 'member')

    const user = await prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        password: hashedPassword,
        role: assignedRole,
      },
    })

    const organizationContext = await ensureOrganizationContextForUser({
      ...user,
      memberships: [],
    })

    // Log them in immediately after registering
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
    console.error('Register error:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
