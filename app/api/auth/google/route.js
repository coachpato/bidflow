import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { isPublicRegistrationEnabled } from '@/lib/env'
import { applyOrganizationToSession, ensureOrganizationContextForUser } from '@/lib/organization'
import { verifyGoogleIdToken, isGoogleAuthEnabled } from '@/lib/google-auth'
import { normalizeServiceSector } from '@/lib/service-sectors'
import { buildAuthUserPayload } from '@/lib/auth-response'

function normalizeString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeList(value) {
  if (!Array.isArray(value)) return []
  return value.map(item => normalizeString(item)).filter(Boolean)
}

function getRoleRank(role) {
  if (role === 'admin') return 3
  if (role === 'manager') return 2
  return 1
}

function pickHigherRole(currentRole, inviteRole) {
  return getRoleRank(inviteRole) > getRoleRank(currentRole) ? inviteRole : currentRole
}

function buildOrganizationContextFromMembership(user, membership) {
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    membership,
    organization: membership.organization,
    firmProfile: membership.organization.firmProfile,
  }
}

async function resolveInvite(token) {
  if (!token) return null

  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: {
      organization: {
        include: {
          firmProfile: true,
        },
      },
    },
  })

  if (!invite || invite.status !== 'pending') {
    throw new Error('This invitation is no longer active.')
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    throw new Error('This invitation has expired.')
  }

  return invite
}

async function acceptInvite({ invite, user }) {
  const normalizedInviteEmail = invite.email.trim().toLowerCase()
  const normalizedUserEmail = user.email.trim().toLowerCase()

  if (normalizedInviteEmail !== normalizedUserEmail) {
    throw new Error('This invitation was sent to a different email address.')
  }

  const membership = await prisma.$transaction(async tx => {
    const nextRole = pickHigherRole(user.role, invite.role)

    if (nextRole !== user.role) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          role: nextRole,
        },
      })
    }

    const existingMembership = await tx.membership.findFirst({
      where: {
        organizationId: invite.organizationId,
        userId: user.id,
      },
      include: {
        organization: {
          include: {
            firmProfile: true,
          },
        },
      },
    })

    const ensuredMembership = existingMembership
      ? await tx.membership.update({
          where: { id: existingMembership.id },
          data: {
            role: invite.role,
          },
          include: {
            organization: {
              include: {
                firmProfile: true,
              },
            },
          },
        })
      : await tx.membership.create({
          data: {
            organizationId: invite.organizationId,
            userId: user.id,
            role: invite.role,
          },
          include: {
            organization: {
              include: {
                firmProfile: true,
              },
            },
          },
        })

    await tx.teamInvite.update({
      where: { id: invite.id },
      data: {
        status: 'accepted',
        acceptedAt: new Date(),
      },
    })

    return ensuredMembership
  })

  return buildOrganizationContextFromMembership(
    {
      ...user,
      role: pickHigherRole(user.role, invite.role),
    },
    membership
  )
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
    user: buildAuthUserPayload(user, organizationContext),
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
      name,
      organizationName,
      serviceSector,
      practiceAreas,
      targetWorkTypes,
      targetProvinces,
      preferredEntities,
      inviteToken,
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
    const invite = await resolveInvite(inviteToken)

    let user = await findUserForGoogleSignIn(profile)

    if (user?.googleSubject && user.googleSubject !== profile.googleSubject) {
      return Response.json({ error: 'This email is already linked to a different Google account.' }, { status: 409 })
    }

    if (!user && intent === 'login' && !invite) {
      return Response.json({ error: 'No Bid360 account exists for this Google email yet. Start on Create account.' }, { status: 404 })
    }

    if (!user && invite) {
      const generatedPassword = randomBytes(24).toString('hex')
      const hashedPassword = await bcrypt.hash(generatedPassword, 10)

      user = await prisma.user.create({
        data: {
          name: normalizedName || profile.name,
          email: profile.email,
          password: hashedPassword,
          role: invite.role,
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
    } else if (!user && intent === 'register') {
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

      const assignedRole = 'admin'
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

    const organizationContext = invite
      ? await acceptInvite({ invite, user })
      : await ensureOrganizationContextForUser(user, intent === 'register' ? {
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
    session.role = organizationContext.user.role
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
