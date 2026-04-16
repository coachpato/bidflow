import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { unlink } from 'fs/promises'
import path from 'path'

// GET /api/tenders/:id/documents
export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const docs = await prisma.tenderDocument.findMany({
    where: { tenderId: parseInt(id) },
    orderBy: { uploadedAt: 'desc' },
  })

  return Response.json(docs)
}

// DELETE /api/tenders/:id/documents/:docId  handled via query param
export async function DELETE(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const docId = searchParams.get('docId')

  if (!docId) return Response.json({ error: 'docId required' }, { status: 400 })

  const doc = await prisma.tenderDocument.findUnique({ where: { id: parseInt(docId) } })
  if (!doc) return Response.json({ error: 'Not found' }, { status: 404 })

  // Delete the physical file
  try {
    await unlink(path.join(process.cwd(), 'public', doc.filepath))
  } catch {
    // File might already be gone — continue anyway
  }

  await prisma.tenderDocument.delete({ where: { id: parseInt(docId) } })

  return Response.json({ success: true })
}
