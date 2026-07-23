function collectTextParts(value, parts, seen) {
  if (value === null || value === undefined) return

  if (typeof value === 'string' || typeof value === 'number') {
    parts.push(String(value))
    return
  }

  if (value instanceof Date) {
    parts.push(value.toISOString())
    return
  }

  if (typeof value !== 'object') return
  if (seen.has(value)) return

  seen.add(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      collectTextParts(item, parts, seen)
    }
    return
  }

  for (const item of Object.values(value)) {
    collectTextParts(item, parts, seen)
  }
}

export function getTenderSearchText(tender = {}) {
  const parts = []
  collectTextParts(tender, parts, new WeakSet())
  return parts.join(' ').toLowerCase()
}

export function includesKeyword(text, keyword) {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  if (!normalizedKeyword) return false

  return text.includes(normalizedKeyword)
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
