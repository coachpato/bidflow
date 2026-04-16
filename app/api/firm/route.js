import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureOrganizationContext } from '@/lib/organization'

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

  const organizationContext = await ensureOrganizationContext(session.userId)

  return Response.json({
    organization: organizationContext.organization,
    membership: organizationContext.membership,
    firmProfile: organizationContext.firmProfile,
  })
}

export async function PUT(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationContext = await ensureOrganizationContext(session.userId)
  const payload = await request.json()

  const displayName = normalizeString(payload.displayName)

  if (!displayName) {
    return Response.json({ error: 'Firm display name is required.' }, { status: 400 })
  }

  const updated = await prisma.$transaction(async tx => {
    const organization = await tx.organization.update({
      where: { id: organizationContext.organization.id },
      data: { name: displayName },
    })

    const firmProfile = await tx.firmProfile.update({
      where: { organizationId: organizationContext.organization.id },
      data: {
        displayName,
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

  return Response.json(updated)
}
