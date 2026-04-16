/**
 * Jest setup file
 * Runs before all tests
 */

// Mock environment variables for testing
process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/bidflow_test'
process.env.SESSION_SECRET = 'test-secret-key-do-not-use-in-production'

// Suppress console logs during tests (set process.env.JEST_DEBUG=1 to see logs)
if (process.env.JEST_DEBUG !== '1') {
  global.console = {
    ...console,
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Uncomment to suppress errors in tests:
    // error: jest.fn(),
  }
}

// Global test utilities
global.mockDate = (dateString) => {
  const mockDate = new Date(dateString)
  jest.useFakeTimers()
  jest.setSystemTime(mockDate)
  return mockDate
}

global.resetMockDate = () => {
  jest.useRealTimers()
}
