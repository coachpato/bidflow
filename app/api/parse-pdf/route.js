import { getSession } from '@/lib/session'
import prisma from '@/lib/prisma'
import { getSupabaseAdmin, STORAGE_BUCKET } from '@/lib/supabase'

export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { tenderId } = await request.json()

  // Get the most recently uploaded PDF for this tender
  const doc = await prisma.tenderDocument.findFirst({
    where: {
      tenderId: parseInt(tenderId),
      filename: { endsWith: '.pdf' },
    },
    orderBy: { uploadedAt: 'desc' },
  })

  if (!doc) {
    return Response.json({ error: 'No PDF found for this tender' }, { status: 404 })
  }

  try {
    // Download file from Supabase Storage
    const supabase = getSupabaseAdmin()
    const urlParts = doc.filepath.split(`/object/public/${STORAGE_BUCKET}/`)
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

    // Parse the PDF text
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
    const result = await pdfParse(buffer)
    const text = result.text

    const fields = extractTenderFields(text)

    return Response.json({ fields, rawTextPreview: text.substring(0, 500) })
  } catch (err) {
    console.error('PDF parse error:', err)
    return Response.json({
      error: 'Could not parse PDF. The file may be scanned or password-protected.',
    }, { status: 422 })
  }
}

/**
 * Attempts to extract structured fields from raw PDF text.
 * Covers common SA government tender document formats.
 */
function extractTenderFields(text) {
  const t = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ')

  function find(patterns) {
    for (const pattern of patterns) {
      const match = t.match(pattern)
      if (match && match[1]) return match[1].trim().substring(0, 200)
    }
    return null
  }

  return {
    reference: find([
      /tender\s*(?:number|no|ref(?:erence)?)[:\s]+([A-Z0-9\/\-]+)/i,
      /bid\s*(?:number|no)[:\s]+([A-Z0-9\/\-]+)/i,
      /rfq\s*(?:number|no)[:\s]+([A-Z0-9\/\-]+)/i,
    ]),
    title: find([
      /description\s*(?:of\s*services?)?[:\s]+(.{10,100}?)(?=\s{2,}|closing|deadline|contact)/i,
      /subject[:\s]+(.{10,100}?)(?=\s{2,}|closing|deadline)/i,
    ]),
    deadline: find([
      /closing\s*date(?:\s*and\s*time)?[:\s]+([0-9]{1,2}[\s\/\-][A-Za-z0-9]+[\s\/\-][0-9]{2,4}(?:\s+[0-9]{1,2}:[0-9]{2})?)/i,
      /submission\s*deadline[:\s]+([0-9]{1,2}[\s\/\-][A-Za-z0-9]+[\s\/\-][0-9]{2,4})/i,
    ]),
    briefingDate: find([
      /compulsory\s*(?:site\s*)?briefing(?:\s*session)?[:\s]+([0-9]{1,2}[\s\/\-][A-Za-z0-9]+[\s\/\-][0-9]{2,4}(?:\s+[0-9]{1,2}:[0-9]{2})?)/i,
      /briefing\s*(?:session\s*)?date[:\s]+([0-9]{1,2}[\s\/\-][A-Za-z0-9]+[\s\/\-][0-9]{2,4})/i,
    ]),
    contactPerson: find([
      /contact\s*person[:\s]+([A-Za-z\s]+?)(?=\s{2,}|tel|email|fax|enquiries)/i,
      /enquiries[:\s]+([A-Za-z\s]+?)(?=\s{2,}|tel|email)/i,
    ]),
    contactEmail: find([
      /e-?mail[:\s]+([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i,
    ]),
  }
}
