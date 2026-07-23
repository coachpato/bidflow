import prisma from '@/lib/prisma'
import { getTenderSearchText, includesKeyword, parseKeywordList } from '@/lib/matching/tender-text'

const SUBSCRIBER_SELECT = {
  id: true,
  email: true,
  entityName: true,
  sector: true,
  keywords: true,
  location: true,
  unsubscribeToken: true,
}

function subscriberKeywordMatchesTender(subscriber, tenderText) {
  const keywords = parseKeywordList(subscriber.keywords)
  if (keywords.length === 0) return true

  return keywords.some(keyword => includesKeyword(tenderText, keyword))
}

export async function matchSubscribersToTender(tender = {}, matchedSectors = [], db = prisma) {
  const sectors = Array.from(new Set(matchedSectors.filter(Boolean)))
  if (sectors.length === 0) return []

  const subscribers = await db.subscriber.findMany({
    where: {
      subscribed: true,
      sector: { in: sectors },
    },
    select: SUBSCRIBER_SELECT,
    orderBy: [
      { sector: 'asc' },
      { email: 'asc' },
    ],
  })

  const tenderText = getTenderSearchText(tender)

  return subscribers.filter(subscriber =>
    subscriberKeywordMatchesTender(subscriber, tenderText)
  )
}
