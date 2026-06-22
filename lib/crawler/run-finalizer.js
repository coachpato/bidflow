import { classifyError } from '@/lib/errors'
import { buildStructuredRunMetrics } from '@/lib/crawler/run-metrics'
import { releaseRun } from '@/lib/run-lifecycle'
import { RUN_STATUSES } from '@/lib/run-state'

export async function completePartialRun({
  db,
  diagnostics,
  sourceRun,
  results,
  cursor,
  tendersProcessedCount,
  lastProcessedTenderRef,
  skippedForResume,
  deadlineMs,
  exitReason = 'budget_exhausted',
  metrics = null,
  deliverDigests = null,
  notificationArgs = null,
  logger = console,
  startedAtMs = null,
  now = () => Date.now(),
}) {
  diagnostics.setExitReason(exitReason)
  const diagnosticsSnapshot = diagnostics.snapshot()
  const structuredMetrics = buildStructuredRunMetrics({
    diagnosticsSnapshot,
    runDiffMetrics: metrics,
    totalDurationMs: startedAtMs === null ? null : now() - startedAtMs,
  })
  const notificationResult = await attemptNotifications({
    deliverDigests,
    results,
    sourceRun,
    notificationArgs,
    logger,
  })

  await releaseRun({
    db,
    run: sourceRun,
    toStatus: RUN_STATUSES.PARTIAL_TIMEOUT,
    diagnostics: diagnosticsSnapshot,
    cursor,
    data: {
      totalFound: results.totalFound,
      matchedCount: results.matchedCount,
      newCount: results.newOpportunitiesCreated,
      errorCount: results.errors.length,
      tendersProcessedCount,
      lastProcessedTenderRef,
      completionMode: 'partial-deadline',
      errorMessage: null,
      notificationSentAt: notificationResult.sentAt,
      notificationError: notificationResult.errorMessage,
      metrics: structuredMetrics,
      summary: {
        organizationsEvaluated: results.organizationsEvaluated,
        digestsSent: results.digestsSent,
        emailsAttempted: results.emailsAttempted || 0,
        emailsSent: results.emailsSent || 0,
        emailsSkipped: results.emailsSkipped || 0,
        organizationsWithMatches: Object.keys(results.opportunitiesByOrganization).length,
        skippedForResume,
        deadlineMs,
        diagnostics: diagnosticsSnapshot,
      },
    },
  })

  return {
    status: 200,
    body: {
      success: true,
      partial: true,
      runId: sourceRun.id,
      timestamp: new Date().toISOString(),
      cursor,
      diagnostics: diagnosticsSnapshot,
      notificationSentAt: notificationResult.sentAt?.toISOString() || null,
      notificationError: notificationResult.errorMessage,
      ...results,
    },
  }
}

export async function completeSuccessfulRun({
  db,
  diagnostics,
  sourceRun,
  results,
  tendersProcessedCount,
  skippedForResume,
  metrics = null,
  deliverDigests = null,
  notificationArgs = null,
  logger = console,
  startedAtMs = null,
  now = () => Date.now(),
}) {
  diagnostics.setExitReason('completed')
  const diagnosticsSnapshot = diagnostics.snapshot()
  const structuredMetrics = buildStructuredRunMetrics({
    diagnosticsSnapshot,
    runDiffMetrics: metrics,
    totalDurationMs: startedAtMs === null ? null : now() - startedAtMs,
  })
  const finalRunStatus = results.errors.length > 0 || results.warnings?.length > 0
    ? RUN_STATUSES.COMPLETED_WITH_WARNINGS
    : RUN_STATUSES.COMPLETED
  const notificationResult = await attemptNotifications({
    deliverDigests,
    results,
    sourceRun,
    notificationArgs,
    logger,
  })

  await releaseRun({
    db,
    run: sourceRun,
    toStatus: finalRunStatus,
    diagnostics: diagnosticsSnapshot,
    cursor: null,
    data: {
      totalFound: results.totalFound,
      matchedCount: results.matchedCount,
      newCount: results.newOpportunitiesCreated,
      errorCount: results.errors.length,
      tendersProcessedCount,
      lastProcessedTenderRef: null,
      completionMode: 'completed',
      errorMessage: null,
      notificationSentAt: notificationResult.sentAt,
      notificationError: notificationResult.errorMessage,
      metrics: structuredMetrics,
      summary: {
        organizationsEvaluated: results.organizationsEvaluated,
        digestsSent: results.digestsSent,
        emailsAttempted: results.emailsAttempted || 0,
        emailsSent: results.emailsSent || 0,
        emailsSkipped: results.emailsSkipped || 0,
        organizationsWithMatches: Object.keys(results.opportunitiesByOrganization).length,
        skippedForResume,
        warnings: results.warnings || [],
        diagnostics: diagnosticsSnapshot,
      },
    },
  })

  return {
    status: 200,
    body: {
      success: true,
      runId: sourceRun.id,
      timestamp: new Date().toISOString(),
      diagnostics: diagnosticsSnapshot,
      notificationSentAt: notificationResult.sentAt?.toISOString() || null,
      notificationError: notificationResult.errorMessage,
      ...results,
    },
  }
}

function shouldDeliverNotifications({ deliverDigests, results }) {
  return Boolean(deliverDigests && results.newOpportunitiesCreated > 0)
}

function getNotificationSkipReason({ deliverDigests, results }) {
  if (!deliverDigests) return 'deliverDigests_not_configured'
  if (results.newOpportunitiesCreated <= 0) return 'no_new_opportunities'
  return null
}

async function attemptNotifications({ sourceRun, deliverDigests, notificationArgs, logger, results }) {
  if (!shouldDeliverNotifications({ deliverDigests, results })) {
    logger.crawler?.({
      level: results.newOpportunitiesCreated > 0 ? 'warn' : 'info',
      message: 'crawler_notification_delivery_skipped',
      phase: 'cleanup',
      runId: sourceRun.id,
      data: {
        skipReason: getNotificationSkipReason({ deliverDigests, results }),
        exactCondition: 'Boolean(deliverDigests && results.newOpportunitiesCreated > 0)',
        conditionValue: false,
        deliverDigestsConfigured: Boolean(deliverDigests),
        notificationArgsProvided: Boolean(notificationArgs),
        newOpportunitiesCreated: results.newOpportunitiesCreated,
        matchedCount: results.matchedCount,
        opportunityGroups: Object.keys(results.opportunitiesByOrganization || {}).length,
      },
    })
    return { sentAt: null, errorMessage: null }
  }

  try {
    await deliverDigests(notificationArgs)
    return { sentAt: new Date(), errorMessage: null }
  } catch (error) {
    const classifiedError = classifyError(error)
    logger.crawler?.({
      level: 'error',
      message: 'crawler_notification_delivery_failed',
      phase: 'cleanup',
      runId: sourceRun.id,
      error: classifiedError,
      data: { errorType: classifiedError.type },
    })
    return { sentAt: null, errorMessage: classifiedError.message }
  }
}

export async function failRun({
  db,
  diagnostics,
  sourceRun,
  error,
  cursor,
  tendersProcessedCount,
  lastProcessedTenderRef,
  logger,
  startedAtMs = null,
  now = () => Date.now(),
}) {
  const classifiedError = diagnostics.recordError(error)
  diagnostics.setExitReason('fatal_error')
  const diagnosticsSnapshot = diagnostics.snapshot()
  const structuredMetrics = buildStructuredRunMetrics({
    diagnosticsSnapshot,
    totalDurationMs: startedAtMs === null ? null : now() - startedAtMs,
  })

  logger.crawler({
    level: 'error',
    message: 'crawler_fatal_error',
    phase: 'cleanup',
    runId: sourceRun?.id || null,
    error: classifiedError,
    data: { errorType: classifiedError.type },
  })

  if (sourceRun) {
    try {
      await releaseRun({
        db,
        run: sourceRun,
        toStatus: RUN_STATUSES.FAILED,
        diagnostics: diagnosticsSnapshot,
        cursor,
        data: {
          errorCount: 1,
          tendersProcessedCount,
          lastProcessedTenderRef,
          completionMode: 'partial-error',
          errorMessage: classifiedError.message,
          metrics: structuredMetrics,
          summary: {
            error: classifiedError.message,
            errorType: classifiedError.type,
            diagnostics: diagnosticsSnapshot,
          },
        },
      })
    } catch (releaseError) {
      logger.crawler({
        level: 'error',
        message: 'crawler_failed_status_release_failed',
        phase: 'cleanup',
        runId: sourceRun.id,
        error: classifyError(releaseError),
        data: { originalErrorType: classifiedError.type },
      })
    }
  }

  return {
    status: 500,
    body: {
      success: false,
      runId: sourceRun?.id || null,
      error: classifiedError.message,
      errorType: classifiedError.type,
      diagnostics: diagnosticsSnapshot,
      timestamp: new Date().toISOString(),
    },
  }
}
