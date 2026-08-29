const DIRECT_TENDER_TEXT_FIELDS = [
  'title',
  'description',
  'category',
  'reference',
  'entity',
  'pdfText',
  'documentText',
]

const NESTED_TENDER_TEXT_FIELDS = [
  'title',
  'description',
  'category',
  'reference',
  'entity',
  'pdfText',
  'documentText',
]

const TENDER_DETAIL_TEXT_FIELDS = [
  'entity',
  'category',
  'province',
]

function addTextPart(parts, value) {
  if (value === null || value === undefined) return

  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim()
    if (normalized) parts.push(normalized)
  }
}

function addObjectFields(parts, object, fields) {
  if (!object || typeof object !== 'object') return

  for (const field of fields) {
    addTextPart(parts, object[field])
  }
}

function addArrayObjectFields(parts, values, fields) {
  if (!Array.isArray(values)) return

  for (const value of values) {
    addObjectFields(parts, value, fields)
  }
}

export function getTenderSearchText(tender = {}) {
  const parts = []

  addObjectFields(parts, tender, DIRECT_TENDER_TEXT_FIELDS)
  addObjectFields(parts, tender.tenderDetails, TENDER_DETAIL_TEXT_FIELDS)
  addObjectFields(parts, tender.opportunity, NESTED_TENDER_TEXT_FIELDS)
  addArrayObjectFields(parts, tender.pdfAssets, ['text'])
  addArrayObjectFields(parts, tender.documents, ['text'])

  return parts.join(' ').toLowerCase()
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function includesKeyword(text, keyword) {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  if (!normalizedKeyword) return false

  const words = normalizedKeyword.split(/\s+/).map(escapeRegExp)
  if (words.length === 0) return false

  if (words.length === 1) {
    const word = words[0]
    const pluralSuffix = normalizedKeyword.endsWith('s') ? '' : 's?'
    return new RegExp(`(^|[^a-z0-9])${word}${pluralSuffix}(?=$|[^a-z0-9])`, 'i')
      .test(String(text || ''))
  }

  const phrasePattern = words.join('[^a-z0-9]+')
  return new RegExp(`(^|[^a-z0-9])${phrasePattern}(?=$|[^a-z0-9])`, 'i')
    .test(String(text || ''))
}

export function parseKeywordList(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => String(item || '').trim())
      .filter(Boolean)
  }

  return String(value || '')
    .split(/[,;\n]/)
    .map(item => item.trim())
    .filter(Boolean)
}
