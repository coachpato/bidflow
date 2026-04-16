import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { ensureOrganizationContext } from '@/lib/organization'

function toNullableDate(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return new Date(value)
}

export async function GET(_request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id } = await params
  const contractId = parseInt(id, 10)

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId: organizationContext.organization.id,
    },
    select: { id: true },
  })

  if (!contract) return Response.json({ error: 'Appointment not found.' }, { status: 404 })

  const milestones = await prisma.contractMilestone.findMany({
    where: { contractId },
    orderBy: [{ completedAt: 'asc' }, { dueDate: 'asc' }, { id: 'asc' }],
  })

  return Response.json(milestones)
}

export async function POST(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id } = await params
  const contractId = parseInt(id, 10)
  const body = await request.json()

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId: organizationContext.organization.id,
    },
    select: { id: true, title: true },
  })

  if (!contract) return Response.json({ error: 'Appointment not found.' }, { status: 404 })
  if (!body.title?.trim()) return Response.json({ error: 'Milestone title is required.' }, { status: 400 })

  const milestone = await prisma.contractMilestone.create({
    data: {
      contractId,
      title: body.title.trim(),
      dueDate: toNullableDate(body.dueDate),
      completedAt: toNullableDate(body.completedAt),
      notes: body.notes?.trim() || null,
    },
  })

  await logActivity(`Added appointment milestone: ${milestone.title}`, {
    userId: session.userId,
    contractId,
  })

  return Response.json(milestone, { status: 201 })
}
