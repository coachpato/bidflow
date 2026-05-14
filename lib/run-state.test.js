import { assertValidTransition, RUN_STATUSES } from './run-state'

describe('run state transitions', () => {
  it('allows only the approved crawler lifecycle transitions', () => {
    expect(() => assertValidTransition(RUN_STATUSES.PENDING, RUN_STATUSES.RUNNING)).not.toThrow()
    expect(() => assertValidTransition(RUN_STATUSES.RUNNING, RUN_STATUSES.COMPLETED)).not.toThrow()
    expect(() => assertValidTransition(RUN_STATUSES.RUNNING, RUN_STATUSES.COMPLETED_WITH_WARNINGS)).not.toThrow()
    expect(() => assertValidTransition(RUN_STATUSES.RUNNING, RUN_STATUSES.PARTIAL_TIMEOUT)).not.toThrow()
    expect(() => assertValidTransition(RUN_STATUSES.RUNNING, RUN_STATUSES.FAILED)).not.toThrow()
    expect(() => assertValidTransition(RUN_STATUSES.RUNNING, RUN_STATUSES.STALE)).not.toThrow()
    expect(() => assertValidTransition(RUN_STATUSES.STALE, RUN_STATUSES.RUNNING)).not.toThrow()
  })

  it('rejects invalid or unknown transitions with a clear error', () => {
    expect(() => assertValidTransition(RUN_STATUSES.PENDING, RUN_STATUSES.COMPLETED))
      .toThrow('Invalid run status transition from "pending" to "completed"')
    expect(() => assertValidTransition(RUN_STATUSES.COMPLETED, RUN_STATUSES.RUNNING))
      .toThrow('Invalid run status transition from "completed" to "running"')
    expect(() => assertValidTransition(RUN_STATUSES.PARTIAL_TIMEOUT, RUN_STATUSES.RUNNING))
      .toThrow('Invalid run status transition from "partial_timeout" to "running"')
    expect(() => assertValidTransition('mystery', RUN_STATUSES.RUNNING))
      .toThrow('Unknown run status: mystery')
  })
})
