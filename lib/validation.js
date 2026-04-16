/**
 * Centralized validation utilities
 * Consolidates repeated validators from across API routes
 */

/**
 * Convert value to number, handling null/empty cases
 * @param {any} value - Value to convert
 * @returns {number|null|undefined} - Converted number or null
 */
export function toNullableNumber(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return parseFloat(value)
}

/**
 * Convert value to Date, handling null/empty cases
 * @param {any} value - Value to convert
 * @returns {Date|null|undefined} - Converted date or null
 */
export function toNullableDate(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Parse assigned user ID from form input
 * @param {any} value - Value to parse
 * @returns {number|null|undefined} - Parsed user ID or null
 */
export function parseAssignedUserId(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const parsed = parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Escape HTML entities to prevent XSS
 * Used in email templates and notifications
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export function escapeHtml(text) {
  if (!text) return ''
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return String(text).replace(/[&<>"']/g, char => map[char])
}

/**
 * Format date for display (e.g., "15 Dec 2024")
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date string
 */
export function formatDate(date) {
  if (!date) return ''
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

/**
 * Get human-readable label for days remaining
 * @param {Date|string} dueDate - Due date
 * @returns {string} - Human-readable label (e.g., "2 days remaining", "Overdue")
 */
export function getDaysRemainingLabel(dueDate) {
  if (!dueDate) return ''

  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  const now = new Date()
  const isSameCalendarDay =
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()

  if (isSameCalendarDay) return 'Due today'

  const msPerDay = 24 * 60 * 60 * 1000
  const daysRemaining = Math.ceil((due.getTime() - now.getTime()) / msPerDay)

  if (daysRemaining < 0) return 'Overdue'
  if (daysRemaining === 0) return 'Due today'
  if (daysRemaining === 1) return '1 day remaining'
  return `${daysRemaining} days remaining`
}

/**
 * Validate email address format
 * @param {string} email - Email to validate
 * @throws {Error} - If email is invalid
 * @returns {string} - Validated email
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required and must be a string')
  }

  const trimmed = email.trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(trimmed)) {
    throw new Error('Invalid email address format')
  }

  return trimmed
}

/**
 * Validate non-empty string
 * @param {string} value - Value to validate
 * @param {string} fieldName - Name of field (for error message)
 * @throws {Error} - If value is empty
 * @returns {string} - Trimmed string
 */
export function validateNonEmptyString(value, fieldName = 'Field') {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName} is required`)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${fieldName} cannot be empty`)
  }

  return trimmed
}

/**
 * Validate date range (start <= end)
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @param {string} fieldName - Name of range (for error message)
 * @throws {Error} - If dates are invalid or out of order
 */
export function validateDateRange(startDate, endDate, fieldName = 'Date range') {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`${fieldName} contains invalid dates`)
  }

  if (start > end) {
    throw new Error(`${fieldName} start date must be before end date`)
  }

  return { start, end }
}

/**
 * Sanitize object keys (remove any that aren't in allowlist)
 * Prevents mass assignment vulnerabilities
 * @param {object} obj - Object to sanitize
 * @param {string[]} allowedKeys - Keys that are allowed
 * @returns {object} - Sanitized object
 */
export function sanitizeObject(obj, allowedKeys) {
  if (!obj || typeof obj !== 'object') return {}
  if (!Array.isArray(allowedKeys)) return {}

  const result = {}
  allowedKeys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key]
    }
  })
  return result
}
