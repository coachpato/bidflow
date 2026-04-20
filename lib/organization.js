import prisma from '@/lib/prisma'
import { getCachedOrganizationProfile } from '@/lib/organization-read-model'
import { getDefaultPracticeAreasForSector, normalizeServiceSector } from '@/lib/service-sectors'

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function getDefaultOrganizationName(user, serviceSector = null) {
  const normalizedSector = normalizeServiceSector(serviceSector)

  if (user.name?.trim()) {
    if (normalizedSector === 'BUILT_ENVIRONMENT') return `${user.name.trim()} Projects`
    if (normalizedSector === 'ACCOUNTING') return `${user.name.trim()} Advisory`
    return `${user.name.trim()} Legal`
  }

  const domain = user.email?.split('@')[1]?.split('.')[0]
  if (domain) {
    const normalizedDomain = `${domain.charAt(0).toUpperCase()}${domain.slice(1)}`
    if (normalizedSector === 'BUILT_ENVIRONMENT') return `${normalizedDomain} Projects`
    if (normalizedSector === 'ACCOUNTING') return `${normalizedDomain} Advisory`
    return `${normalizedDomain} Legal`
  }

  return 'Bid360 Workspace'
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

function normalizeSessionOrganizationId(session) {
  if (!session?.organizationId) return null

  const parsed = Number.parseInt(String(session.organizationId), 10)
  return Number.isNaN(parsed) ? null : parsed
}

async function ensureFirmProfileForMembership(user, membership) {
  if (membership.organization.firmProfile) {
    return membership
  }

  const firmProfile = await prisma.firmProfile.create({
    data: {
      organizationId: membership.organizationId,
      displayName: membership.organization.name,
      primaryContactName: user.name,
      primaryContactEmail: user.email,
    },
  })

  membership.organization.firmProfile = firmProfile
  return membership
}

export function applyOrganizationToSession(session, organizationContext) {
  session.organizationId = organizationContext.organization.id
  session.organizationName = organizationContext.organization.name
  session.organizationRole = organizationContext.membership.role
}

export function getSessionOrganizationId(session) {
  return normalizeSessionOrganizationId(session)
}

export async function getOrganizationContextFromSession(session) {
  const organizationId = normalizeSessionOrganizationId(session)

  if (organizationId) {
    const organization = await getCachedOrganizationProfile(organizationId)

    if (organization) {
      return {
        user: {
          id: session.userId,
          name: session.name,
          email: session.email,
          role: session.role,
        },
        membership: {
          organizationId,
          role: session.organizationRole || 'member',
          organization,
        },
        organization,
        firmProfile: organization.firmProfile,
      }
    }
  }

  const organizationContext = await ensureOrganizationContext(session.userId)
  applyOrganizationToSession(session, organizationContext)
  await session.save()

  return organizationContext
}

export async function ensureOrganizationContextForUser(user, options = {}) {
  if (!user) {
    throw new Error('User not found while resolving organization context.')
  }

  const existingMembership = user.memberships?.[0]

  if (existingMembership) {
    const hydratedMembership = await ensureFirmProfileForMembership(user, existingMembership)
    return buildOrganizationContext(user, hydratedMembership)
  }

  const serviceSector = normalizeServiceSector(options.serviceSector)
  const organizationName = normalizeString(options.organizationName) || getDefaultOrganizationName(user, serviceSector)
  const organizationSlugBase = slugify(organizationName) || 'bid360-workspace'
  const defaultPracticeAreas = getDefaultPracticeAreasForSector(serviceSector)

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
        serviceSector,
        primaryContactName: user.name,
        primaryContactEmail: user.email,
        practiceAreas: defaultPracticeAreas,
      },
    })

    membership.organization.firmProfile = firmProfile

    return membership
  })

  return buildOrganizationContext(user, created)
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

  return ensureOrganizationContextForUser(user)
}
