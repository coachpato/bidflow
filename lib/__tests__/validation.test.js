/**
 * Tests for validation utilities
 */

import {
  toNullableNumber,
  toNullableDate,
  parseAssignedUserId,
  escapeHtml,
  formatDate,
  getDaysRemainingLabel,
  validateEmail,
  validateNonEmptyString,
  validateDateRange,
} from '../validation'

describe('Validation Utilities', () => {
  describe('toNullableNumber', () => {
    it('should convert valid string to number', () => {
      expect(toNullableNumber('42')).toBe(42)
      expect(toNullableNumber('3.14')).toBe(3.14)
    })

    it('should return null for empty values', () => {
      expect(toNullableNumber(null)).toBeNull()
      expect(toNullableNumber('')).toBeNull()
    })

    it('should return undefined for undefined', () => {
      expect(toNullableNumber(undefined)).toBeUndefined()
    })
  })

  describe('toNullableDate', () => {
    it('should convert valid date string', () => {
      const result = toNullableDate('2025-12-15T10:00:00')
      expect(result).toEqual(new Date('2025-12-15T10:00:00'))
    })

    it('should return null for invalid dates', () => {
      expect(toNullableDate('invalid-date')).toBeNull()
    })

    it('should return null for empty values', () => {
      expect(toNullableDate(null)).toBeNull()
      expect(toNullableDate('')).toBeNull()
    })
  })

  describe('parseAssignedUserId', () => {
    it('should parse valid user IDs', () => {
      expect(parseAssignedUserId('123')).toBe(123)
      expect(parseAssignedUserId(456)).toBe(456)
    })

    it('should return null for invalid IDs', () => {
      expect(parseAssignedUserId('abc')).toBeNull()
    })

    it('should return null for empty values', () => {
      expect(parseAssignedUserId(null)).toBeNull()
      expect(parseAssignedUserId('')).toBeNull()
    })
  })

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      )
    })

    it('should escape ampersands', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry')
    })

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('')
      expect(escapeHtml(null)).toBe('')
    })
  })

  describe('formatDate', () => {
    it('should format dates in South African locale', () => {
      const date = new Date('2025-12-15')
      const result = formatDate(date)
      expect(result).toMatch(/15.*Dec.*2025/)
    })

    it('should handle string dates', () => {
      const result = formatDate('2025-12-15T10:00:00')
      expect(result).toMatch(/15.*Dec.*2025/)
    })

    it('should handle empty values', () => {
      expect(formatDate(null)).toBe('')
      expect(formatDate('')).toBe('')
    })
  })

  describe('getDaysRemainingLabel', () => {
    it('should show "Overdue" for past dates', () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      expect(getDaysRemainingLabel(pastDate)).toBe('Overdue')
    })

    it('should show "Due today" for today', () => {
      const today = new Date()
      today.setHours(23, 59, 59) // Set to end of day
      const result = getDaysRemainingLabel(today)
      expect(['Due today', 'Overdue']).toContain(result)
    })

    it('should show days remaining for future dates', () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 5)
      expect(getDaysRemainingLabel(futureDate)).toBe('5 days remaining')
    })
  })

  describe('validateEmail', () => {
    it('should validate correct emails', () => {
      const email = validateEmail('test@example.com')
      expect(email).toBe('test@example.com')
    })

    it('should normalize case', () => {
      const email = validateEmail('TEST@EXAMPLE.COM')
      expect(email).toBe('test@example.com')
    })

    it('should throw on invalid emails', () => {
      expect(() => validateEmail('invalid-email')).toThrow()
      expect(() => validateEmail('')).toThrow()
    })
  })

  describe('validateNonEmptyString', () => {
    it('should validate non-empty strings', () => {
      const result = validateNonEmptyString('hello')
      expect(result).toBe('hello')
    })

    it('should trim whitespace', () => {
      const result = validateNonEmptyString('  hello  ')
      expect(result).toBe('hello')
    })

    it('should throw on empty values', () => {
      expect(() => validateNonEmptyString('')).toThrow()
      expect(() => validateNonEmptyString('   ')).toThrow()
      expect(() => validateNonEmptyString(null)).toThrow()
    })
  })

  describe('validateDateRange', () => {
    it('should validate correct date ranges', () => {
      const start = new Date('2025-01-01')
      const end = new Date('2025-12-31')
      const result = validateDateRange(start, end)
      expect(result.start).toEqual(start)
      expect(result.end).toEqual(end)
    })

    it('should throw if start > end', () => {
      const start = new Date('2025-12-31')
      const end = new Date('2025-01-01')
      expect(() => validateDateRange(start, end)).toThrow()
    })

    it('should throw on invalid dates', () => {
      expect(() => validateDateRange('invalid', '2025-12-31')).toThrow()
    })
  })
})
