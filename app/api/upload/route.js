import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file')
  const tenderId = formData.get('tenderId')

  if (!file || !tenderId) {
    return Response.json({ error: 'File and tenderId are required' }, { status: 400 })
  }

  // Sanitize filename
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `tenders/${tenderId}/${Date.now()}_${safeName}`

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Upload to Supabase Storage
  const supabase = getSupabaseAdmin()
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) {
    console.error('Supabase upload error:', uploadError)
    return Response.json({ error: 'File upload failed. Please try again.' }, { status: 500 })
  }

  // Get the public URL for the file
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath)

  // Save record in database
  const doc = await prisma.tenderDocument.create({
    data: {
      filename: file.name,
      filepath: publicUrl, // Store the full public URL
      tenderId: parseInt(tenderId),
    },
  })

  await logActivity(`Uploaded document: ${file.name}`, {
    userId: session.userId,
    tenderId: parseInt(tenderId),
  })

  return Response.json(doc, { status: 201 })
}
