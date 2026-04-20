import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { dashboardCacheTag, expireCacheTags, organizationCacheTag } from '@/lib/cache-tags'
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

export async function GET() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      firmProfile: true,
    },
  })

  if (!organization) {
    return Response.json({ error: 'Organization not found.' }, { status: 404 })
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
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const payload = await request.json()

  const displayName = normalizeString(payload.displayName)

  if (!displayName) {
    return Response.json({ error: 'Firm display name is required.' }, { status: 400 })
  }

  const updated = await prisma.$transaction(async tx => {
    const organization = await tx.organization.update({
      where: { id: organizationId },
      data: { name: displayName },
    })

    const firmProfile = await tx.firmProfile.update({
      where: { organizationId },
      data: {
        displayName,
        serviceSector: normalizeServiceSector(payload.serviceSector),
        legalName: normalizeString(payload.legalName),
        registrationNumber: normalizeString(payload.registrationNumber),
        primaryContactName: normalizeString(payload.primaryContactName),
        primaryContactEmail: normalizeString(payload.primaryContactEmail),
        primaryContactPhone: normalizeString(payload.primaryContactPhone),
        website: normalizeString(payload.website),
        overview: normalizeString(payload.overview),
        practiceAreas: normalizeList(payload.practiceAreas),
        preferredEntities: normalizeList(payload.preferredEntities),
        targetWorkTypes: normalizeList(payload.targetWorkTypes),
        targetProvinces: normalizeList(payload.targetProvinces),
        minimumContractValue: normalizeNumber(payload.minimumContractValue),
        maximumContractValue: normalizeNumber(payload.maximumContractValue),
      },
    })

    return { organization, firmProfile }
  })

  await expireCacheTags(
    dashboardCacheTag(organizationId),
    organizationCacheTag(organizationId)
  )

  return Response.json(updated)
}
