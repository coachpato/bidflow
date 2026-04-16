import prisma from '@/lib/prisma'
import { logActivity } from '@/lib/activity'
import { ensureOrganizationContext } from '@/lib/organization'
import { getSession } from '@/lib/session'
import { refreshSubmissionPack } from '@/lib/submission-pack'

async function buildResponse(tenderId) {
  const submissionPack = await prisma.submissionPack.findUnique({
    where: { tenderId },
  })
  const generatedDocuments = await prisma.generatedDocument.findMany({
    where: { tenderId },
    orderBy: [{ documentType: 'asc' }, { updatedAt: 'desc' }],
  })

  return {
    submissionPack,
    generatedDocuments,
  }
}

export async function GET(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationContext = await ensureOrganizationContext(session.userId)
  const { id } = await params
  const tenderId = Number.parseInt(id, 10)

  await refreshSubmissionPack({
    tenderId,
    organizationId: organizationContext.organization.id,
  })

  return Response.json(await buildResponse(tenderId))
}

export async function POST(request, { params }) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const organizationContext = await ensureOrganizationContext(session.userId)
  const { id } = await params
  const tenderId = Number.parseInt(id, 10)
  const body = await request.json().catch(() => ({}))

  await refreshSubmissionPack({
    tenderId,
    organizationId: organizationContext.organization.id,
    regenerate: Boolean(body?.regenerate),
  })

  if (body?.regenerate) {
    await logActivity('Regenerated submission pack drafts', {
      userId: session.userId,
      tenderId,
    })
  }

  return Response.json(await buildResponse(tenderId))
}
