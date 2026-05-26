import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { isPublicRegistrationEnabled } from '@/lib/env'
import { ensureOrganizationContextForUser } from '@/lib/organization'
import { createVerificationExpiry, createVerificationToken, sendVerificationEmail } from '@/lib/email-verification'
import { normalizeServiceSector } from '@/lib/service-sectors'
import { enforceRateLimit } from '@/lib/rate-limit'

export async function POST(request) {
  try {
    const rateLimit = enforceRateLimit(request, {
      scope: 'auth:register',
      limit: 3,
      windowMs: 60 * 60 * 1000,
    })
    if (rateLimit) return rateLimit

    const {
      name,
      email,
      password,
      organizationName,
      serviceSector,
      practiceAreas,
      targetWorkTypes,
      targetProvinces,
      preferredEntities,
    } = await request.json()
    const normalizedName = name?.trim()
    const normalizedEmail = email?.trim().toLowerCase()
    const normalizedOrganizationName = organizationName?.trim()
    const normalizedServiceSector = normalizeServiceSector(serviceSector)
    const normalizedPracticeAreas = Array.isArray(practiceAreas)
      ? practiceAreas.map(item => item?.trim()).filter(Boolean)
      : []
    const normalizedTargetWorkTypes = Array.isArray(targetWorkTypes)
      ? targetWorkTypes.map(item => item?.trim()).filter(Boolean)
      : []
    const normalizedTargetProvinces = Array.isArray(targetProvinces)
      ? targetProvinces.map(item => item?.trim()).filter(Boolean)
      : []
    const normalizedPreferredEntities = Array.isArray(preferredEntities)
      ? preferredEntities.map(item => item?.trim()).filter(Boolean)
      : []

    // Basic validation
    if (!normalizedName || !normalizedEmail || !password || !normalizedOrganizationName || !normalizedServiceSector) {
      return Response.json({ error: 'Name, email, password, organisation name, and sector are required.' }, { status: 400 })
    }

    if (normalizedPracticeAreas.length === 0) {
      return Response.json({ error: 'Choose at least one practice area so Bid360 can tailor your opportunity radar.' }, { status: 400 })
    }

    if (normalizedTargetWorkTypes.length === 0) {
      return Response.json({ error: 'Choose at least one opportunity type so Bid360 can tailor your opportunity radar.' }, { status: 400 })
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

    // Self-signups create a new workspace, so the founder is always an admin.
    const assignedRole = 'admin'
    const verificationToken = createVerificationToken()
    const verificationTokenExpiresAt = createVerificationExpiry()

    const user = await prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        password: hashedPassword,
        role: assignedRole,
        emailVerified: null,
        verificationToken,
        verificationTokenExpiresAt,
      },
    })

    await ensureOrganizationContextForUser({
      ...user,
      memberships: [],
    }, {
      organizationName: normalizedOrganizationName,
      serviceSector: normalizedServiceSector,
      practiceAreas: normalizedPracticeAreas,
      targetWorkTypes: normalizedTargetWorkTypes,
      targetProvinces: normalizedTargetProvinces,
      preferredEntities: normalizedPreferredEntities,
    })

    try {
      await sendVerificationEmail({
        email: user.email,
        name: user.name,
        token: verificationToken,
      })
    } catch (error) {
      console.error('Verification email failed:', error)
      return Response.json({
        error: 'Your account was created, but the verification email could not be sent. Please try resend from the check-email page or contact support.',
        code: 'EMAIL_DELIVERY_FAILED',
        email: user.email,
      }, { status: 502 })
    }

    return Response.json({
      success: true,
      requiresVerification: true,
      email: user.email,
    })
  } catch (err) {
    console.error('Register error:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
