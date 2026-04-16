import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { ensureStorageBucket, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { ensureOrganizationContext } from '@/lib/organization'

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

  return Response.json(documents)
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

    if (!file) {
      return Response.json({ error: 'File is required' }, { status: 400 })
    }

    if (typeof file.name !== 'string' || typeof file.arrayBuffer !== 'function') {
      return Response.json({ error: 'Invalid file upload payload.' }, { status: 400 })
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
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

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)

    const document = await prisma.opportunityDocument.create({
      data: {
        filename: file.name,
        filepath: publicUrl,
        opportunityId,
      },
    })

    await logActivity(`Uploaded opportunity document: ${file.name}`, {
      userId: session.userId,
    })

    return Response.json(document, { status: 201 })
  } catch (error) {
    console.error('Opportunity document upload error:', error)
    return Response.json({
      error: error.message || 'File upload failed. Please try again.',
    }, { status: 500 })
  }
}
