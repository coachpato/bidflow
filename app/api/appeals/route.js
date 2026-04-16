import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { ensureOrganizationContext } from '@/lib/organization'
import { notifyChallengeCreated } from '@/lib/challenge-notifications'

// GET /api/appeals
export async function GET(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const appeals = await prisma.appeal.findMany({
    where: {
      organizationId: organizationContext.organization.id,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      tender: {
        select: {
          title: true,
          id: true,
          entity: true,
          assignedUserId: true,
          assignedTo: true,
        },
      },
      _count: { select: { documents: true } },
    },
  })

  return Response.json(appeals, {
    headers: {
      'Cache-Control': 'private, no-store',
    },
  })
}

// POST /api/appeals
export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const body = await request.json()

  if (!body.reason) {
    return Response.json({ error: 'Appeal reason is required' }, { status: 400 })
  }

  const appeal = await prisma.appeal.create({
    data: {
      organizationId: organizationContext.organization.id,
      reason: body.reason,
      challengeType: body.challengeType || 'Administrative Appeal',
      exclusionReason: body.exclusionReason || null,
      exclusionDate: body.exclusionDate ? new Date(body.exclusionDate) : null,
      deadline: body.deadline ? new Date(body.deadline) : null,
      status: body.status || 'Pending',
      submittedAt: body.submittedAt ? new Date(body.submittedAt) : null,
      resolvedAt: body.resolvedAt ? new Date(body.resolvedAt) : null,
      requestedRelief: body.requestedRelief || null,
      nextStep: body.nextStep || null,
      evidenceChecklist: Array.isArray(body.evidenceChecklist) ? body.evidenceChecklist : null,
      notes: body.notes || null,
      template: body.template || null,
      tenderId: body.tenderId ? parseInt(body.tenderId) : null,
    },
    include: {
      tender: {
        select: {
          title: true,
          id: true,
          entity: true,
          assignedUserId: true,
          assignedTo: true,
        },
      },
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
      title: 'Challenge opened',
      message: `New challenge created${body.tenderId ? ' (linked to pursuit)' : ''}: ${body.reason.substring(0, 80)}`,
      type: 'warning',
      organizationId: organizationContext.organization.id,
      linkUrl: `/challenges/${appeal.id}`,
      linkLabel: 'Open challenge',
    },
  })

  await notifyChallengeCreated({
    challenge: appeal,
  })

  return Response.json(appeal, { status: 201 })
}
