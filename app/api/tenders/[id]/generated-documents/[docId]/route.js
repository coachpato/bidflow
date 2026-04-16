import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { ensureOrganizationContext } from '@/lib/organization'
import { getSession } from '@/lib/session'
import { refreshSubmissionPack } from '@/lib/submission-pack'

function normalizeString(value) {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || ''
}

export async function PATCH(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationContext = await ensureOrganizationContext(session.userId)
  const { id, docId } = await params
  const tenderId = Number.parseInt(id, 10)
  const generatedDocumentId = Number.parseInt(docId, 10)
  const body = await request.json()

  const existing = await prisma.generatedDocument.findFirst({
    where: {
      id: generatedDocumentId,
      tenderId,
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
    organizationId: organizationContext.organization.id,
  })

  await logActivity(`Updated generated document: ${updated.documentType}`, {
    userId: session.userId,
    tenderId,
  })

  return Response.json(updated)
}
