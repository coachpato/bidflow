import { getSession } from '@/lib/session'
import { sendWeeklyOpportunityDigest } from '@/lib/weekly-digest'

function isAuthorizedCron(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    const session = await getSession()
    if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })
  }

  const result = await sendWeeklyOpportunityDigest()

  return Response.json({
    success: true,
    ...result,
  })
}
