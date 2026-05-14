import { TimeBudget } from './time-budget'

describe('TimeBudget', () => {
  it('allocates static phase budgets as 40/50/10 percent of the total deadline', () => {
    const budget = new TimeBudget({
      deadlineMs: 240_000,
      now: () => 0,
    })

    expect(budget.phaseBudgets).toEqual({
      discovery: 96_000,
      processing: 120_000,
      finalization: 24_000,
    })
  })

  it('reports remaining time and buffer availability', () => {
    let currentTime = 1000
    const budget = new TimeBudget({
      deadlineMs: 240_000,
      now: () => currentTime,
    })

    currentTime += 226_000

    expect(budget.remaining()).toBe(14_000)
    expect(budget.hasBuffer(15_000)).toBe(false)
    expect(budget.hasBuffer(10_000)).toBe(true)
  })
})
