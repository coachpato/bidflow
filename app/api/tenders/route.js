import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { findAssignedUser, notifyTenderAssignees } from '@/lib/tender-assignment'
import { buildTenderChecklistItems } from '@/lib/tender-defaults'
import { ensureOrganizationContext } from '@/lib/organization'
import { refreshTenderQualification } from '@/lib/tender-qualification'
import { refreshSubmissionPack } from '@/lib/submission-pack'

function parseAssignedUserId(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

async function resolveAssignedFields(body) {
  const assignedUserId = parseAssignedUserId(body.assignedUserId)

  if (assignedUserId) {
    const assignedUser = await findAssignedUser(assignedUserId)

    if (assignedUser) {
      return {
        assignedUserId: assignedUser.id,
        assignedTo: assignedUser.name || assignedUser.email,
      }
    }
  }

  return {
    assignedUserId: null,
    assignedTo: body.assignedTo?.trim() || null,
  }
}

export async function GET(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureOrganizationContext(session.userId)

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const where = {}

  if (status && status !== 'active') {
    where.status = status
  } else if (status === 'active') {
    where.status = { in: ['New', 'Under Review', 'In Progress'] }
  }

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { reference: { contains: search } },
      { entity: { contains: search } },
    ]
  }

  const tenders = await prisma.tender.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { name: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      qualification: {
        select: {
          verdict: true,
          readinessPercent: true,
          blockerCount: true,
          warningCount: true,
        },
      },
      _count: { select: { checklistItems: true, documents: true } },
    },
  })

  return Response.json(tenders)
}

export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const body = await request.json()

  if (!body.title || !body.entity) {
    return Response.json({ error: 'Title and issuing entity are required' }, { status: 400 })
  }

  const assignment = await resolveAssignedFields(body)

  const tender = await prisma.tender.create({
    data: {
      title: body.title,
      reference: body.reference || null,
      entity: body.entity,
      description: body.description || null,
      deadline: body.deadline ? new Date(body.deadline) : null,
      briefingDate: body.briefingDate ? new Date(body.briefingDate) : null,
      contactPerson: body.contactPerson || null,
      contactEmail: body.contactEmail || null,
      status: body.status || 'New',
      assignedTo: assignment.assignedTo,
      assignedUserId: assignment.assignedUserId,
      notes: body.notes || null,
      userId: session.userId,
    },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  })

  await prisma.tenderChecklistItem.createMany({
    data: buildTenderChecklistItems().map(item => ({
      ...item,
      tenderId: tender.id,
    })),
  })

  await logActivity(`Created tender: ${tender.title}`, {
    userId: session.userId,
    tenderId: tender.id,
  })

  await notifyTenderAssignees({
    tender,
    assignedUserId: tender.assignedUserId,
    assignedTo: tender.assignedTo,
    actorName: session.name,
  })

  await refreshTenderQualification({
    tenderId: tender.id,
    organizationId: organizationContext.organization.id,
  })
  await refreshSubmissionPack({
    tenderId: tender.id,
    organizationId: organizationContext.organization.id,
  })

  return Response.json(tender, { status: 201 })
}
