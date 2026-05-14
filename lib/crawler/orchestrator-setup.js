import { fetchETendersPage } from '@/lib/crawler/etenders-crawler'
import { ensureOrganizationContext } from '@/lib/organization'
import { getResumeStartPage, validateCursor } from '@/lib/page-iterator'
import {
  acquireLease,
  claimStaleRun,
  findLatestRunWithCursor,
  markExpiredRunsStale,
} from '@/lib/run-lifecycle'
import { RUN_STATUSES } from '@/lib/run-state'

export async function ensureSourceRecord({ db, sourceConfig }) {
  return db.source.upsert({
    where: { key: sourceConfig.key },
    update: {
      name: sourceConfig.name,
      type: sourceConfig.type,
      baseUrl: sourceConfig.baseUrl,
    },
    create: {
      key: sourceConfig.key,
      name: sourceConfig.name,
      type: sourceConfig.type,
      baseUrl: sourceConfig.baseUrl,
    },
  })
}

export async function loadOrganizationsForRadar({ db }) {
  let organizations = await db.organization.findMany({
    include: { firmProfile: true },
    orderBy: { id: 'asc' },
  })

  if (organizations.length === 0) {
    const users = await db.user.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    })

    for (const user of users) {
      await ensureOrganizationContext(user.id)
    }

    organizations = await db.organization.findMany({
      include: { firmProfile: true },
      orderBy: { id: 'asc' },
    })
  }

  return organizations.filter(organization => organization.firmProfile)
}

async function resolveResumeCursor({ db, sourceId, logger }) {
  const previousRun = await findLatestRunWithCursor({ db, sourceId })

  if (!previousRun?.cursor) {
    return { previousRun: null, resumeCursor: null, cursorValidation: null }
  }

  const cursorValidation = await validateCursor({
    cursor: previousRun.cursor,
    fetchPage: pageNumber => fetchETendersPage(pageNumber, previousRun.cursor.pageSize),
    logger,
  })

  return {
    previousRun,
    resumeCursor: cursorValidation.valid ? previousRun.cursor : null,
    cursorValidation,
  }
}

export async function initializeCrawlerRun({ db, source, logger }) {
  await markExpiredRunsStale({ db, sourceId: source.id, logger })

  const { previousRun, resumeCursor, cursorValidation } = await resolveResumeCursor({
    db,
    sourceId: source.id,
    logger,
  })

  if (previousRun?.runStatus === RUN_STATUSES.STALE && resumeCursor) {
    const sourceRun = await claimStaleRun({ db, run: previousRun })
    return { sourceRun, resumeCursor, cursorValidation, reusedRun: true }
  }

  const sourceRun = await acquireLease({
    db,
    sourceId: source.id,
    data: {
      tendersProcessedCount: 0,
      lastProcessedTenderRef: resumeCursor?.lastProcessedRef || null,
      completionMode: null,
      errorMessage: null,
      cursor: resumeCursor,
    },
  })

  return { sourceRun, resumeCursor, cursorValidation, reusedRun: false }
}

export function buildInitialResults(source, organizations) {
  return {
    source: source.name,
    totalFound: 0,
    organizationsEvaluated: organizations.length,
    matchedCount: 0,
    newOpportunitiesCreated: 0,
    digestsSent: 0,
    opportunitiesByOrganization: {},
    errors: [],
    warnings: [],
  }
}

export function getInitialPage(cursor) {
  return getResumeStartPage(cursor)
}
