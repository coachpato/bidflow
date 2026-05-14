import { classifyError, CRAWL_ERROR_TYPES } from '@/lib/errors'
import { getTenderResumeRef } from '@/lib/page-iterator'
import prisma from '@/lib/prisma'

const DEAD_LETTER_TYPES = new Set([
  CRAWL_ERROR_TYPES.FATAL,
  CRAWL_ERROR_TYPES.SOURCE_DATA_INVALID,
])

export function shouldDeadLetterTender(classifiedError, attemptCount) {
  return DEAD_LETTER_TYPES.has(classifiedError.type) || attemptCount >= 3
}

export async function writeDeadLetter({
  db = prisma,
  tender,
  sourceRun,
  error,
  failureCount = 1,
}) {
  const classifiedError = classifyError(error)
  const tenderRef = getTenderResumeRef(tender) || 'unknown'
  const existing = await db.deadLetter.findFirst({
    where: {
      tenderRef,
      sourceRunId: sourceRun.id,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (existing) {
    return db.deadLetter.update({
      where: { id: existing.id },
      data: {
        failureCount: { increment: 1 },
        failureType: classifiedError.type,
        lastError: classifiedError.message,
        rawData: tender,
      },
    })
  }

  return db.deadLetter.create({
    data: {
      tenderRef,
      sourceRunId: sourceRun.id,
      failureType: classifiedError.type,
      failureCount,
      lastError: classifiedError.message,
      rawData: tender,
    },
  })
}
