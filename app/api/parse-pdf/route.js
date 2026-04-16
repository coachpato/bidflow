import { getSession } from '@/lib/session'
import { ensureOrganizationContext } from '@/lib/organization'
import { parseTenderDocumentSet, refreshTenderQualification } from '@/lib/tender-qualification'
import { refreshSubmissionPack } from '@/lib/submission-pack'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'

export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationContext = await ensureOrganizationContext(session.userId)
  const { tenderId } = await request.json()

  try {
    const parsedSet = await parseTenderDocumentSet(Number.parseInt(tenderId, 10))

    if (!parsedSet.parsed) {
      return Response.json({ error: 'No PDF found for this tender' }, { status: 404 })
    }

    const assessment = await refreshTenderQualification({
      tenderId: Number.parseInt(tenderId, 10),
      organizationId: organizationContext.organization.id,
      syncRequirements: false,
    })
    const submissionPack = await refreshSubmissionPack({
      tenderId: Number.parseInt(tenderId, 10),
      organizationId: organizationContext.organization.id,
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
        message: `Bidflow could not parse the latest PDF for pursuit #${tenderId}. Manual review is needed for this document set.`,
        type: 'warning',
        userId: session.userId,
        organizationId: organizationContext.organization.id,
        linkUrl: `/pursuits/${tenderId}`,
        linkLabel: 'Open pursuit',
      },
    }).catch(notificationError => {
      console.error('PDF parse notification error:', notificationError)
    })
    return Response.json({
      error: 'Could not parse PDF. The file may be scanned or password-protected.',
    }, { status: 422 })
  }
}
