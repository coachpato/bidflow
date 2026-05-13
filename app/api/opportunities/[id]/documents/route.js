import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { addSignedDocumentUrlsToList, createSignedDocumentUrls, ensureStorageBucket, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { ensureOrganizationContext } from '@/lib/organization'
import { getUploadValidationError, sanitizeUploadFilename } from '@/lib/file-upload'

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id } = await params

  const documents = await prisma.opportunityDocument.findMany({
    where: {
      opportunityId: parseInt(id, 10),
      opportunity: {
        organizationId: organizationContext.organization.id,
      },
    },
    orderBy: { uploadedAt: 'desc' },
  })

  return Response.json(await addSignedDocumentUrlsToList(documents))
}

export async function POST(request, { params }) {
  try {
    const session = await getSession()
    if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationContext = await ensureOrganizationContext(session.userId)

    const { id } = await params
    const opportunityId = parseInt(id, 10)

    if (Number.isNaN(opportunityId)) {
      return Response.json({ error: 'Invalid opportunity id' }, { status: 400 })
    }

    const existingOpportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        organizationId: organizationContext.organization.id,
      },
      select: { id: true, title: true },
    })

    if (!existingOpportunity) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    const validationError = getUploadValidationError(file)
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 })
    }

    const safeName = sanitizeUploadFilename(file.name)
    const storagePath = `opportunities/${opportunityId}/${Date.now()}_${safeName}`
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

    const { viewUrl, downloadUrl } = await createSignedDocumentUrls(storagePath)

    const document = await prisma.opportunityDocument.create({
      data: {
        filename: file.name,
        filepath: viewUrl,
        storagePath,
        opportunityId,
      },
    })

    await logActivity(`Uploaded opportunity document: ${file.name}`, {
      userId: session.userId,
    })

    return Response.json({ ...document, downloadUrl }, { status: 201 })
  } catch (error) {
    console.error('Opportunity document upload error:', error)
    return Response.json({
      error: error.message || 'File upload failed. Please try again.',
    }, { status: 500 })
  }
}
