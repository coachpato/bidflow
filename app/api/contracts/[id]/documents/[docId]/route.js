import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { ensureOrganizationContext } from '@/lib/organization'

export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id, docId } = await params
  const contractId = parseInt(id, 10)
  const documentId = parseInt(docId, 10)

  const contract = await prisma.contract.findFirst({
    where: {
      id: contractId,
      organizationId: organizationContext.organization.id,
    },
    select: { id: true },
  })

  if (!contract) {
    return Response.json({ error: 'Contract not found.' }, { status: 404 })
  }

  const document = await prisma.contractDocument.findFirst({
    where: {
      id: documentId,
      contractId: contract.id,
    },
  })

  if (!document) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const urlParts = document.filepath.split(`/object/public/${STORAGE_BUCKET}/`)

    if (urlParts.length === 2) {
      await supabase.storage.from(STORAGE_BUCKET).remove([urlParts[1]])
    }
  } catch (error) {
    console.error('Contract document delete error:', error)
  }

  await prisma.contractDocument.delete({ where: { id: documentId } })

  await logActivity(`Removed ${document.documentType.toLowerCase()} document: ${document.filename}`, {
    userId: session.userId,
    contractId,
  })

  return Response.json({ success: true })
}
