export const DEFAULT_TENDER_CHECKLIST_ITEMS = [
  'Review source pack and confirm key dates',
  'Collect mandatory returnables',
  'Complete internal review and sign-off',
  'Submit before deadline',
  'Upload final submission backup',
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
