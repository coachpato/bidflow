import { deliverDigestNotifications } from '@/lib/crawler/digest-notifications'
import { runCrawlerOrchestration } from '@/lib/crawler/orchestrator'
import {
  createCrawlRunLog,
  createRouteRunId,
  finishCrawlRunLog,
  installCrawlerProcessErrorHandlers,
  isCrawlerDryRun,
  pingCrawlerHeartbeat,
  sendCrawlerAdminAlert,
  sendCrawlerAdminSummary,
} from '@/lib/crawler/run-observability'
import { processTenderForOrganizations, upsertOpportunityForOrganization } from '@/lib/crawler/tender-processing'
import { logger } from '@/lib/logger'
import prisma from '@/lib/prisma'

const SOURCE_CONFIG = {
  key: 'etenders-gov-za',
  name: 'eTenders.gov.za',
  type: 'portal',
  baseUrl: 'https://www.etenders.gov.za',
}
const DEADLINE_MS = 240_000

export const maxDuration = 300
export { upsertOpportunityForOrganization }

installCrawlerProcessErrorHandlers({ logger })

export function isAuthorizedCron(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function processTenderWithCurrentDeadline(input) {
  const now = new Date()
  const validOpportunities = [input.tender].filter(opp =>
    !opp.deadline || new Date(opp.deadline) >= now
  )

  if (validOpportunities.length === 0) return

  return processTenderForOrganizations({
    ...input,
    tender: validOpportunities[0],
  })
}

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const routeRunId = createRouteRunId()
  const startedAt = new Date()
  const dryRun = isCrawlerDryRun()
  let result = null
  let caughtError = null

  await createCrawlRunLog({
    db: prisma,
    runId: routeRunId,
    startedAt,
    logger,
  })

  try {
    result = await runCrawlerOrchestration({
      sourceConfig: SOURCE_CONFIG,
      deadlineMs: DEADLINE_MS,
      processTender: processTenderWithCurrentDeadline,
      deliverDigests: deliverDigestNotifications,
    })
  } catch (error) {
    caughtError = error
    logger.crawler({
      level: 'error',
      phase: 'runtime',
      message: 'crawler_route_unhandled_error',
      error,
      data: { routeRunId },
    })
    result = {
      status: 500,
      body: {
        success: false,
        runId: null,
        error: error.message || 'Unhandled crawler route error',
        timestamp: new Date().toISOString(),
      },
    }
    await sendCrawlerAdminAlert({ runId: routeRunId, error, logger })
  }

  const finishedAt = new Date()

  await finishCrawlRunLog({
    db: prisma,
    runId: routeRunId,
    result,
    error: caughtError,
    finishedAt,
    logger,
  })

  const heartbeatResult = await pingCrawlerHeartbeat({
    runId: routeRunId,
    result,
    error: caughtError,
    startedAt,
    finishedAt,
    logger,
    db: prisma,
  })

  await sendCrawlerAdminSummary({
    runId: routeRunId,
    result,
    error: caughtError,
    startedAt,
    finishedAt,
    heartbeatResult,
    dryRun,
    logger,
    db: prisma,
  })

  return Response.json(result.body, { status: result.status })
}
