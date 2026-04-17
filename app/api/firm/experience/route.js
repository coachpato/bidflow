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

export async function GET() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const experience = await prisma.firmExperience.findMany({
    where: { organizationId },
    orderBy: [{ completedYear: 'desc' }, { matterName: 'asc' }],
  })

  return Response.json(experience)
}

export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const payload = await request.json()
  const matterName = normalizeString(payload.matterName)

  if (!matterName) {
    return Response.json({ error: 'Matter name is required.' }, { status: 400 })
  }

  const experience = await prisma.firmExperience.create({
    data: {
      organizationId,
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

  return Response.json(experience, { status: 201 })
}
