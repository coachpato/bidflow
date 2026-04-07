import prisma from './prisma'

/**
 * Log an action to the activity log.
 * Call this whenever something important happens in the app.
 *
 * @param {string} action - Human-readable description, e.g. "Created tender: ABC Tender"
 * @param {object} options - { userId, tenderId, contractId, appealId }
 */
export async function logActivity(action, options = {}) {
  try {
    await prisma.activityLog.create({
      data: {
        action,
        userId: options.userId || null,
        tenderId: options.tenderId || null,
        contractId: options.contractId || null,
        appealId: options.appealId || null,
      },
    })
  } catch (err) {
    // Never let logging errors break the main flow
    console.error('Activity log error:', err)
  }
}
