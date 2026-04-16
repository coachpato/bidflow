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

function normalizeInteger(value) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

async function getAuthorizedPerson(id, userId) {
  const organizationContext = await ensureOrganizationContext(userId)
  const person = await prisma.firmPerson.findFirst({
    where: {
      id,
      organizationId: organizationContext.organization.id,
    },
  })

  return { organizationContext, person }
}

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const personId = Number.parseInt(id, 10)
  if (Number.isNaN(personId)) return Response.json({ error: 'Invalid person id.' }, { status: 400 })

  const { person } = await getAuthorizedPerson(personId, session.userId)
  if (!person) return Response.json({ error: 'Person not found.' }, { status: 404 })

  const payload = await request.json()
  const fullName = normalizeString(payload.fullName)

  if (!fullName) {
    return Response.json({ error: 'Full name is required.' }, { status: 400 })
  }

  const updated = await prisma.firmPerson.update({
    where: { id: personId },
    data: {
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

  return Response.json(updated)
}

export async function DELETE(_request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const personId = Number.parseInt(id, 10)
  if (Number.isNaN(personId)) return Response.json({ error: 'Invalid person id.' }, { status: 400 })

  const { person } = await getAuthorizedPerson(personId, session.userId)
  if (!person) return Response.json({ error: 'Person not found.' }, { status: 404 })

  await prisma.firmPerson.delete({
    where: { id: personId },
  })

  return Response.json({ success: true })
}
