import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { getSessionOrganizationId } from '@/lib/organization'
import { getSession } from '@/lib/session'
import { refreshSubmissionPack } from '@/lib/submission-pack'
import { findTenderForOrganization, parseRecordId } from '@/lib/tenders'

function normalizeString(value) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || ''
}

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const { id, docId } = await params
  const tenderId = parseRecordId(id)
  const generatedDocumentId = parseRecordId(docId)
  if (!tenderId || !generatedDocumentId) {
    return Response.json({ error: 'Generated document not found.' }, { status: 404 })
  }
  const body = await request.json()

  const tender = await findTenderForOrganization({
    tenderId,
    organizationId,
    select: { id: true },
  })
  if (!tender) {
    return Response.json({ error: 'Tender not found.' }, { status: 404 })
  }

  const existing = await prisma.generatedDocument.findFirst({
    where: {
      id: generatedDocumentId,
      tenderId,
      tender: { organizationId },
    },
  })

  if (!existing) {
    return Response.json({ error: 'Generated document not found.' }, { status: 404 })
  }

  const updated = await prisma.generatedDocument.update({
    where: { id: generatedDocumentId },
    data: {
      title: normalizeString(body.title) ?? undefined,
      content: normalizeString(body.content) ?? undefined,
      status: normalizeString(body.status) || undefined,
      manualInputSummary: body.manualInputSummary !== undefined
        ? normalizeString(body.manualInputSummary) || null
        : undefined,
      requiresManualInput: typeof body.requiresManualInput === 'boolean'
        ? body.requiresManualInput
        : undefined,
    },
  })

  await refreshSubmissionPack({
    tenderId,
    organizationId,
  })

  void logActivity(`Updated generated document: ${updated.documentType}`, {
    userId: session.userId,
    tenderId,
  })

  return Response.json(updated)
}
