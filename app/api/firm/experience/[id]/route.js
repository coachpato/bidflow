import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getSessionOrganizationId } from '@/lib/organization'

function normalizeString(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeInteger(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function getAuthorizedExperience(id, organizationId) {
  const experience = await prisma.firmExperience.findFirst({
    where: {
      id,
      organizationId,
    },
  })

  return experience
}

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const experienceId = Number.parseInt(id, 10)
  if (Number.isNaN(experienceId)) return Response.json({ error: 'Invalid experience id.' }, { status: 400 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const experience = await getAuthorizedExperience(experienceId, organizationId)
  if (!experience) return Response.json({ error: 'Experience record not found.' }, { status: 404 })

  const payload = await request.json()
  const matterName = normalizeString(payload.matterName)

  if (!matterName) {
    return Response.json({ error: 'Matter name is required.' }, { status: 400 })
  }

  const updated = await prisma.firmExperience.update({
    where: { id: experienceId },
    data: {
      matterName,
      clientName: normalizeString(payload.clientName),
      entityName: normalizeString(payload.entityName),
      practiceArea: normalizeString(payload.practiceArea),
      workType: normalizeString(payload.workType),
      summary: normalizeString(payload.summary),
      projectValue: normalizeNumber(payload.projectValue),
      startedYear: normalizeInteger(payload.startedYear),
      completedYear: normalizeInteger(payload.completedYear),
    },
  })

  return Response.json(updated)
}

export async function DELETE(_request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const experienceId = Number.parseInt(id, 10)
  if (Number.isNaN(experienceId)) return Response.json({ error: 'Invalid experience id.' }, { status: 400 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const experience = await getAuthorizedExperience(experienceId, organizationId)
  if (!experience) return Response.json({ error: 'Experience record not found.' }, { status: 404 })

  await prisma.firmExperience.delete({
    where: { id: experienceId },
  })

  return Response.json({ success: true })
}
