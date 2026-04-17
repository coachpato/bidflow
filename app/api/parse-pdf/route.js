import { getSession } from '@/lib/session'
import { dashboardCacheTag, expireCacheTags } from '@/lib/cache-tags'
import { getSessionOrganizationId } from '@/lib/organization'
import { parseTenderDocumentSet, refreshTenderQualification } from '@/lib/tender-qualification'
import { refreshSubmissionPack } from '@/lib/submission-pack'
import prisma from '@/lib/prisma'
import { findTenderForOrganization, parseRecordId } from '@/lib/tenders'

export const runtime = 'nodejs'

export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organization context is missing.' }, { status: 400 })
  const { tenderId } = await request.json()
  const parsedTenderId = parseRecordId(tenderId)
  if (!parsedTenderId) return Response.json({ error: 'Tender not found.' }, { status: 404 })

  const tender = await findTenderForOrganization({
    tenderId: parsedTenderId,
    organizationId,
    select: { id: true },
  })
  if (!tender) return Response.json({ error: 'Tender not found.' }, { status: 404 })

  try {
    const parsedSet = await parseTenderDocumentSet(parsedTenderId)

    if (!parsedSet.parsed) {
      return Response.json({ error: 'No PDF found for this tender' }, { status: 404 })
    }

    const assessment = await refreshTenderQualification({
      tenderId: parsedTenderId,
      organizationId,
      syncRequirements: false,
    })
    const submissionPack = await refreshSubmissionPack({
      tenderId: parsedTenderId,
      organizationId,
      regenerate: true,
    })

    return Response.json({
      fields: parsedSet.parsed.fields,
      requirements: parsedSet.parsed.requirements,
      appointments: parsedSet.parsed.appointments,
      rawTextPreview: parsedSet.parsed.rawPreview,
      qualification: assessment,
      submissionPack,
    })
  } catch (error) {
    console.error('PDF parse error:', error)
    await prisma.notification.create({
      data: {
        title: 'PDF parsing needs manual review',
        message: `Bidflow could not parse the latest PDF for pursuit #${parsedTenderId}. Manual review is needed for this document set.`,
        type: 'warning',
        userId: session.userId,
        organizationId,
        linkUrl: `/pursuits/${parsedTenderId}`,
        linkLabel: 'Open pursuit',
      },
    }).catch(notificationError => {
      console.error('PDF parse notification error:', notificationError)
    })
    await expireCacheTags(dashboardCacheTag(organizationId))
    return Response.json({
      error: 'Could not parse PDF. The file may be scanned or password-protected.',
    }, { status: 422 })
  }
}
