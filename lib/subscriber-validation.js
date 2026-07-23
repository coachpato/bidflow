import { isValidSector } from '@/lib/sectors'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function normalizeRequiredString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeOptionalString(value) {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed || null
}

export function isValidEmail(value) {
  return EMAIL_PATTERN.test(normalizeEmail(value))
}

export function normalizeSubscriberInput(input = {}) {
  return {
    email: normalizeEmail(input.email),
    entityName: normalizeRequiredString(input.entityName),
    sector: normalizeRequiredString(input.sector),
    keywords: normalizeOptionalString(input.keywords),
    location: normalizeOptionalString(input.location),
  }
}

export function validateSubscriberInput(input = {}) {
  const values = normalizeSubscriberInput(input)
  const errors = {}

  if (!isValidEmail(values.email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!values.entityName) {
    errors.entityName = 'Entity or business name is required.'
  }

  if (!values.sector) {
    errors.sector = 'Choose a sector.'
  } else if (!isValidSector(values.sector)) {
    errors.sector = 'Choose a valid sector.'
  }

  return {
    values,
    errors,
    valid: Object.keys(errors).length === 0,
  }
}

export function validateSubscriptionLookup(input = {}) {
  const email = normalizeEmail(input.email)
  const errors = {}

  if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email address.'
  }

  return {
    values: { email },
    errors,
    valid: Object.keys(errors).length === 0,
  }
}

export function validateSubscriptionSectorInput(input = {}) {
  const email = normalizeEmail(input.email)
  const sector = normalizeRequiredString(input.sector)
  const errors = {}

  if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!sector) {
    errors.sector = 'Choose a sector.'
  } else if (!isValidSector(sector)) {
    errors.sector = 'Choose a valid sector.'
  }

  return {
    values: {
      email,
      sector,
      keywords: normalizeOptionalString(input.keywords),
      location: normalizeOptionalString(input.location),
    },
    errors,
    valid: Object.keys(errors).length === 0,
  }
}
