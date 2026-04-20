import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { unlink } from 'fs/promises'
import path from 'path'
import { expireCacheTags, tenderDetailCacheTag, tenderPackCacheTag, tendersListCacheTag } from '@/lib/cache-tags'
import { getSessionOrganizationId } from '@/lib/organization'
import { parseRecordId } from '@/lib/tenders'
import { refreshSubmissionPack } from '@/lib/submission-pack'
import { SUBMISSION_BACKUP_DOCUMENT_CATEGORY } from '@/lib/tender-document-categories'

// GET /api/tenders/:id/documents
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id } = await params
  const tenderId = parseRecordId(id)
  if (!tenderId) return Response.json({ error: 'Tender not found' }, { status: 404 })
  const docs = await prisma.tenderDocument.findMany({
    where: {
      tenderId,
      tender: { organizationId },
    },
    orderBy: { uploadedAt: 'desc' },
  })

  return Response.json(docs)
}

// DELETE /api/tenders/:id/documents/:docId  handled via query param
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id } = await params
  const tenderId = parseRecordId(id)
  if (!tenderId) return Response.json({ error: 'Tender not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const docId = searchParams.get('docId')

  if (!docId) return Response.json({ error: 'docId required' }, { status: 400 })
  const parsedDocId = parseRecordId(docId)
  if (!parsedDocId) return Response.json({ error: 'Not found' }, { status: 404 })

  const doc = await prisma.tenderDocument.findFirst({
    where: {
      id: parsedDocId,
      tenderId,
      tender: { organizationId },
    },
  })
  if (!doc) return Response.json({ error: 'Not found' }, { status: 404 })

  // Delete the physical file
  try {
    await unlink(path.join(process.cwd(), 'public', doc.filepath))
  } catch {
    // File might already be gone — continue anyway
  }

  await prisma.tenderDocument.delete({ where: { id: parsedDocId } })
  if (doc.documentCategory === SUBMISSION_BACKUP_DOCUMENT_CATEGORY) {
    await refreshSubmissionPack({
      tenderId,
      organizationId,
    })
  }
  await expireCacheTags(
    tendersListCacheTag(organizationId),
    tenderDetailCacheTag(organizationId, tenderId),
    tenderPackCacheTag(organizationId, tenderId)
  )

  return Response.json({ success: true })
}
