import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { ensureStorageBucket, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { ensureOrganizationContext } from '@/lib/organization'

const VALID_DOCUMENT_TYPES = new Set(['Appointment Letter', 'Work Order', 'SLA', 'Rate Card', 'Addendum', 'Other'])

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id } = await params

  const contract = await prisma.contract.findFirst({
    where: {
      id: parseInt(id, 10),
      organizationId: organizationContext.organization.id,
    },
    select: { id: true },
  })

  if (!contract) return Response.json({ error: 'Appointment not found.' }, { status: 404 })

  const documents = await prisma.contractDocument.findMany({
    where: { contractId: contract.id },
    orderBy: { uploadedAt: 'desc' },
  })

  return Response.json(documents)
}

export async function POST(request, { params }) {
  try {
    const session = await getSession()
    if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationContext = await ensureOrganizationContext(session.userId)

    const { id } = await params
    const contractId = parseInt(id, 10)

    if (Number.isNaN(contractId)) {
      return Response.json({ error: 'Invalid appointment id' }, { status: 400 })
    }

    const existingContract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, title: true, organizationId: true },
    })

    if (!existingContract || existingContract.organizationId !== organizationContext.organization.id) {
      return Response.json({ error: 'Appointment not found' }, { status: 404 })
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
