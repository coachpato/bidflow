import { runTenderRetentionJob } from '@/lib/crawler/tender-retention'
import prisma from '@/lib/prisma'

function isAuthorizedCron(request) {
  const secret = process.env.CRON_SECRET
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`)
}

function getPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export async function GET(request) {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runTenderRetentionJob({
    db: prisma,
    dryRun: process.env.TENDER_RETENTION_DRY_RUN !== 'false',
    batchSize: getPositiveInteger(process.env.TENDER_RETENTION_BATCH_SIZE, 100),
  })

  return Response.json({
    ok: true,
    dryRun: result.dryRun,
    candidates: result.candidates.length,
    archived: result.archived,
    cutoff: result.cutoff.toISOString(),
  })
}
