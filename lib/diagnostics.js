import { CRAWL_ERROR_TYPES, classifyError } from './errors'

export const DIAGNOSTIC_PHASES = ['discovery', 'processing', 'cleanup']
export const EXIT_REASONS = ['completed', 'budget_exhausted', 'time_budget', 'fatal_error', 'lease_expired']

function createErrorBreakdown() {
  return Object.values(CRAWL_ERROR_TYPES).reduce((breakdown, type) => {
    breakdown[type] = 0
    return breakdown
  }, {})
}

function createPhaseTimings() {
  return DIAGNOSTIC_PHASES.reduce((timings, phase) => {
    timings[phase] = 0
    return timings
  }, {})
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * Collects crawl diagnostics per run so partial and failed exits still leave a complete snapshot.
 */
export class DiagnosticsCollector {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now
    this.activePhaseStarts = new Map()
    this.diagnostics = {
      pagesFound: 0,
      pagesProcessed: 0,
      pagesFailed: 0,
      pagesSkipped: 0,
      pageErrors: [],
      tendersDiscovered: 0,
      tendersProcessed: 0,
      tendersSkipped: 0,
      tendersInvalid: 0,
      tendersDeadLettered: 0,
      tendersWithNoMatches: 0,
      tenderWarnings: [],
      structuralChanges: [],
      runDiffWarnings: [],
      sourceHealth: {
        rateLimitEvents: 0,
        serverErrors: 0,
      },
      resource: {
        totalBytesDownloaded: 0,
      },
      errorBreakdown: createErrorBreakdown(),
      phaseTimings: createPhaseTimings(),
      exitReason: 'completed',
    }
  }

  recordPage(outcome, options = {}) {
    const pageOutcome = typeof outcome === 'string' ? outcome : outcome?.outcome
    const pageCount = typeof outcome === 'object' && Number.isFinite(outcome.count) ? outcome.count : 1
    const pageNumber = typeof outcome === 'object' ? outcome.page : options.page
    const error = typeof outcome === 'object' ? outcome.error || options.error : options.error
    const tendersDiscovered = typeof outcome === 'object' && Number.isFinite(outcome.tendersDiscovered)
      ? outcome.tendersDiscovered
      : 0

    if (pageOutcome === 'found') this.diagnostics.pagesFound += pageCount
    if (['processed', 'succeeded', 'success'].includes(pageOutcome)) this.diagnostics.pagesProcessed += pageCount
    if (['failed', 'error'].includes(pageOutcome)) {
      this.diagnostics.pagesFailed += pageCount

      if (error) {
        const classifiedError = classifyError(error)
        this.diagnostics.pageErrors.push({
          page: pageNumber ?? null,
          error: classifiedError.message,
          type: classifiedError.type,
        })
      }
    }
    if (pageOutcome === 'skipped') this.diagnostics.pagesSkipped += pageCount
    if (tendersDiscovered > 0) this.diagnostics.tendersDiscovered += tendersDiscovered
  }

  recordTender(outcome, count = 1) {
    const tenderOutcome = typeof outcome === 'string' ? outcome : outcome?.outcome
    const tenderCount = typeof outcome === 'object' && Number.isFinite(outcome.count) ? outcome.count : count

    if (tenderOutcome === 'discovered') this.diagnostics.tendersDiscovered += tenderCount
    if (['processed', 'written', 'success'].includes(tenderOutcome)) this.diagnostics.tendersProcessed += tenderCount
    if (tenderOutcome === 'skipped') this.diagnostics.tendersSkipped += tenderCount
    if (tenderOutcome === 'invalid') this.diagnostics.tendersInvalid += tenderCount
    if (['no_match', 'no-match'].includes(tenderOutcome)) this.diagnostics.tendersWithNoMatches += tenderCount
    if (['dead_lettered', 'dead-lettered'].includes(tenderOutcome)) {
      this.diagnostics.tendersDeadLettered += tenderCount
    }
  }

  recordError(error) {
    const classifiedError = classifyError(error)
    this.diagnostics.errorBreakdown[classifiedError.type] += 1
    if (classifiedError.context?.httpStatus === 429) {
      this.diagnostics.sourceHealth.rateLimitEvents += 1
    }
    if (classifiedError.context?.httpStatus >= 500) {
      this.diagnostics.sourceHealth.serverErrors += 1
    }
    return classifiedError
  }

  recordStructureChange(change) {
    this.diagnostics.structuralChanges.push(clone(change))
  }

  recordTenderWarning(warning) {
    this.diagnostics.tenderWarnings.push(clone(warning))
  }

  recordRunDiffWarning(warning) {
    this.diagnostics.runDiffWarnings.push(clone(warning))
  }

  recordRateLimitEvent() {
    this.diagnostics.sourceHealth.rateLimitEvents += 1
  }

  recordBytesDownloaded(byteCount) {
    if (Number.isFinite(byteCount) && byteCount > 0) {
      this.diagnostics.resource.totalBytesDownloaded += byteCount
    }
  }

  startPhase(phase) {
    this.assertKnownPhase(phase)
    if (!this.activePhaseStarts.has(phase)) {
      this.activePhaseStarts.set(phase, this.now())
    }
  }

  endPhase(phase) {
    this.assertKnownPhase(phase)
    const startedAt = this.activePhaseStarts.get(phase)
    if (startedAt === undefined) return

    this.diagnostics.phaseTimings[phase] += Math.max(0, this.now() - startedAt)
    this.activePhaseStarts.delete(phase)
  }

  setExitReason(exitReason) {
    if (!EXIT_REASONS.includes(exitReason)) {
      throw new Error(`Unknown crawl exit reason: ${exitReason}`)
    }

    this.diagnostics.exitReason = exitReason
  }

  snapshot() {
    for (const phase of this.activePhaseStarts.keys()) {
      this.endPhase(phase)
    }

    return clone(this.diagnostics)
  }

  assertKnownPhase(phase) {
    if (!DIAGNOSTIC_PHASES.includes(phase)) {
      throw new Error(`Unknown crawl diagnostics phase: ${phase}`)
    }
  }
}
