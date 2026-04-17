import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { expireCacheTags, tenderDetailCacheTag, tendersListCacheTag } from '@/lib/cache-tags'
import { ensureStorageBucket, getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { getSessionOrganizationId } from '@/lib/organization'
import { findTenderForOrganization } from '@/lib/tenders'
import { refreshSubmissionPack } from '@/lib/submission-pack'

export async function POST(request) {
  try {
    const session = await getSession()
    if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const organizationId = getSessionOrganizationId(session)
    if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })

    const formData = await request.formData()
    const file = formData.get('file')
    const tenderId = parseInt(formData.get('tenderId'), 10)

    if (!file || Number.isNaN(tenderId)) {
      return Response.json({ error: 'File and tenderId are required' }, { status: 400 })
    }

    if (typeof file.name !== 'string' || typeof file.arrayBuffer !== 'function') {
      return Response.json({ error: 'Invalid file upload payload.' }, { status: 400 })
    }

    const tender = await findTenderForOrganization({
      tenderId,
      organizationId,
      select: { id: true },
    })
    if (!tender) {
      return Response.json({ error: 'Tender not found' }, { status: 404 })
    }

    // Sanitize filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `tenders/${tenderId}/${Date.now()}_${safeName}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    await ensureStorageBucket()

    // Upload to Supabase Storage
    const supabase = getSupabaseAdmin()
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      console.error('Supabase upload error:', {
        message: uploadError.message,
        bucket: STORAGE_BUCKET,
        storagePath,
      })
      return Response.json({
        error: `File upload failed: ${uploadError.message}`,
      }, { status: 500 })
    }

    // Get the public URL for the file
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath)

    // Save record in database
    const doc = await prisma.tenderDocument.create({
      data: {
        filename: file.name,
        filepath: publicUrl,
        tenderId,
      },
    })

    void logActivity(`Uploaded document: ${file.name}`, {
      userId: session.userId,
      tenderId,
    })
    await refreshSubmissionPack({
      tenderId,
      organizationId,
    })
    await expireCacheTags(
      tendersListCacheTag(organizationId),
      tenderDetailCacheTag(organizationId, tenderId)
    )

    return Response.json(doc, { status: 201 })
  } catch (error) {
    console.error('Upload route error:', error)
    return Response.json({
      error: error.message || 'File upload failed. Please try again.',
    }, { status: 500 })
  }
}
