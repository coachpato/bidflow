import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { isPublicRegistrationEnabled } from '@/lib/env'
import { applyOrganizationToSession, ensureOrganizationContextForUser } from '@/lib/organization'
import { verifyGoogleIdToken, isGoogleAuthEnabled } from '@/lib/google-auth'
import { normalizeServiceSector } from '@/lib/service-sectors'

function normalizeString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeList(value) {
  if (!Array.isArray(value)) return []
  return value.map(item => normalizeString(item)).filter(Boolean)
}

function getRegistrationValidationError({ organizationName, serviceSector, practiceAreas, targetWorkTypes }) {
  if (!organizationName || !serviceSector) {
    return 'Organization name and sector are required to create a Bid360 workspace.'
  }

  if (practiceAreas.length === 0) {
    return 'Choose at least one practice area so Bid360 can tailor your opportunity radar.'
  }

  if (targetWorkTypes.length === 0) {
    return 'Choose at least one opportunity type so Bid360 can tailor your opportunity radar.'
  }

  return null
}

async function findUserForGoogleSignIn(profile) {
  return prisma.user.findFirst({
    where: {
      OR: [
        { googleSubject: profile.googleSubject },
        { email: profile.email },
      ],
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
}

function buildResponsePayload(user, organizationContext) {
  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl || null,
      organization: {
        id: organizationContext.organization.id,
        name: organizationContext.organization.name,
        role: organizationContext.membership.role,
      },
      serviceSector: organizationContext.firmProfile?.serviceSector || null,
    },
  }
}

export async function POST(request) {
  try {
    if (!isGoogleAuthEnabled()) {
      return Response.json({ error: 'Google authentication is not configured yet.' }, { status: 503 })
    }

    const {
      credential,
      intent,
      role,
      name,
      organizationName,
      serviceSector,
      practiceAreas,
      targetWorkTypes,
      targetProvinces,
      preferredEntities,
    } = await request.json()

    if (intent !== 'login' && intent !== 'register') {
      return Response.json({ error: 'Google authentication intent is invalid.' }, { status: 400 })
    }

    const profile = await verifyGoogleIdToken(credential)

    if (!profile.emailVerified) {
      return Response.json({ error: 'Your Google email address must be verified before you can use it with Bid360.' }, { status: 400 })
    }

    const normalizedName = normalizeString(name)
    const normalizedOrganizationName = normalizeString(organizationName)
    const normalizedServiceSector = normalizeServiceSector(serviceSector)
    const normalizedPracticeAreas = normalizeList(practiceAreas)
    const normalizedTargetWorkTypes = normalizeList(targetWorkTypes)
    const normalizedTargetProvinces = normalizeList(targetProvinces)
    const normalizedPreferredEntities = normalizeList(preferredEntities)

    let user = await findUserForGoogleSignIn(profile)

    if (user?.googleSubject && user.googleSubject !== profile.googleSubject) {
      return Response.json({ error: 'This email is already linked to a different Google account.' }, { status: 409 })
    }

    if (!user && intent === 'login') {
      return Response.json({ error: 'No Bid360 account exists for this Google email yet. Start on Create account.' }, { status: 404 })
    }

    if (!user && intent === 'register') {
      const validationError = getRegistrationValidationError({
        organizationName: normalizedOrganizationName,
        serviceSector: normalizedServiceSector,
        practiceAreas: normalizedPracticeAreas,
        targetWorkTypes: normalizedTargetWorkTypes,
      })

      if (validationError) {
        return Response.json({ error: validationError }, { status: 400 })
      }

      const userCount = await prisma.user.count()
      if (userCount > 0 && !isPublicRegistrationEnabled()) {
        return Response.json({ error: 'Registration is disabled. Please ask an admin to create your account.' }, { status: 403 })
      }

      const assignedRole = userCount === 0 ? 'admin' : (role || 'member')
      const generatedPassword = randomBytes(24).toString('hex')
      const hashedPassword = await bcrypt.hash(generatedPassword, 10)

      user = await prisma.user.create({
        data: {
          name: normalizedName || profile.name,
          email: profile.email,
          password: hashedPassword,
          role: assignedRole,
          googleSubject: profile.googleSubject,
          avatarUrl: profile.avatarUrl,
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

      const organizationContext = await ensureOrganizationContextForUser({
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

      const session = await getSession()
      session.userId = user.id
      session.name = user.name
      session.email = user.email
      session.role = user.role
      applyOrganizationToSession(session, organizationContext)
      await session.save()

      return Response.json(buildResponsePayload(user, organizationContext))
    }

    if (!user) {
      return Response.json({ error: 'Unable to continue with Google right now.' }, { status: 400 })
    }

    const nextUserName = user.name || normalizedName || profile.name
    const shouldUpdateGoogleFields =
      !user.googleSubject ||
      (!user.avatarUrl && Boolean(profile.avatarUrl)) ||
      user.name !== nextUserName

    if (shouldUpdateGoogleFields) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleSubject: user.googleSubject || profile.googleSubject,
          avatarUrl: profile.avatarUrl || user.avatarUrl,
          name: nextUserName,
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
    }

    const organizationContext = await ensureOrganizationContextForUser(user, intent === 'register' ? {
      organizationName: normalizedOrganizationName,
      serviceSector: normalizedServiceSector,
      practiceAreas: normalizedPracticeAreas,
      targetWorkTypes: normalizedTargetWorkTypes,
      targetProvinces: normalizedTargetProvinces,
      preferredEntities: normalizedPreferredEntities,
    } : {})

    const session = await getSession()
    session.userId = user.id
    session.name = user.name
    session.email = user.email
    session.role = user.role
    applyOrganizationToSession(session, organizationContext)
    await session.save()

    return Response.json(buildResponsePayload(user, organizationContext))
  } catch (error) {
    console.error('Google auth error:', error)
    const message = typeof error?.message === 'string' ? error.message : ''

    if (message === 'Google credential is required.' || message === 'Google profile is incomplete.') {
      return Response.json({ error: message }, { status: 400 })
    }

    if (message === 'Google authentication is not configured.') {
      return Response.json({ error: 'Google authentication is not configured yet.' }, { status: 503 })
    }

    if (/token|jwt|audience|recipient/i.test(message)) {
      return Response.json({ error: 'Your Google sign-in could not be verified. Please try again.' }, { status: 401 })
    }

    return Response.json({ error: 'Google authentication failed. Please try again.' }, { status: 500 })
  }
}
