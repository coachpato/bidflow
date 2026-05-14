import { CRAWL_ERROR_TYPES, CrawlError } from './errors'
import { DiagnosticsCollector } from './diagnostics'

describe('DiagnosticsCollector', () => {
  it('captures page failures, classified errors, timing, and exit reason in the snapshot', () => {
    let currentTime = 1000
    const collector = new DiagnosticsCollector({ now: () => currentTime })

    collector.startPhase('discovery')
    currentTime += 25
    collector.recordPage({ outcome: 'processed', tendersDiscovered: 10 })
    const pageError = Object.assign(new Error('Page unavailable'), {
      response: { status: 503 },
    })
    collector.recordPage({ outcome: 'failed', page: 2, error: pageError })
    collector.recordError(new CrawlError('Source unavailable', CRAWL_ERROR_TYPES.RETRYABLE))
    collector.setExitReason('fatal_error')
    currentTime += 75

    const snapshot = collector.snapshot()

    expect(snapshot.pagesProcessed).toBe(1)
    expect(snapshot.pagesFailed).toBe(1)
    expect(snapshot.pageErrors).toEqual([
      {
        page: 2,
        error: 'Page unavailable',
        type: CRAWL_ERROR_TYPES.RETRYABLE,
      },
    ])
    expect(snapshot.tendersDiscovered).toBe(10)
    expect(snapshot.errorBreakdown.retryable).toBe(1)
    expect(snapshot.phaseTimings.discovery).toBe(100)
    expect(snapshot.exitReason).toBe('fatal_error')
  })

  it('tracks tender outcomes independently from page outcomes', () => {
    const collector = new DiagnosticsCollector()

    collector.recordTender('processed')
    collector.recordTender('skipped')
    collector.recordTender('invalid')
    collector.recordTender('dead_lettered')

    const snapshot = collector.snapshot()

    expect(snapshot.tendersProcessed).toBe(1)
    expect(snapshot.tendersSkipped).toBe(1)
    expect(snapshot.tendersInvalid).toBe(1)
    expect(snapshot.tendersDeadLettered).toBe(1)
  })

  it('records structural changes in a JSON-safe snapshot', () => {
    const collector = new DiagnosticsCollector()

    collector.recordStructureChange({
      severity: 'warning',
      reasons: ['tender-count-dropped'],
      previousTenderCardsFound: 100,
      currentTenderCardsFound: 40,
    })

    expect(collector.snapshot().structuralChanges).toEqual([
      {
        severity: 'warning',
        reasons: ['tender-count-dropped'],
        previousTenderCardsFound: 100,
        currentTenderCardsFound: 40,
      },
    ])
  })

  it('returns defensive snapshots so callers cannot mutate collector state', () => {
    const collector = new DiagnosticsCollector()
    const first = collector.snapshot()
    first.pagesProcessed = 999

    expect(collector.snapshot().pagesProcessed).toBe(0)
  })
})
