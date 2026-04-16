export const DEFAULT_TENDER_CHECKLIST_ITEMS = [
  'Tax Clearance Certificate (SARS)',
  'CSD (Central Supplier Database) Registration',
  'B-BBEE Certificate',
  'Company Registration Documents (CIPC)',
  'Pricing Schedule',
  'SBD 1 - Invitation to Bid',
  'SBD 4 - Declaration of Interest',
  'SBD 6.1 - Preference Points Claim',
  "SBD 8 - Declaration of Bidder's Past Supply Chain Management Practices",
  'Technical Proposal / Methodology',
]

function normalizeChecklistLabel(value) {
  return value
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function buildTenderChecklistItems(extraItems = []) {
  const merged = []
  const seen = new Set()

  function pushItem(item) {
    if (!item) return

    const normalized = normalizeChecklistLabel(typeof item === 'string' ? item : item.label)
    if (!normalized || seen.has(normalized)) return

    seen.add(normalized)
    merged.push(typeof item === 'string' ? { label: item, done: false } : { done: false, ...item })
  }

  DEFAULT_TENDER_CHECKLIST_ITEMS.forEach(pushItem)
  extraItems.forEach(pushItem)

  return merged
}
