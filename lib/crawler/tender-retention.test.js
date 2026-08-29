import { isTenderEligibleForArchival, runTenderRetentionJob } from './tender-retention'

describe('tender retention lifecycle', () => {
  const now = new Date('2026-08-27T00:00:00.000Z')

  it('archives only tenders closed more than the configured period ago', () => {
    expect(isTenderEligibleForArchival({ deadline: '2025-07-01T00:00:00.000Z' }, { now, archiveMonths: 12 })).toBe(true)
    expect(isTenderEligibleForArchival({ deadline: '2025-09-01T00:00:00.000Z' }, { now, archiveMonths: 12 })).toBe(false)
    expect(isTenderEligibleForArchival({ deadline: '2027-01-01T00:00:00.000Z' }, { now, archiveMonths: 12 })).toBe(false)
    expect(isTenderEligibleForArchival({ deadline: null }, { now, archiveMonths: 12 })).toBe(false)
  })

  it('reports candidates in dry-run mode without updating records', async () => {
    const update = jest.fn()
    const db = {
      opportunity: {
        findMany: jest.fn(async () => [
          { id: 1, title: 'Old tender', deadline: new Date('2025-01-01T00:00:00.000Z'), archivedAt: null },
          { id: 2, title: 'Active tender', deadline: new Date('2026-09-01T00:00:00.000Z'), archivedAt: null },
        ]),
        update,
      },
    }
    const logger = { crawler: jest.fn() }

    const result = await runTenderRetentionJob({ db, now, archiveMonths: 12, dryRun: true, crawlerLogger: logger })

    expect(result.candidates.map(candidate => candidate.id)).toEqual([1])
    expect(result.archived).toBe(0)
    expect(update).not.toHaveBeenCalled()
    expect(logger.crawler).toHaveBeenCalledWith(expect.objectContaining({ message: 'tender_retention_dry_run' }))
  })

  it('keeps a closed tender retrievable while marking it archived', async () => {
    const db = {
      opportunity: {
        findMany: jest.fn(async () => [
          { id: 9, title: 'Archived tender', deadline: new Date('2025-01-01T00:00:00.000Z'), archivedAt: null },
        ]),
        update: jest.fn(async ({ where }) => ({ id: where.id })),
      },
    }

    const result = await runTenderRetentionJob({ db, now, archiveMonths: 12, dryRun: false, crawlerLogger: { crawler: jest.fn() } })

    expect(result.archived).toBe(1)
    expect(db.opportunity.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 9 },
      data: { archivedAt: now },
    }))
  })
})
