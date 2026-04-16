import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { ensureStorageBucket, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

const VALID_DOCUMENT_TYPES = new Set(['Signed Contract', 'SLA', 'Rate Card', 'Addendum', 'Other'])

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const documents = await prisma.contractDocument.findMany({
    where: { contractId: parseInt(id, 10) },
    orderBy: { uploadedAt: 'desc' },
  })

  return Response.json(documents)
}

export async function POST(request, { params }) {
  try {
    const session = await getSession()
    if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const contractId = parseInt(id, 10)

    if (Number.isNaN(contractId)) {
      return Response.json({ error: 'Invalid contract id' }, { status: 400 })
    }

    const existingContract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, title: true },
    })

    if (!existingContract) {
      return Response.json({ error: 'Contract not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const rawDocumentType = formData.get('documentType')
    const documentType = VALID_DOCUMENT_TYPES.has(rawDocumentType) ? rawDocumentType : 'Other'

    if (!file) {
      return Response.json({ error: 'File is required' }, { status: 400 })
    }

    if (typeof file.name !== 'string' || typeof file.arrayBuffer !== 'function') {
      return Response.json({ error: 'Invalid file upload payload.' }, { status: 400 })
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `contracts/${contractId}/${Date.now()}_${safeName}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    await ensureStorageBucket()

    const supabase = getSupabaseAdmin()
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      return Response.json({ error: `File upload failed: ${uploadError.message}` }, { status: 500 })
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)

    const document = await prisma.contractDocument.create({
      data: {
        filename: file.name,
        filepath: publicUrl,
        documentType,
        contractId,
      },
    })

    await logActivity(`Uploaded ${documentType.toLowerCase()} document: ${file.name}`, {
      userId: session.userId,
      contractId,
    })

    return Response.json(document, { status: 201 })
  } catch (error) {
    console.error('Contract document upload error:', error)
    return Response.json({
      error: error.message || 'File upload failed. Please try again.',
    }, { status: 500 })
  }
}
