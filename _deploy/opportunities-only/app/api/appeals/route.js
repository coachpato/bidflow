import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

// GET /api/appeals
export async function GET(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const appeals = await prisma.appeal.findMany({
    orderBy: { createdAt: 'desc' },
    include: { tender: { select: { title: true, id: true, entity: true } } },
  })

  return Response.json(appeals)
}

// POST /api/appeals
export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  if (!body.reason) {
    return Response.json({ error: 'Appeal reason is required' }, { status: 400 })
  }

  const appeal = await prisma.appeal.create({
    data: {
      reason: body.reason,
      deadline: body.deadline ? new Date(body.deadline) : null,
      status: body.status || 'Pending',
      notes: body.notes || null,
      template: body.template || null,
      tenderId: body.tenderId ? parseInt(body.tenderId) : null,
    },
  })

  await logActivity(`Created appeal for tender ID ${body.tenderId || 'N/A'}: ${body.reason.substring(0, 60)}`, {
    userId: session.userId,
    appealId: appeal.id,
    tenderId: body.tenderId ? parseInt(body.tenderId) : null,
  })

  // Create notification
  await prisma.notification.create({
    data: {
      message: `New appeal created${body.tenderId ? ' (linked to tender)' : ''}: ${body.reason.substring(0, 80)}`,
      type: 'warning',
    },
  })

  return Response.json(appeal, { status: 201 })
}
