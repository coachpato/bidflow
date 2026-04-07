import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

// GET /api/appeals/:id
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const appeal = await prisma.appeal.findUnique({
    where: { id: parseInt(id) },
    include: {
      tender: { select: { title: true, id: true, entity: true, reference: true } },
      activities: { orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { name: true } } } },
    },
  })

  if (!appeal) return Response.json({ error: 'Not found' }, { status: 404 })

  return Response.json(appeal)
}

// PATCH /api/appeals/:id
export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()

  const existing = await prisma.appeal.findUnique({ where: { id: parseInt(id) } })
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })

  const updated = await prisma.appeal.update({
    where: { id: parseInt(id) },
    data: {
      reason: body.reason ?? existing.reason,
      deadline: body.deadline ? new Date(body.deadline) : existing.deadline,
      status: body.status ?? existing.status,
      notes: body.notes ?? existing.notes,
      template: body.template ?? existing.template,
    },
  })

  await logActivity(`Updated appeal: ${updated.reason.substring(0, 60)}`, {
    userId: session.userId,
    appealId: updated.id,
  })

  return Response.json(updated)
}

// DELETE /api/appeals/:id
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await prisma.appeal.delete({ where: { id: parseInt(id) } })

  return Response.json({ success: true })
}
