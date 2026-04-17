import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getSessionOrganizationId } from '@/lib/organization'

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

function normalizeInteger(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const personnel = await prisma.firmPerson.findMany({
    where: { organizationId },
    orderBy: [{ yearsExperience: 'desc' }, { fullName: 'asc' }],
  })

  return Response.json(personnel)
}

export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const payload = await request.json()
  const fullName = normalizeString(payload.fullName)

  if (!fullName) {
    return Response.json({ error: 'Full name is required.' }, { status: 400 })
  }

  const person = await prisma.firmPerson.create({
    data: {
      organizationId,
      fullName,
      title: normalizeString(payload.title),
      email: normalizeString(payload.email),
      phone: normalizeString(payload.phone),
      yearsExperience: normalizeInteger(payload.yearsExperience),
      qualifications: normalizeList(payload.qualifications),
      practiceAreas: normalizeList(payload.practiceAreas),
      notes: normalizeString(payload.notes),
    },
  })

  return Response.json(person, { status: 201 })
}
