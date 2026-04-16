import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { ensureOrganizationContext } from '@/lib/organization'
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

export async function DELETE(_request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id, docId } = await params
  const appealId = parseInt(id, 10)
  const documentId = parseInt(docId, 10)

  const appeal = await prisma.appeal.findFirst({
    where: {
      id: appealId,
      organizationId: organizationContext.organization.id,
    },
    select: { id: true },
  })

  if (!appeal) return Response.json({ error: 'Challenge not found.' }, { status: 404 })

  const document = await prisma.appealDocument.findFirst({
    where: {
      id: documentId,
      appealId,
    },
  })

  if (!document) return Response.json({ error: 'Document not found.' }, { status: 404 })

  try {
    const supabase = getSupabaseAdmin()
    const urlParts = document.filepath.split(`/object/public/${STORAGE_BUCKET}/`)

    if (urlParts.length === 2) {
      await supabase.storage.from(STORAGE_BUCKET).remove([urlParts[1]])
    }
  } catch (error) {
    console.error('Appeal document delete error:', error)
  }

  await prisma.appealDocument.delete({
    where: { id: documentId },
  })

  await logActivity(`Removed challenge ${document.documentType.toLowerCase()} document: ${document.filename}`, {
    userId: session.userId,
    appealId,
  })

  return Response.json({ success: true })
}
