import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { getSessionOrganizationId } from '@/lib/organization'
import { findTenderForOrganization, parseRecordId } from '@/lib/tenders'

/**
 * GET /api/tenders/:id/status-history
 *
 * Retrieves the status change history for a tender.
 * Returns a list of all status changes in reverse chronological order (newest first).
 *
 * Query parameters:
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
  const tenderId = parseRecordId(id)
  if (!tenderId) {
    return Response.json({ error: 'Tender not found' }, { status: 404 })
  }

  // Verify tender exists and belongs to organization
  const tender = await findTenderForOrganization({
    tenderId,
    organizationId,
    select: { id: true },
  })

  if (!tender) {
    return Response.json({ error: 'Tender not found' }, { status: 404 })
  }

  // Parse query parameters
  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 500)
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0)

  // Fetch status history
  const [statusChanges, totalCount] = await Promise.all([
    prisma.tenderStatusChange.findMany({
      where: { tenderId },
      include: {
        changedBy: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { changedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.tenderStatusChange.count({
      where: { tenderId },
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
