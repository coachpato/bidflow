const DISCOVERY_PERCENT = 0.4
const PROCESSING_PERCENT = 0.5
const FINALIZATION_PERCENT = 0.1

export class TimeBudget {
  constructor({
    deadlineMs,
    now = () => Date.now(),
    startedAtMs = now(),
  } = {}) {
    this.deadlineMs = deadlineMs
    this.now = now
    this.startedAtMs = startedAtMs
    this.phaseBudgets = {
      discovery: Math.floor(deadlineMs * DISCOVERY_PERCENT),
      processing: Math.floor(deadlineMs * PROCESSING_PERCENT),
      finalization: Math.floor(deadlineMs * FINALIZATION_PERCENT),
    }
    this.checkpoints = []
  }

  elapsed() {
    return Math.max(0, this.now() - this.startedAtMs)
  }

  remaining() {
    return Math.max(0, this.deadlineMs - this.elapsed())
  }

  hasBuffer(bufferMs) {
    return this.remaining() >= bufferMs
  }

  hasPhaseBudget(phase) {
    return this.remaining() >= (this.phaseBudgets[phase] || 0)
  }

  checkpoint(label) {
    const snapshot = {
      label,
      elapsedMs: this.elapsed(),
      remainingMs: this.remaining(),
    }
    this.checkpoints.push(snapshot)
    return snapshot
  }

  isExhausted() {
    return this.remaining() <= 0
  }
}
