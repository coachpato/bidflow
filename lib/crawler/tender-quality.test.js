import { validateTenderQuality } from './tender-quality'

const NOW = new Date('2026-05-13T00:00:00.000Z')

function validTender(overrides = {}) {
  return {
    reference: 'BID-123/2026',
    description: 'Appointment of a panel of attorneys for legal services.',
    deadline: '2026-06-30T00:00:00.000Z',
    ...overrides,
  }
}

describe('tender quality validation', () => {
  it('passes valid eTenders records', () => {
    expect(validateTenderQuality(validTender(), { now: NOW })).toEqual({
      valid: true,
      errors: [],
      warnings: [],
    })
  })

  it('flags missing or malformed references as invalid', () => {
    expect(validateTenderQuality(validTender({ reference: '12345' }), { now: NOW })).toMatchObject({
      valid: false,
      errors: ['invalid-reference'],
    })
  })

  it('flags short or placeholder descriptions as invalid', () => {
    expect(validateTenderQuality(validTender({ description: 'N/A' }), { now: NOW })).toMatchObject({
      valid: false,
      errors: ['invalid-description'],
    })
  })

  it('warns when closing dates are outside the expected range', () => {
    expect(validateTenderQuality(validTender({ deadline: '2026-03-01T00:00:00.000Z' }), { now: NOW }).warnings)
      .toContain('closing-date-too-far-in-past')

    expect(validateTenderQuality(validTender({ deadline: '2029-01-01T00:00:00.000Z' }), { now: NOW }).warnings)
      .toContain('closing-date-too-far-in-future')
  })
})
