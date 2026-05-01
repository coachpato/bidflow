import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { ROLES, ROLE_NAMES, TENDER_STATUSES } from '@/lib/status-machine'
import { getUserRoleFromSession } from '@/lib/roles'
import {
  dashboardCacheTag,
  expireCacheTags,
  tenderDetailCacheTag,
  tendersListCacheTag,
} from '@/lib/cache-tags'
import { notifyContractAssignees } from '@/lib/contract-notifications'
import { findAssignedUser } from '@/lib/tender-assignment'
import { getSessionOrganizationId } from '@/lib/organization'
import { findTenderForOrganization, parseRecordId } from '@/lib/tenders'

function toNullableDate(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toNullableNumber(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return parseFloat(value)
}

async function resolveAssignedFields(body) {
  const assignedUserId = typeof body.assignedUserId === 'string'
    ? parseInt(body.assignedUserId, 10)
    : body.assignedUserId

  if (assignedUserId && !Number.isNaN(assignedUserId)) {
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

/**
 * POST /api/tenders/:id/convert-to-contract
 *
 * Converts a tender to a contract.
 *
 * Request body:
 * - appointmentStatus: "Appointed" | "Not Appointed" | "Pending" (default: "Appointed")
 * - appointmentDate: ISO 8601 date string
 * - instructionStatus: "No Instruction" | "Instruction Received" | "Work Complete" (default: "No Instruction")
 * - firstInstructionDate: ISO 8601 date string
 * - value: contract value (optional)
 * - startDate: ISO 8601 date string (optional)
 * - endDate: ISO 8601 date string (optional)
 * - renewalDate: ISO 8601 date string (optional)
 * - assignedUserId: user ID for contract assignment (optional)
 * - assignedTo: user name for assignment (optional)
 * - notes: contract notes (optional)
 */
export async function POST(request, { params }) {
  const session = await getSession()
  if (!session.userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) {
    return Response.json(
      { error: 'Organization context is missing.' },
      { status: 400 }
    )
  }

  const { id } = await params
  const tenderId = parseRecordId(id)
  if (!tenderId) {
    return Response.json({ error: 'Tender not found' }, { status: 404 })
  }

  // Fetch the tender to ensure it exists and belongs to the organization
  const tender = await findTenderForOrganization({
    tenderId,
    organizationId,
    select: {
      id: true,
      title: true,
      reference: true,
      entity: true,
      description: true,
      deadline: true,
      briefingDate: true,
      contactPerson: true,
      contactEmail: true,
      status: true,
      assignedTo: true,
      assignedUserId: true,
      notes: true,
      documents: {
        select: {
          id: true,
          filename: true,
          filepath: true,
          documentCategory: true,
        },
      },
      contract: { select: { id: true } },
    },
  })

  if (!tender) {
    return Response.json({ error: 'Tender not found' }, { status: 404 })
  }

  // Prevent duplicate contracts (idempotent check)
  if (tender.contract) {
    return Response.json(
      {
        error: 'Contract already exists for this tender',
        contractId: tender.contract.id,
      },
      { status: 409 }
    )
  }

  // =========================================================================
  // RBAC CHECK: Only MANAGER and ADMIN can convert tender to contract
  // =========================================================================
  const userRole = getUserRoleFromSession(session)
  if (userRole < ROLES.MANAGER) {
    return Response.json(
      {
        error: `Converting a tender to contract requires ${ROLE_NAMES[ROLES.MANAGER]} role. You are ${ROLE_NAMES[userRole]}.`,
        code: 'INSUFFICIENT_ROLE',
        requiredRole: ROLE_NAMES[ROLES.MANAGER],
        userRole: ROLE_NAMES[userRole],
      },
      { status: 403 }
    )
  }

  if (tender.status !== TENDER_STATUSES.AWARDED) {
    return Response.json(
      {
        error: 'Record the pursuit as Awarded before converting it to a contract.',
        code: 'PURSUIT_NOT_AWARDED',
      },
      { status: 400 }
    )
  }

  const body = await request.json()

  // Resolve assignment
  const assignment = await resolveAssignedFields(body)

  try {
    const contract = await prisma.$transaction(async tx => {
      const createdContract = await tx.contract.create({
        data: {
          organizationId,
          title: tender.title,
          client: tender.entity,
          appointmentStatus: body.appointmentStatus || 'Appointed',
          instructionStatus: body.instructionStatus || 'No Instruction',
          appointmentDate: toNullableDate(body.appointmentDate),
          firstInstructionDate: toNullableDate(body.firstInstructionDate),
          startDate: toNullableDate(body.startDate),
          endDate: toNullableDate(body.endDate),
          renewalDate: toNullableDate(body.renewalDate),
          value: toNullableNumber(body.value),
          notes: body.notes ? body.notes : `Converted from tender: ${tender.reference || tender.title}`,
          tenderId: tender.id,
          assignedUserId: assignment.assignedUserId,
          assignedTo: assignment.assignedTo,
          documents: {
            create: tender.documents.map((doc) => ({
              filename: doc.filename,
              filepath: doc.filepath,
              documentType: 'SOURCE',
            })),
          },
        },
        include: {
          assignedUser: { select: { id: true, name: true, email: true } },
          _count: { select: { documents: true, milestones: true } },
        },
      })

      return createdContract
    })

    // Log the conversion activity with user role
    const userRoleName = ROLE_NAMES[userRole]
    await logActivity(
      `Tender "${tender.title}" converted to contract (ID: ${contract.id}) by ${userRoleName}`,
      {
        userId: session.userId,
        tenderId: tender.id,
        contractId: contract.id,
      }
    )

    // Notify assignees if a user was assigned
    if (contract.assignedUserId || contract.assignedTo) {
      await notifyContractAssignees({
        contract,
        assignedUserId: contract.assignedUserId,
        assignedTo: contract.assignedTo,
        actorName: session.name,
      })
    }

    // Invalidate relevant caches
    await expireCacheTags(
      dashboardCacheTag(organizationId),
      tendersListCacheTag(organizationId),
      tenderDetailCacheTag(organizationId, tenderId)
    )

    return Response.json(
      {
        success: true,
        contractId: contract.id,
        contract,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error converting tender to contract:', error)
    return Response.json(
      { error: 'Failed to convert tender to contract' },
      { status: 500 }
    )
  }
}
