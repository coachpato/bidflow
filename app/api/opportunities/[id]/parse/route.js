import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'
import { PDFParse } from 'pdf-parse'
import { parseProcurementDocument } from '@/lib/procurement-parser'
import { ensureOrganizationContext } from '@/lib/organization'

export const runtime = 'nodejs'

export async function POST(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationContext = await ensureOrganizationContext(session.userId)

  const { id } = await params
  const opportunityId = parseInt(id, 10)

  const document = await prisma.opportunityDocument.findFirst({
    where: {
      opportunityId,
      opportunity: {
        organizationId: organizationContext.organization.id,
      },
      filename: { endsWith: '.pdf' },
    },
    orderBy: { uploadedAt: 'desc' },
  })

  if (!document) {
    return Response.json({ error: 'No PDF found for this opportunity.' }, { status: 404 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const urlParts = document.filepath.split(`/object/public/${STORAGE_BUCKET}/`)

    if (urlParts.length < 2) {
      return Response.json({ error: 'Invalid file path' }, { status: 422 })
    }

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(urlParts[1])

    if (error || !data) {
      return Response.json({ error: 'Could not download file from storage' }, { status: 422 })
    }

    const buffer = Buffer.from(await data.arrayBuffer())
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    await parser.destroy()

    const parsed = parseProcurementDocument(result.text)

    return Response.json(parsed)
  } catch (error) {
    console.error('Opportunity parse error:', error)
    return Response.json({
      error: 'Could not parse PDF. The file may be scanned or password-protected.',
    }, { status: 422 })
  }
}
