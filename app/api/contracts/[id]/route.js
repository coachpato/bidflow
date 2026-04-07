import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

// GET /api/contracts/:id
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const contract = await prisma.contract.findUnique({
    where: { id: parseInt(id) },
    include: {
      tender: { select: { title: true, id: true, entity: true } },
      activities: { orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { name: true } } } },
    },
  })

  if (!contract) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json(contract)
}

// PATCH /api/contracts/:id
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const existing = await prisma.contract.findUnique({ where: { id: parseInt(id) } })
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.contract.update({
    where: { id: parseInt(id) },
    data: {
      title: body.title ?? existing.title,
      client: body.client ?? existing.client,
      startDate: body.startDate ? new Date(body.startDate) : existing.startDate,
      endDate: body.endDate ? new Date(body.endDate) : existing.endDate,
      renewalDate: body.renewalDate ? new Date(body.renewalDate) : existing.renewalDate,
      cancelDate: body.cancelDate ? new Date(body.cancelDate) : existing.cancelDate,
      value: body.value !== undefined ? parseFloat(body.value) : existing.value,
      notes: body.notes ?? existing.notes,
    },
  })

  await logActivity(`Updated contract: ${updated.title}`, {
    userId: session.userId,
    contractId: updated.id,
  })

  return Response.json(updated)
}

// DELETE /api/contracts/:id
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })

  const { id } = await params
  const existing = await prisma.contract.findUnique({ where: { id: parseInt(id) } })
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  await logActivity(`Deleted contract: ${existing.title}`, { userId: session.userId })
  await prisma.contract.delete({ where: { id: parseInt(id) } })

  return Response.json({ success: true })
}
