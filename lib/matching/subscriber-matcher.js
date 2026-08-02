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

const SUBSCRIBER_KEYWORD_EXPANSIONS = {
  legal: {
    attorney: [
      'attorney',
      'attorneys',
      'law firm',
      'law firms',
      'lawyer',
      'lawyers',
      'legal practitioner',
      'legal practitioners',
      'legal service provider',
      'legal service providers',
      'legal services provider',
      'legal services providers',
      'legal counsel',
      'external legal counsel',
      'litigation',
    ],
    attorneys: [
      'attorney',
      'attorneys',
      'law firm',
      'law firms',
      'lawyer',
      'lawyers',
      'legal practitioner',
      'legal practitioners',
      'legal service provider',
      'legal service providers',
      'legal services provider',
      'legal services providers',
      'legal counsel',
      'external legal counsel',
      'litigation',
    ],
  },
}

function normalizeKeywordKey(value) {
  return String(value || '').trim().toLowerCase()
}

export function expandSubscriberKeywords(subscriber = {}) {
  const keywords = parseKeywordList(subscriber.keywords)
  if (keywords.length === 0) return []

  const sectorExpansions = SUBSCRIBER_KEYWORD_EXPANSIONS[subscriber.sector] || {}
  const expanded = new Set()

  for (const keyword of keywords) {
    expanded.add(keyword)

    const expansion = sectorExpansions[normalizeKeywordKey(keyword)] || []
    for (const alias of expansion) {
      expanded.add(alias)
    }
  }

  return Array.from(expanded)
}

export function getSubscriberKeywordMatches(subscriber = {}, tender = {}) {
  const keywords = expandSubscriberKeywords(subscriber)
  if (keywords.length === 0) return []

  const tenderText = typeof tender === 'string' ? tender : getTenderSearchText(tender)

  return keywords.filter(keyword => includesKeyword(tenderText, keyword))
}

export function subscriberKeywordMatchesTender(subscriber = {}, tender = {}) {
  const keywords = expandSubscriberKeywords(subscriber)
  if (keywords.length === 0) return true

  return getSubscriberKeywordMatches(subscriber, tender).length > 0
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

  return subscribers
    .map((subscriber, index) => ({
      subscriber,
      index,
      keywordMatchCount: getSubscriberKeywordMatches(subscriber, tenderText).length,
    }))
    .sort((left, right) => {
      const keywordHitDelta =
        Number(right.keywordMatchCount > 0) - Number(left.keywordMatchCount > 0)

      return keywordHitDelta
        || right.keywordMatchCount - left.keywordMatchCount
        || left.index - right.index
    })
    .map(item => item.subscriber)
}
