import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { notifyContractAssignees } from '@/lib/contract-notifications'
import { findAssignedUser } from '@/lib/tender-assignment'
import { ensureOrganizationContext } from '@/lib/organization'

function toNullableNumber(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return parseFloat(value)
}

function parseAssignedUserId(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function toNullableDate(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
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

// GET /api/contracts
export async function GET() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const contracts = await prisma.contract.findMany({
    where: {
      organizationId: organizationContext.organization.id,
    },
    orderBy: { createdAt: 'desc' },
    include: {
      tender: { select: { title: true, id: true } },
      assignedUser: { select: { id: true, name: true, email: true } },
      _count: { select: { documents: true, milestones: true } },
    },
  })

  return Response.json(contracts, {
    headers: {
      'Cache-Control': 'private, no-store',
    },
  })
}

// POST /api/contracts
export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const body = await request.json()

  if (!body.title) {
    return Response.json({ error: 'Contract title is required' }, { status: 400 })
  }

  const assignment = await resolveAssignedFields(body)

  const contract = await prisma.contract.create({
    data: {
      organizationId: organizationContext.organization.id,
      title: body.title,
      client: body.client || null,
      assignedTo: assignment.assignedTo,
      assignedUserId: assignment.assignedUserId,
      appointmentStatus: body.appointmentStatus || 'Appointed',
      instructionStatus: body.instructionStatus || 'No Instruction',
      appointmentDate: toNullableDate(body.appointmentDate),
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      renewalDate: body.renewalDate ? new Date(body.renewalDate) : null,
      cancelDate: body.cancelDate ? new Date(body.cancelDate) : null,
      firstInstructionDate: toNullableDate(body.firstInstructionDate),
      lastFollowUpAt: toNullableDate(body.lastFollowUpAt),
      nextFollowUpAt: toNullableDate(body.nextFollowUpAt),
      value: toNullableNumber(body.value),
      milestoneSummary: body.milestoneSummary || null,
      notes: body.notes || null,
      tenderId: body.tenderId ? parseInt(body.tenderId, 10) : null,
    },
    include: {
      assignedUser: { select: { id: true, name: true, email: true } },
    },
  })

  await logActivity(`Created contract: ${contract.title}`, {
    userId: session.userId,
    contractId: contract.id,
  })

  await notifyContractAssignees({
    contract,
    assignedUserId: contract.assignedUserId,
    assignedTo: contract.assignedTo,
    actorName: session.name,
  })

  return Response.json(contract, { status: 201 })
}
