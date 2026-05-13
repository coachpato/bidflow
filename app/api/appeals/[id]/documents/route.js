import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { ensureOrganizationContext } from '@/lib/organization'
import { addSignedDocumentUrlsToList, createSignedDocumentUrls, ensureStorageBucket, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { getUploadValidationError, sanitizeUploadFilename } from '@/lib/file-upload'

const VALID_DOCUMENT_TYPES = new Set(['Evidence', 'Letter', 'Notice', 'Outcome', 'Other'])

export async function GET(_request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id } = await params
  const appealId = parseInt(id, 10)

  const appeal = await prisma.appeal.findFirst({
    where: {
      id: appealId,
      organizationId: organizationContext.organization.id,
    },
    select: { id: true },
  })

  if (!appeal) return Response.json({ error: 'Challenge not found.' }, { status: 404 })

  const documents = await prisma.appealDocument.findMany({
    where: { appealId },
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
    const appealId = parseInt(id, 10)

    const appeal = await prisma.appeal.findFirst({
      where: {
        id: appealId,
        organizationId: organizationContext.organization.id,
      },
      select: { id: true, reason: true },
    })

    if (!appeal) return Response.json({ error: 'Challenge not found.' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file')
    const rawDocumentType = formData.get('documentType')
    const documentType = VALID_DOCUMENT_TYPES.has(rawDocumentType) ? rawDocumentType : 'Evidence'

    const validationError = getUploadValidationError(file)
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 })
    }

    const safeName = sanitizeUploadFilename(file.name)
    const storagePath = `appeals/${appealId}/${Date.now()}_${safeName}`
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

    const document = await prisma.appealDocument.create({
      data: {
        appealId,
        filename: file.name,
        filepath: viewUrl,
        storagePath,
        documentType,
      },
    })

    await logActivity(`Uploaded challenge ${documentType.toLowerCase()} document: ${file.name}`, {
      userId: session.userId,
      appealId,
    })

    return Response.json({ ...document, downloadUrl }, { status: 201 })
  } catch (error) {
    console.error('Appeal document upload error:', error)
    return Response.json({ error: error.message || 'File upload failed.' }, { status: 500 })
  }
}
