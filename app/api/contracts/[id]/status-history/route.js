import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { getSessionOrganizationId } from '@/lib/organization'

/**
 * GET /api/contracts/:id/status-history
 *
 * Retrieves the status change history for a contract.
 * Returns a list of all status changes (both appointmentStatus and instructionStatus) in reverse chronological order.
 *
 * Query parameters:
 * - fieldName: Filter by specific field ('appointmentStatus' or 'instructionStatus', default: both)
 * - limit: Number of records to return (default: 50, max: 500)
 * - offset: Number of records to skip (default: 0)
 */
export async function GET(request, { params }) {
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
  const contractId = parseInt(id, 10)

  if (Number.isNaN(contractId)) {
    return Response.json({ error: 'Invalid contract ID' }, { status: 400 })
  }

  // Verify contract exists and belongs to organization
  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId,
    },
    select: { id: true },
  })

  if (!contract) {
    return Response.json({ error: 'Contract not found' }, { status: 404 })
  }

  // Parse query parameters
  const url = new URL(request.url)
  const fieldName = url.searchParams.get('fieldName')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 500)
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0)

  // Build where clause
  const where = { contractId }
  if (fieldName && ['appointmentStatus', 'instructionStatus'].includes(fieldName)) {
    where.fieldName = fieldName
  }

  // Fetch status history
  const [statusChanges, totalCount] = await Promise.all([
    prisma.contractStatusChange.findMany({
      where,
      include: {
        changedBy: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { changedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.contractStatusChange.count({
      where,
    }),
  ])

  return Response.json(
    {
      data: statusChanges,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    },
    {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    }
  )
}
