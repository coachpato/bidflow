const REFERENCE_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9][A-Za-z0-9/_.() -]{2,}$/
const PLACEHOLDER_DESCRIPTION_PATTERN = /^(n\/a|na|none|null|tbd|not applicable|-+)$/i
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000

function parseDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function hasValidReference(reference) {
  return typeof reference === 'string' && REFERENCE_PATTERN.test(reference.trim())
}

function hasValidDescription(description) {
  if (typeof description !== 'string') return false
  const normalized = description.trim()
  return normalized.length >= 10 && !PLACEHOLDER_DESCRIPTION_PATTERN.test(normalized)
}

export function validateTenderQuality(tender, { now = new Date() } = {}) {
  const errors = []
  const warnings = []

  if (!hasValidReference(tender.reference)) {
    errors.push('invalid-reference')
  }

  if (!hasValidDescription(tender.description)) {
    errors.push('invalid-description')
  }

  const closingDate = parseDate(tender.deadline)
  if (tender.deadline && !closingDate) {
    warnings.push('invalid-closing-date')
  }

  if (closingDate) {
    const deltaMs = closingDate.getTime() - now.getTime()

    if (deltaMs < -THIRTY_DAYS_MS) {
      warnings.push('closing-date-too-far-in-past')
    }

    if (deltaMs > TWO_YEARS_MS) {
      warnings.push('closing-date-too-far-in-future')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
