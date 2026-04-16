/**
 * Structured logging utility
 * Provides consistent logging format for development and production
 */

const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
}

/**
 * Format log entry
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} context - Additional context
 * @returns {object|string} - Formatted log entry
 */
function formatLog(level, message, context = {}) {
  const timestamp = new Date().toISOString()
  const isDevelopment = process.env.NODE_ENV !== 'production'

  const logEntry = {
    timestamp,
    level,
    message,
    ...context,
  }

  if (isDevelopment) {
    // Pretty-print in development
    const levelColor = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m', // red
    }
    const reset = '\x1b[0m'

    let contextStr = ''
    if (Object.keys(context).length > 0) {
      contextStr = ` ${JSON.stringify(context)}`
    }

    return `${levelColor[level]}[${level.toUpperCase()}]${reset} ${timestamp} ${message}${contextStr}`
  }

  // JSON format in production (easier for log aggregation)
  return JSON.stringify(logEntry)
}

/**
 * Log at debug level
 * @param {string} message - Log message
 * @param {object} context - Optional context
 */
export function logDebug(message, context = {}) {
  if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') {
    const formatted = formatLog(LOG_LEVELS.DEBUG, message, context)
    console.debug(formatted)
  }
}

/**
 * Log at info level
 * @param {string} message - Log message
 * @param {object} context - Optional context
 */
export function logInfo(message, context = {}) {
  const formatted = formatLog(LOG_LEVELS.INFO, message, context)
  console.log(formatted)
}

/**
 * Log at warn level
 * @param {string} message - Log message
 * @param {object} context - Optional context
 */
export function logWarn(message, context = {}) {
  const formatted = formatLog(LOG_LEVELS.WARN, message, context)
  console.warn(formatted)
}

/**
 * Log at error level
 * @param {string} message - Log message
 * @param {Error|string} error - Error object or message
 * @param {object} context - Optional context
 */
export function logError(message, error, context = {}) {
  const errorContext = {
    ...context,
  }

  if (error instanceof Error) {
    errorContext.errorName = error.name
    errorContext.errorMessage = error.message
    if (error.stack) {
      errorContext.stack = error.stack
    }
    if (error.code) {
      errorContext.code = error.code
    }
  } else if (typeof error === 'string') {
    errorContext.errorMessage = error
  }

  const formatted = formatLog(LOG_LEVELS.ERROR, message, errorContext)
  console.error(formatted)
}

/**
 * Create a scoped logger for a specific feature/module
 * @param {string} scope - Scope name (e.g., 'auth', 'notifications')
 * @returns {object} - Logger instance with scoped methods
 */
export function createScopedLogger(scope) {
  const defaultContext = { scope }

  return {
    debug: (message, context = {}) => logDebug(message, { ...defaultContext, ...context }),
    info: (message, context = {}) => logInfo(message, { ...defaultContext, ...context }),
    warn: (message, context = {}) => logWarn(message, { ...defaultContext, ...context }),
    error: (message, error, context = {}) => logError(message, error, { ...defaultContext, ...context }),
  }
}

/**
 * Create a request logger that captures request details
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {number} status - HTTP status code
 * @param {number} duration - Duration in milliseconds
 * @param {object} context - Additional context (userId, etc.)
 */
export function logRequest(method, path, status, duration, context = {}) {
  const level = status >= 500 ? LOG_LEVELS.ERROR : status >= 400 ? LOG_LEVELS.WARN : LOG_LEVELS.INFO
  const formatted = formatLog(level, `${method} ${path}`, {
    status,
    duration: `${duration}ms`,
    ...context,
  })

  if (level === LOG_LEVELS.ERROR) {
    console.error(formatted)
  } else if (level === LOG_LEVELS.WARN) {
    console.warn(formatted)
  } else {
    console.log(formatted)
  }
}

/**
 * Logger instance with all methods
 */
export const logger = {
  debug: logDebug,
  info: logInfo,
  warn: logWarn,
  error: logError,
  request: logRequest,
  scoped: createScopedLogger,
}

export default logger
