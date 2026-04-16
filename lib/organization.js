import prisma from '@/lib/prisma'

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getDefaultOrganizationName(user) {
  if (user.name?.trim()) {
    return `${user.name.trim()} Practice`
  }

  const domain = user.email?.split('@')[1]?.split('.')[0]
  if (domain) {
    return `${domain.charAt(0).toUpperCase()}${domain.slice(1)} Practice`
  }

  return 'BidFlow Practice'
}

function normalizeMembershipRole(role) {
  if (!role) return 'member'
  if (role === 'admin') return 'owner'
  return role
}

function buildOrganizationContext(user, membership) {
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

export function applyOrganizationToSession(session, organizationContext) {
  session.organizationId = organizationContext.organization.id
  session.organizationName = organizationContext.organization.name
  session.organizationRole = organizationContext.membership.role
}

export async function ensureOrganizationContext(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
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
    throw new Error('User not found while resolving organization context.')
  }

  const existingMembership = user.memberships[0]

  if (existingMembership) {
    if (!existingMembership.organization.firmProfile) {
      const firmProfile = await prisma.firmProfile.create({
        data: {
          organizationId: existingMembership.organizationId,
          displayName: existingMembership.organization.name,
          primaryContactName: user.name,
          primaryContactEmail: user.email,
        },
      })

      existingMembership.organization.firmProfile = firmProfile
    }

    return buildOrganizationContext(user, existingMembership)
  }

  const organizationName = getDefaultOrganizationName(user)
  const organizationSlugBase = slugify(organizationName) || 'bidflow-practice'

  const created = await prisma.$transaction(async tx => {
    const organization = await tx.organization.create({
      data: {
        name: organizationName,
        slug: `${organizationSlugBase}-${user.id}`,
      },
    })

    const membership = await tx.membership.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: normalizeMembershipRole(user.role),
      },
      include: {
        organization: true,
      },
    })

    const firmProfile = await tx.firmProfile.create({
      data: {
        organizationId: organization.id,
        displayName: organization.name,
        primaryContactName: user.name,
        primaryContactEmail: user.email,
      },
    })

    membership.organization.firmProfile = firmProfile

    return membership
  })

  return buildOrganizationContext(user, created)
}
