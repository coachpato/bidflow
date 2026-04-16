import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

// DELETE /api/tenders/:id/documents/:docId
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { docId } = await params

  const doc = await prisma.tenderDocument.findUnique({ where: { id: parseInt(docId) } })
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

  await prisma.tenderDocument.delete({ where: { id: parseInt(docId) } })

  return Response.json({ success: true })
}
