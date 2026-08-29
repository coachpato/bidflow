import { notFound } from 'next/navigation'
import { parseTenderRouteId } from '@/lib/crawler/tender-identity'
import { logger } from '@/lib/logger'
import { getCachedPublicTender } from '@/lib/public-tender-read-model'
import TenderDetailContent from './TenderDetailContent'

export const revalidate = 300

export async function generateMetadata({ params }) {
  const routeParams = await params
  const tenderId = parseTenderRouteId(routeParams?.id)
  if (!tenderId) return { title: 'Tender not found | Bid360' }

  const tender = await getCachedPublicTender(tenderId)
  if (!tender) return { title: 'Tender not found | Bid360' }

  return {
    title: `${tender.title} | Bid360`,
    description: tender.entity ? `${tender.title} issued by ${tender.entity}.` : tender.title,
  }
}

export default async function TenderPage({ params }) {
  const routeParams = await params
  const tenderId = parseTenderRouteId(routeParams?.id)
  if (!tenderId) {
    logger.crawler({
      level: 'warn',
      phase: 'tender-page',
      message: 'tender_page_not_found',
      data: { reason: 'invalid-id' },
    })
    notFound()
  }

  const tender = await getCachedPublicTender(tenderId)
  if (!tender) {
    logger.crawler({
      level: 'warn',
      phase: 'tender-page',
      message: 'tender_page_not_found',
      data: { reason: 'unknown-id', tenderId },
    })
    notFound()
  }

  return <TenderDetailContent tender={tender} />
}
