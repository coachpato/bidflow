const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/_deploy/'],
  modulePathIgnorePatterns: ['<rootDir>/_deploy/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'lib/**/*.js',
    'app/**/*.js',
    '!**/*.test.js',
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/_deploy/**',
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
}

module.exports = createJestConfig(customJestConfig)
