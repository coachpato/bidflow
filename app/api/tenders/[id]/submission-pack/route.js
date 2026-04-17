import { logActivity } from '@/lib/activity'
import { getSessionOrganizationId } from '@/lib/organization'
import { getSession } from '@/lib/session'
import { refreshSubmissionPack } from '@/lib/submission-pack'
import { findTenderForOrganization, parseRecordId } from '@/lib/tenders'
import { getCachedTenderSubmissionPack } from '@/lib/tender-read-model'

async function buildResponse(organizationId, tenderId) {
  return getCachedTenderSubmissionPack({
    organizationId,
    tenderId,
  })
}

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const { id } = await params
  const tenderId = parseRecordId(id)
  if (!tenderId) return Response.json({ error: 'Tender not found.' }, { status: 404 })

  const tender = await findTenderForOrganization({
    tenderId,
    organizationId,
    select: { id: true },
  })
  if (!tender) return Response.json({ error: 'Tender not found.' }, { status: 404 })

  return Response.json(await buildResponse(organizationId, tenderId))
}

export async function POST(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const { id } = await params
  const tenderId = parseRecordId(id)
  if (!tenderId) return Response.json({ error: 'Tender not found.' }, { status: 404 })
  const body = await request.json().catch(() => ({}))

  const tender = await findTenderForOrganization({
    tenderId,
    organizationId,
    select: { id: true },
  })
  if (!tender) return Response.json({ error: 'Tender not found.' }, { status: 404 })

  await refreshSubmissionPack({
    tenderId,
    organizationId,
    regenerate: Boolean(body?.regenerate),
  })

  if (body?.regenerate) {
    void logActivity('Regenerated submission pack drafts', {
      userId: session.userId,
      tenderId,
    })
  }

  return Response.json(await buildResponse(organizationId, tenderId))
}
