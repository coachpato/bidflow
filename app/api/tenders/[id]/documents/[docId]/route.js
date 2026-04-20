import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { expireCacheTags, tenderDetailCacheTag, tenderPackCacheTag, tendersListCacheTag } from '@/lib/cache-tags'
import { getSessionOrganizationId } from '@/lib/organization'
import { parseRecordId } from '@/lib/tenders'
import { refreshSubmissionPack } from '@/lib/submission-pack'
import { SUBMISSION_BACKUP_DOCUMENT_CATEGORY } from '@/lib/tender-document-categories'

// DELETE /api/tenders/:id/documents/:docId
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

  const { id, docId } = await params
  const tenderId = parseRecordId(id)
  const parsedDocId = parseRecordId(docId)
  if (!tenderId || !parsedDocId) return Response.json({ error: 'Not found' }, { status: 404 })

  const doc = await prisma.tenderDocument.findFirst({
    where: {
      id: parsedDocId,
      tenderId,
      tender: { organizationId },
    },
  })
  if (!doc) return Response.json({ error: 'Not found' }, { status: 404 })

  // Delete from Supabase Storage
  // The filepath is the full public URL — extract just the storage path
  try {
    const supabase = getSupabaseAdmin()
    // Extract the path after /object/public/tender-docs/
    const urlParts = doc.filepath.split(`/object/public/${STORAGE_BUCKET}/`)
    if (urlParts.length === 2) {
      await supabase.storage.from(STORAGE_BUCKET).remove([urlParts[1]])
    }
  } catch (err) {
    console.error('Supabase delete error:', err)
    // Continue anyway — remove the DB record even if storage delete fails
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
