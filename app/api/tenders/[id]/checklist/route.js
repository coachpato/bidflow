import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { expireCacheTags, tendersListCacheTag } from '@/lib/cache-tags'
import { getSessionOrganizationId } from '@/lib/organization'
import { refreshTenderQualification } from '@/lib/tender-qualification'
import { refreshSubmissionPack } from '@/lib/submission-pack'
import { findTenderForOrganization, parseRecordId } from '@/lib/tenders'

// GET /api/tenders/:id/checklist
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id } = await params
  const tenderId = parseRecordId(id)
  if (!tenderId) return Response.json({ error: 'Tender not found' }, { status: 404 })
  const items = await prisma.tenderChecklistItem.findMany({
    where: {
      tenderId,
      tender: { organizationId },
    },
    orderBy: { id: 'asc' },
  })

  return Response.json(items)
}

// POST /api/tenders/:id/checklist — add a new item
export async function POST(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id } = await params
  const tenderId = parseRecordId(id)
  if (!tenderId) return Response.json({ error: 'Tender not found' }, { status: 404 })
  const { label, responsible, dueDate, notes } = await request.json()

  if (!label) return Response.json({ error: 'Label is required' }, { status: 400 })
  const tender = await findTenderForOrganization({
    tenderId,
    organizationId,
    select: { id: true },
  })
  if (!tender) return Response.json({ error: 'Tender not found' }, { status: 404 })

  const item = await prisma.tenderChecklistItem.create({
    data: {
      label,
      responsible: responsible || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      notes: notes || null,
      tenderId,
    },
  })

  void logActivity(`Added checklist item: ${label}`, {
    userId: session.userId,
    tenderId,
  })

  await refreshTenderQualification({
    tenderId,
    organizationId,
  })
  await refreshSubmissionPack({
    tenderId,
    organizationId,
  })
  await expireCacheTags(tendersListCacheTag(organizationId))

  return Response.json(item, { status: 201 })
}
