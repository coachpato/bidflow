import { fetchETendersPage, fetchETendersStructureHtml } from '@/lib/crawler/etenders-crawler'
import { completePartialRun, completeSuccessfulRun, failRun } from '@/lib/crawler/run-finalizer'
import { shouldDeadLetterTender, writeDeadLetter } from '@/lib/crawler/dead-letters'
import { buildRunDiffMetrics, createTenderSnapshot } from '@/lib/crawler/run-diff'
import { validateAndStoreSourceFingerprint } from '@/lib/crawler/source-fingerprint'
import { TimeBudget } from '@/lib/crawler/time-budget'
import { DiagnosticsCollector } from '@/lib/diagnostics'
import { logger as defaultLogger } from '@/lib/logger'
import { createCursorFromPage, getTenderResumeRef } from '@/lib/page-iterator'
import prisma from '@/lib/prisma'
import { validateTenderQuality } from '@/lib/crawler/tender-quality'
import {
  buildInitialResults,
  ensureSourceRecord,
  getInitialPage,
  initializeCrawlerRun,
  loadOrganizationsForRadar,
} from '@/lib/crawler/orchestrator-setup'
import {
  saveRunCursor,
  startHeartbeat,
} from '@/lib/run-lifecycle'

/**
 * Coordinates the serverless crawl lifecycle while delegating domain-specific tender handling.
 */
export async function runCrawlerOrchestration({
  sourceConfig,
  deadlineMs,
  processTender,
  deliverDigests,
  db = prisma,
  logger = defaultLogger,
  now = () => Date.now(),
} = {}) {
  const startedAtMs = now()
  const budget = new TimeBudget({ deadlineMs, now, startedAtMs })
  const diagnostics = new DiagnosticsCollector({ now })
  const source = await ensureSourceRecord({ db, sourceConfig })
  let sourceRun = null
  let stopHeartbeat = null
  let cursor = null
  let lastProcessedTenderRef = null
  let tendersProcessedCount = 0

  try {
    const runInitialization = await initializeCrawlerRun({ db, source, logger })
    sourceRun = runInitialization.sourceRun
    cursor = runInitialization.resumeCursor
    lastProcessedTenderRef = cursor?.lastProcessedRef || sourceRun.lastProcessedTenderRef || null
    stopHeartbeat = startHeartbeat({ db, runId: sourceRun.id, logger })

    const organizations = await loadOrganizationsForRadar({ db })
    const results = buildInitialResults(source, organizations)
    let nextPage = getInitialPage(cursor)
    const skippedForResume = nextPage > 1 ? (nextPage - 1) * (cursor?.pageSize || 0) : 0
    let deadlineReached = false
    let pagesFoundRecorded = false
    let fingerprintValidated = false
    const tenderSnapshots = new Map()
    const failedTenderAttempts = new Map()
    const deadLetteredThisRun = new Set()

    logger.crawler({
      level: 'info',
      phase: 'discovery',
      runId: sourceRun.id,
      message: 'crawler_run_started',
      data: {
        sourceId: source.id,
        reusedRun: runInitialization.reusedRun,
        resumePage: nextPage,
        resumeRef: cursor?.lastProcessedRef || null,
        cursorValidation: runInitialization.cursorValidation?.reason || null,
      },
    })

    diagnostics.startPhase('discovery')
    if (!budget.hasPhaseBudget('discovery')) {
      deadlineReached = true
    }

    while (nextPage) {
      if (deadlineReached) {
        diagnostics.recordPage({ outcome: 'skipped', page: nextPage })
        break
      }

      if (!budget.hasBuffer(30_000)) {
        diagnostics.recordPage({ outcome: 'skipped', page: nextPage })
        deadlineReached = true
        break
      }

      let pageBatch

      try {
        pageBatch = await fetchETendersPage(nextPage, cursor?.pageSize, { diagnostics })
        if (!pagesFoundRecorded) {
          results.totalFound = pageBatch.totalRecords
          pagesFoundRecorded = true
        }
        diagnostics.recordPage({ outcome: 'found', page: pageBatch.pageNumber })
      } catch (error) {
        diagnostics.recordPage({ outcome: 'failed', page: nextPage, error })
        const classifiedError = diagnostics.recordError(error)
        logger.crawler({
          level: 'error',
          message: 'crawler_page_fetch_failed',
          phase: 'discovery',
          runId: sourceRun.id,
          error: classifiedError,
          data: { page: nextPage, errorType: classifiedError.type },
        })
        throw error
      }

      for (const tender of pageBatch.tenders) {
        const snapshot = createTenderSnapshot(tender)
        if (snapshot) tenderSnapshots.set(snapshot.reference, snapshot)
      }

      if (!fingerprintValidated) {
        const structureResult = await validateAndStoreSourceFingerprint({
          db,
          sourceId: source.id,
          pageBatch,
          fetchHtml: fetchETendersStructureHtml,
          diagnostics,
          logger,
        })

        if (structureResult.severity === 'warning') {
          results.warnings.push({
            message: 'Source structure changed; crawl completed with warnings.',
            reasons: structureResult.reasons,
          })
        }

        fingerprintValidated = true
      }

      diagnostics.endPhase('discovery')
      if (!budget.hasPhaseBudget('processing')) {
        diagnostics.recordPage({ outcome: 'skipped', page: pageBatch.pageNumber })
        deadlineReached = true
        break
      }

      diagnostics.startPhase('processing')

      for (const tender of pageBatch.tenders) {
        if (!budget.hasBuffer(15_000)) {
          deadlineReached = true
          break
        }

        const tenderRef = getTenderResumeRef(tender)
        if (deadLetteredThisRun.has(tenderRef)) {
          diagnostics.recordTender('skipped')
          continue
        }

        const quality = validateTenderQuality(tender)
        if (quality.warnings.length > 0) {
          const warning = {
            tenderRef,
            tenderTitle: tender.title,
            warnings: quality.warnings,
          }
          diagnostics.recordTenderWarning(warning)
          results.warnings.push({
            message: 'Tender quality warning',
            reasons: quality.warnings,
            tenderRef: warning.tenderRef,
          })
          logger.crawler({
            level: 'warn',
            phase: 'processing',
            runId: sourceRun.id,
            message: 'crawler_tender_quality_warning',
            data: warning,
          })
        }

        if (!quality.valid) {
          const invalidTender = {
            tenderRef,
            tenderTitle: tender.title,
            errors: quality.errors,
          }
          diagnostics.recordTender('invalid')
          results.warnings.push({
            message: 'Tender skipped by quality validation',
            reasons: quality.errors,
            tenderRef: invalidTender.tenderRef,
          })
          logger.crawler({
            level: 'warn',
            phase: 'processing',
            runId: sourceRun.id,
            message: 'crawler_tender_quality_invalid',
            data: invalidTender,
          })
          tendersProcessedCount += 1
          lastProcessedTenderRef = tenderRef
          continue
        }

        try {
          const matchedBefore = results.matchedCount
          await processTender({ tender, organizations, source, sourceRun, results })
          if (results.matchedCount === matchedBefore) {
            diagnostics.recordTender('no_match')
          }
        } catch (error) {
          const classifiedError = diagnostics.recordError(error)
          const failureAttemptCount = (failedTenderAttempts.get(tenderRef) || 0) + 1
          failedTenderAttempts.set(tenderRef, failureAttemptCount)
          logger.crawler({
            level: 'error',
            message: 'crawler_tender_processing_failed',
            phase: 'processing',
            runId: sourceRun.id,
            error: classifiedError,
            data: {
              tenderTitle: tender.title,
              tenderRef,
              errorType: classifiedError.type,
            },
          })
          if (shouldDeadLetterTender(classifiedError, failureAttemptCount)) {
            await writeDeadLetter({
              db,
              tender,
              sourceRun,
              error: classifiedError,
              failureCount: failureAttemptCount,
            })
            deadLetteredThisRun.add(tenderRef)
            diagnostics.recordTender('dead_lettered')
            results.warnings.push({
              message: 'Tender sent to dead letter queue',
              reasons: [classifiedError.type],
              tenderRef,
            })
            tendersProcessedCount += 1
            lastProcessedTenderRef = tenderRef
            continue
          }
          results.errors.push({
            tender: tender.title,
            error: classifiedError.message,
            type: classifiedError.type,
          })
        }

        tendersProcessedCount += 1
        diagnostics.recordTender('processed')
        lastProcessedTenderRef = tenderRef
      }
      diagnostics.endPhase('processing')

      if (deadlineReached) {
        diagnostics.recordPage({ outcome: 'skipped', page: pageBatch.pageNumber })
        if (cursor) {
          await saveRunCursor({ db, runId: sourceRun.id, cursor, tendersProcessedCount, lastProcessedTenderRef })
        }
        break
      }

      cursor = createCursorFromPage(pageBatch)
      lastProcessedTenderRef = cursor.lastProcessedRef
      await saveRunCursor({ db, runId: sourceRun.id, cursor, tendersProcessedCount, lastProcessedTenderRef })
      diagnostics.recordPage({
        outcome: 'processed',
        page: pageBatch.pageNumber,
        tendersDiscovered: pageBatch.tenders.length,
      })

      if (pageBatch.isLastPage || !cursor.nextPage) {
        nextPage = null
      } else {
        nextPage = cursor.nextPage
        diagnostics.startPhase('discovery')
      }
    }

    diagnostics.startPhase('cleanup')

    if (!deadlineReached && !budget.hasPhaseBudget('finalization')) {
      deadlineReached = true
    }

    if (deadlineReached) {
      return completePartialRun({
        db,
        diagnostics,
        sourceRun,
        results,
        cursor,
        tendersProcessedCount,
        lastProcessedTenderRef,
        skippedForResume,
        deadlineMs,
        exitReason: 'time_budget',
        startedAtMs,
        now,
      })
    }

    const metrics = await buildRunDiffMetrics({
      db,
      sourceId: source.id,
      currentRunId: sourceRun.id,
      currentSnapshots: [...tenderSnapshots.values()],
      diagnostics,
    })

    return completeSuccessfulRun({
      db,
      diagnostics,
      sourceRun,
      results,
      tendersProcessedCount,
      skippedForResume,
      metrics,
      deliverDigests,
      notificationArgs: { organizations, sourceRun, results },
      logger,
      startedAtMs,
      now,
    })
  } catch (error) {
    return failRun({ db, diagnostics, sourceRun, error, cursor, tendersProcessedCount, lastProcessedTenderRef, logger, startedAtMs, now })
  } finally {
    if (stopHeartbeat) stopHeartbeat()
  }
}
