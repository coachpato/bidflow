import { randomUUID } from 'node:crypto'
import { sendEmail } from '@/lib/email'
import { logger as defaultLogger } from '@/lib/logger'
import prisma from '@/lib/prisma'
import { getSectorLabel } from '@/lib/sectors'

const SUCCESS_STATUSES = new Set(['success', 'completed', 'partial_timeout'])
let processHandlersInstalled = false

function splitRecipients(value) {
  return (value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

export function getCrawlerAdminRecipients(env = process.env) {
  return Array.from(new Set([
    ...splitRecipients(env.CRAWLER_ADMIN_EMAILS),
    ...splitRecipients(env.ADMIN_EMAIL),
    ...splitRecipients(env.CRAWLER_EMAIL_RECIPIENTS),
  ]))
}

export function isCrawlerDryRun(env = process.env) {
  return env.DRY_RUN === 'true' || env.CRAWLER_DRY_RUN === 'true'
}

export function createRouteRunId() {
  return randomUUID()
}

function getResultBody(result) {
  return result?.body || {}
}

function getRunStatus({ result, error }) {
  if (error) return 'failure'
  if (!result) return 'failure'
  return result.status >= 500 || result.body?.success === false ? 'failure' : 'success'
}

function getErrorMessage({ result, error }) {
  if (error?.stack) return error.stack
  if (error?.message) return error.message
  return result?.body?.error || null
}

function getEmailsSent(result) {
  const body = getResultBody(result)
  return Number(body.emailsSent ?? body.digestsSent ?? 0) || 0
}

function getSubscribersNotified(result) {
  const body = getResultBody(result)
  const emailsSent = Number(body.emailsSent ?? 0) || 0
  if (emailsSent > 0) return emailsSent

  const delivered = Array.isArray(body.subscriberDigestsDelivered)
    ? body.subscriberDigestsDelivered
    : []
  const subscriberKeys = delivered
    .map(item => item.subscriberId || item.email)
    .filter(Boolean)

  return new Set(subscriberKeys).size
}

function getOpportunitiesFound(result) {
  const body = getResultBody(result)
  return Number(body.totalFound ?? body.newOpportunitiesCreated ?? 0) || 0
}

function getWarningsCount(result) {
  return getResultBody(result).warnings?.length || 0
}

function getErrorsCount({ result, error }) {
  const errorMessage = getErrorMessage({ result, error })
  return getResultBody(result).errors?.length || (errorMessage ? 1 : 0)
}

function getMatchedSectorValues(result) {
  const body = getResultBody(result)
  const stats = body.subscriberMatchStats || {}
  const matchedSectors = Array.isArray(stats.matchedSectors)
    ? stats.matchedSectors
    : []
  const deliveredSectors = Array.isArray(body.subscriberDigestsDelivered)
    ? body.subscriberDigestsDelivered.map(item => item.sector)
    : []

  return Array.from(new Set([
    ...matchedSectors,
    ...deliveredSectors,
  ].filter(Boolean)))
}

async function getSubscriberMonitoringMetrics({
  db = prisma,
  result,
  finishedAt,
  logger = defaultLogger,
  runId = null,
} = {}) {
  const matchedSectorValues = getMatchedSectorValues(result)
  const fallbackMetrics = {
    sectorsMatched: matchedSectorValues.length,
    subscribersNotified: getSubscribersNotified(result),
    totalSubscribers: null,
    subscriberSectors: [],
    newSubscribers24h: null,
  }

  if (!db?.subscriber?.findMany || !db?.subscriber?.count) {
    return fallbackMetrics
  }

  try {
    const since = new Date(finishedAt.getTime() - 24 * 60 * 60 * 1000)
    const [activeSubscribers, newSubscribers24h] = await Promise.all([
      db.subscriber.findMany({
        where: { subscribed: true },
        select: { email: true, sector: true },
        orderBy: { sector: 'asc' },
      }),
      db.subscriber.count({
        where: {
          createdAt: {
            gte: since,
          },
        },
      }),
    ])

    const activeEmails = new Set(activeSubscribers.map(subscriber => subscriber.email).filter(Boolean))
    const activeSectorValues = Array.from(new Set(
      activeSubscribers.map(subscriber => subscriber.sector).filter(Boolean)
    ))

    return {
      ...fallbackMetrics,
      totalSubscribers: activeEmails.size,
      subscriberSectors: activeSectorValues.map(getSectorLabel),
      newSubscribers24h,
    }
  } catch (metricsError) {
    logger.crawler?.({
      level: 'error',
      phase: 'cleanup',
      message: 'crawler_subscriber_monitoring_metrics_failed',
      error: metricsError,
      data: { runId },
    })

    return fallbackMetrics
  }
}

export async function createCrawlRunLog({
  db,
  runId,
  startedAt,
  logger = defaultLogger,
}) {
  if (!db?.crawlRun?.create) return { skipped: true, reason: 'crawlRun model unavailable' }

  try {
    await db.crawlRun.create({
      data: {
        runId,
        startedAt,
        status: 'running',
      },
    })
    return { skipped: false }
  } catch (error) {
    logger.crawler?.({
      level: 'error',
      phase: 'startup',
      message: 'crawler_run_log_create_failed',
      error,
      data: { runId },
    })
    return { skipped: true, error }
  }
}

export async function finishCrawlRunLog({
  db,
  runId,
  result,
  error = null,
  finishedAt,
  logger = defaultLogger,
}) {
  if (!db?.crawlRun?.update) return { skipped: true, reason: 'crawlRun model unavailable' }

  const body = getResultBody(result)
  const sourceRunId = Number(body.runId)

  try {
    await db.crawlRun.update({
      where: { runId },
      data: {
        sourceRunId: Number.isInteger(sourceRunId) ? sourceRunId : null,
        finishedAt,
        status: getRunStatus({ result, error }),
        opportunitiesFound: getOpportunitiesFound(result),
        emailsSent: getEmailsSent(result),
        errorMessage: getErrorMessage({ result, error }),
      },
    })
    return { skipped: false }
  } catch (logError) {
    logger.crawler?.({
      level: 'error',
      phase: 'cleanup',
      message: 'crawler_run_log_finish_failed',
      error: logError,
      data: { runId },
    })
    return { skipped: true, error: logError }
  }
}

function getHeartbeatUrl(status, env = process.env) {
  const baseUrl = env.CRAWLER_HEARTBEAT_URL || env.HEALTHCHECKS_URL
  if (!baseUrl) return null

  if (!SUCCESS_STATUSES.has(status)) {
    if (env.CRAWLER_HEARTBEAT_FAILURE_URL) return env.CRAWLER_HEARTBEAT_FAILURE_URL
    if (baseUrl.includes('hc-ping.com') && !baseUrl.endsWith('/fail')) {
      return `${baseUrl.replace(/\/$/, '')}/fail`
    }
  }

  return baseUrl
}

export async function pingCrawlerHeartbeat({
  runId,
  result,
  error = null,
  startedAt,
  finishedAt,
  fetchFn = fetch,
  logger = defaultLogger,
  env = process.env,
  db = prisma,
}) {
  const status = getRunStatus({ result, error })
  const heartbeatUrl = getHeartbeatUrl(status, env)

  if (!heartbeatUrl) return { skipped: true, reason: 'CRAWLER_HEARTBEAT_URL not configured' }

  try {
    const subscriberMetrics = await getSubscriberMonitoringMetrics({
      db,
      result,
      finishedAt,
      logger,
      runId,
    })
    const body = buildCrawlerAlertText({
      runId,
      result,
      error,
      startedAt,
      finishedAt,
      heartbeatResult: null,
      subscriberMetrics,
    })

    const response = await fetchFn(heartbeatUrl, {
      method: 'POST',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body,
    })

    if (!response.ok) {
      throw new Error(`Heartbeat failed with HTTP ${response.status}`)
    }

    return { skipped: false, statusCode: response.status, url: heartbeatUrl }
  } catch (heartbeatError) {
    logger.crawler?.({
      level: 'error',
      phase: 'cleanup',
      message: 'crawler_heartbeat_ping_failed',
      error: heartbeatError,
      data: { runId, heartbeatUrl },
    })
    return { skipped: true, error: heartbeatError }
  }
}

function formatMonitoringCount(value) {
  return Number.isFinite(value) ? String(value) : 'unknown'
}

function getFailureExitReason(result) {
  return getResultBody(result).diagnostics?.exitReason || 'unknown'
}

function getPageErrorCount(result) {
  const pageErrors = getResultBody(result).diagnostics?.pageErrors
  return Array.isArray(pageErrors) ? pageErrors.length : 0
}

function buildCrawlerAlertText({
  runId,
  result,
  error,
  startedAt,
  finishedAt,
  heartbeatResult,
  subscriberMetrics,
}) {
  const body = getResultBody(result)
  const status = getRunStatus({ result, error })
  const durationMs = finishedAt.getTime() - startedAt.getTime()
  const errorMessage = getErrorMessage({ result, error })
  const heartbeatLine = heartbeatResult?.skipped
    ? `Heartbeat: skipped (${heartbeatResult.reason || heartbeatResult.error?.message || 'unknown reason'})`
    : heartbeatResult
      ? `Heartbeat: sent (${heartbeatResult.statusCode || 'ok'})`
      : null

  if (status === 'failure') {
    return [
      'Bid360 crawler FAILED',
      '',
      `Run ID: ${runId}`,
      body.runId ? `Source run ID: ${body.runId}` : null,
      `Started: ${startedAt.toISOString()}`,
      `Failed at: ${finishedAt.toISOString()}`,
      `Error: ${errorMessage || 'Unknown crawler failure'}`,
      `Exit reason: ${getFailureExitReason(result)}`,
      `Page errors: ${getPageErrorCount(result)}`,
    ].filter(Boolean).join('\n')
  }

  const lines = [
    `Bid360 crawler ${status}`,
    '',
    `Run ID: ${runId}`,
    body.runId ? `Source run ID: ${body.runId}` : null,
    `Started: ${startedAt.toISOString()}`,
    `Finished: ${finishedAt.toISOString()}`,
    `Duration: ${durationMs}ms`,
    heartbeatLine,
    '',
    `Opportunities crawled/found: ${getOpportunitiesFound(result)}`,
    `New opportunities: ${body.newOpportunitiesCreated ?? body.newCount ?? 0}`,
    `Sectors matched: ${subscriberMetrics.sectorsMatched}`,
    `Subscribers notified: ${subscriberMetrics.subscribersNotified}`,
    `Total subscribers: ${formatMonitoringCount(subscriberMetrics.totalSubscribers)}`,
    `Subscriber sectors: ${subscriberMetrics.subscriberSectors.length > 0 ? subscriberMetrics.subscriberSectors.join(', ') : 'none'}`,
    `New subscribers (24h): ${formatMonitoringCount(subscriberMetrics.newSubscribers24h)}`,
    `Warnings: ${getWarningsCount(result)}`,
    `Errors: ${getErrorsCount({ result, error })}`,
    errorMessage ? `Error: ${errorMessage}` : null,
  ].filter(Boolean)

  return lines.join('\n')
}

function buildAdminSummary({ runId, result, error, startedAt, finishedAt, heartbeatResult, subscriberMetrics }) {
  const body = getResultBody(result)
  const status = getRunStatus({ result, error })
  const text = buildCrawlerAlertText({
    runId,
    result,
    error,
    startedAt,
    finishedAt,
    heartbeatResult,
    subscriberMetrics,
  })

  return {
    status,
    subject: status === 'failure'
      ? `Bid360 crawler FAILED: ${body.runId || runId}`
      : `Bid360 crawler ${status}: ${body.newOpportunitiesCreated ?? 0} new, ${subscriberMetrics.subscribersNotified} subscriber(s) notified`,
    text,
    html: `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap;">${escapeHtml(text)}</pre>`,
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendCrawlerAdminSummary({
  runId,
  result,
  error = null,
  startedAt,
  finishedAt,
  heartbeatResult = null,
  logger = defaultLogger,
  env = process.env,
  db = prisma,
}) {
  const recipients = getCrawlerAdminRecipients(env)
  if (recipients.length === 0) return { skipped: true, reason: 'No crawler admin recipients configured.' }

  const subscriberMetrics = await getSubscriberMonitoringMetrics({
    db,
    result,
    finishedAt,
    logger,
    runId,
  })
  const summary = buildAdminSummary({
    runId,
    result,
    error,
    startedAt,
    finishedAt,
    heartbeatResult,
    subscriberMetrics,
  })

  try {
    await sendEmail({
      to: recipients,
      subject: summary.subject,
      html: summary.html,
      text: summary.text,
      bypassDryRun: true,
    })
    return { skipped: false, status: summary.status }
  } catch (emailError) {
    logger.crawler?.({
      level: 'error',
      phase: 'cleanup',
      message: 'crawler_admin_summary_failed',
      error: emailError,
      data: { runId },
    })
    return { skipped: true, error: emailError }
  }
}

export async function sendCrawlerAdminAlert({
  runId = null,
  error,
  logger = defaultLogger,
  env = process.env,
}) {
  const recipients = getCrawlerAdminRecipients(env)
  if (recipients.length === 0) return { skipped: true, reason: 'No crawler admin recipients configured.' }

  const stack = error?.stack || error?.message || String(error)

  try {
    await sendEmail({
      to: recipients,
      subject: `Bid360 crawler crash${runId ? `: ${runId}` : ''}`,
      html: `<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap;">${escapeHtml(stack)}</pre>`,
      text: stack,
      bypassDryRun: true,
    })
    return { skipped: false }
  } catch (emailError) {
    logger.crawler?.({
      level: 'error',
      phase: 'cleanup',
      message: 'crawler_admin_alert_failed',
      error: emailError,
      data: { runId },
    })
    return { skipped: true, error: emailError }
  }
}

export function installCrawlerProcessErrorHandlers({ logger = defaultLogger } = {}) {
  if (processHandlersInstalled || typeof process === 'undefined' || !process.on) return
  processHandlersInstalled = true

  process.on('unhandledRejection', reason => {
    const error = reason instanceof Error ? reason : new Error(String(reason))
    logger.crawler?.({
      level: 'error',
      phase: 'runtime',
      message: 'crawler_unhandled_rejection',
      error,
    })
    sendCrawlerAdminAlert({ error, logger }).finally(() => {
      process.exitCode = 1
    })
  })

  process.on('uncaughtException', error => {
    logger.crawler?.({
      level: 'error',
      phase: 'runtime',
      message: 'crawler_uncaught_exception',
      error,
    })
    sendCrawlerAdminAlert({ error, logger }).finally(() => {
      process.exitCode = 1
    })
  })
}
