// ============================================================
//  ERROR LOGGER
//  Captures API failures, navigation errors, and unexpected
//  crashes. Stores last 50 errors in sessionStorage so you
//  can view them without needing external tools.
//  Access the error log at: /#/debug (owner PIN only)
// ============================================================

const MAX_LOGS = 50

function getLog() {
  try {
    return JSON.parse(sessionStorage.getItem('ge_errors') || '[]')
  } catch { return [] }
}

function saveLog(log) {
  try {
    sessionStorage.setItem('ge_errors', JSON.stringify(log.slice(-MAX_LOGS)))
  } catch {}
}

export const logger = {

  error(context, error, extra = {}) {
    const entry = {
      level:     'error',
      time:      new Date().toISOString(),
      context,
      message:   error?.message || String(error),
      stack:     error?.stack?.split('\n').slice(0,3).join(' | ') || '',
      ...extra,
    }
    const log = getLog()
    log.push(entry)
    saveLog(log)
    console.error(`[GE] ${context}:`, error, extra)
    return entry
  },

  warn(context, message, extra = {}) {
    const entry = {
      level: 'warn',
      time:  new Date().toISOString(),
      context,
      message: String(message),
      ...extra,
    }
    const log = getLog()
    log.push(entry)
    saveLog(log)
    console.warn(`[GE] ${context}:`, message, extra)
  },

  info(context, message, extra = {}) {
    const entry = {
      level: 'info',
      time:  new Date().toISOString(),
      context,
      message: String(message),
      ...extra,
    }
    const log = getLog()
    log.push(entry)
    saveLog(log)
    console.log(`[GE] ${context}:`, message, extra)
  },

  getAll() { return getLog().reverse() },

  clear() {
    sessionStorage.removeItem('ge_errors')
    console.log('[GE] Error log cleared')
  },

  // Wrap an async API call with automatic error logging
  async wrap(context, fn) {
    try {
      const result = await fn()
      logger.info(context, 'Success')
      return result
    } catch (err) {
      logger.error(context, err)
      throw err
    }
  }
}

// Catch unhandled promise rejections globally
window.addEventListener('unhandledrejection', (e) => {
  logger.error('UnhandledPromise', e.reason || 'Unknown rejection')
})

// Catch global JS errors
window.addEventListener('error', (e) => {
  logger.error('GlobalError', e.error || e.message, { file: e.filename, line: e.lineno })
})
