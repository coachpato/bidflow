import { deliverDigestNotifications } from '@/lib/crawler/digest-notifications'
import { runCrawlerOrchestration } from '@/lib/crawler/orchestrator'
import { processTenderForOrganizations, upsertOpportunityForOrganization } from '@/lib/crawler/tender-processing'

const SOURCE_CONFIG = {
  key: 'etenders-gov-za',
  name: 'eTenders.gov.za',
  type: 'portal',
  baseUrl: 'https://www.etenders.gov.za',
}
const DEADLINE_MS = 240_000

export const maxDuration = 300
export { upsertOpportunityForOrganization }

export function isAuthorizedCron(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runCrawlerOrchestration({
    sourceConfig: SOURCE_CONFIG,
    deadlineMs: DEADLINE_MS,
    processTender: processTenderForOrganizations,
    deliverDigests: deliverDigestNotifications,
  })

  return Response.json(result.body, { status: result.status })
}
