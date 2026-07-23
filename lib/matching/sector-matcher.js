import { SECTORS } from '@/lib/sectors'
import { getTenderSearchText, includesKeyword } from '@/lib/matching/tender-text'

export function matchTenderToSectors(tender = {}) {
  const tenderText = getTenderSearchText(tender)
  if (!tenderText) return []

  return SECTORS
    .filter(sector => sector.keywords.some(keyword => includesKeyword(tenderText, keyword)))
    .map(sector => sector.value)
}
