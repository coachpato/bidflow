import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { dashboardCacheTag, expireCacheTags, organizationCacheTag } from '@/lib/cache-tags'
import { matchExistingOpportunitiesForOrganization } from '@/lib/existing-opportunity-matcher'
import { getSessionOrganizationId } from '@/lib/organization'
import { normalizeServiceSector } from '@/lib/service-sectors'

function normalizeString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(item => normalizeString(item)).filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/[\n,]/)
      .map(item => item.trim())
      .filter(Boolean)
  }

  return []
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeServiceSectorList(value) {
  return Array.from(
    new Set(
      normalizeList(value)
        .map(item => normalizeServiceSector(item))
        .filter(Boolean)
    )
  )
}

function listsMatch(left, right) {
  const normalizedLeft = Array.isArray(left) ? left : []
  const normalizedRight = Array.isArray(right) ? right : []

  if (normalizedLeft.length !== normalizedRight.length) return false

  return normalizedLeft.every((item, index) => item === normalizedRight[index])
}

export async function GET() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organisation context is missing.' }, { status: 400 })

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      firmProfile: true,
    },
  })

  if (!organization) {
    return Response.json({ error: 'Organisation not found.' }, { status: 404 })
  }

  return Response.json({
    organization,
    membership: {
      organizationId,
      role: session.organizationRole || 'member',
    },
    firmProfile: organization.firmProfile,
  })
}

export async function PUT(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organisation context is missing.' }, { status: 400 })
  const payload = await request.json()

  const displayName = normalizeString(payload.displayName)
  const serviceSectors = normalizeServiceSectorList(payload.serviceSectors)
  const serviceSector = normalizeServiceSector(payload.serviceSector) || serviceSectors[0] || null
  const nextServiceSectors = serviceSectors.length > 0
    ? serviceSectors
    : (serviceSector ? [serviceSector] : [])
  const practiceAreas = normalizeList(payload.practiceAreas)
  const preferredEntities = normalizeList(payload.preferredEntities)
  const targetWorkTypes = normalizeList(payload.targetWorkTypes)
  const targetProvinces = normalizeList(payload.targetProvinces)

  if (!displayName) {
    return Response.json({ error: 'Firm display name is required.' }, { status: 400 })
  }

  const currentProfile = await prisma.firmProfile.findUnique({
    where: { organizationId },
    select: {
      serviceSector: true,
      serviceSectors: true,
      practiceAreas: true,
      preferredEntities: true,
      targetWorkTypes: true,
      targetProvinces: true,
    },
  })

  const radarSettingsChanged = Boolean(currentProfile) && (
    currentProfile.serviceSector !== serviceSector ||
    !listsMatch(currentProfile.serviceSectors, nextServiceSectors) ||
    !listsMatch(currentProfile.practiceAreas, practiceAreas) ||
    !listsMatch(currentProfile.preferredEntities, preferredEntities) ||
    !listsMatch(currentProfile.targetWorkTypes, targetWorkTypes) ||
    !listsMatch(currentProfile.targetProvinces, targetProvinces)
  )

  const updated = await prisma.$transaction(async tx => {
    const organization = await tx.organization.update({
      where: { id: organizationId },
      data: { name: displayName },
    })

    const firmProfile = await tx.firmProfile.update({
      where: { organizationId },
      data: {
        displayName,
        serviceSector,
        serviceSectors: nextServiceSectors,
        legalName: normalizeString(payload.legalName),
        registrationNumber: normalizeString(payload.registrationNumber),
        primaryContactName: normalizeString(payload.primaryContactName),
        primaryContactEmail: normalizeString(payload.primaryContactEmail),
        primaryContactPhone: normalizeString(payload.primaryContactPhone),
        website: normalizeString(payload.website),
        overview: normalizeString(payload.overview),
        practiceAreas,
        preferredEntities,
        targetWorkTypes,
        targetProvinces,
        minimumContractValue: normalizeNumber(payload.minimumContractValue),
        maximumContractValue: normalizeNumber(payload.maximumContractValue),
      },
    })

    return { organization, firmProfile }
  })

  let opportunityRefresh = null

  if (radarSettingsChanged) {
    opportunityRefresh = await matchExistingOpportunitiesForOrganization(organizationId, {
      replaceExistingSourceMatches: true,
    })
  }

  await expireCacheTags(
    dashboardCacheTag(organizationId),
    organizationCacheTag(organizationId)
  )

  return Response.json({
    ...updated,
    opportunityRefresh,
  })
}
