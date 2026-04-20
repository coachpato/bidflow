/**
 * Unified notification service
 * Consolidates notification logic from challenge, contract, and tender notifications
 * Provides a single interface for creating, sending, and tracking notifications
 */

import prisma from './prisma'
import { sendEmail } from './email'
import { escapeHtml, formatDate, getDaysRemainingLabel } from './validation'
import { logError, createScopedLogger } from './logger'

const log = createScopedLogger('notification-service')

/**
 * Notification service for creating and sending notifications
 */
export class NotificationService {
  /**
   * Create a notification for one or more users
   * Handles both in-app notifications and email sending
   *
   * @param {object} context - Notification context
   * @param {string} context.type - Notification type ('CHALLENGE', 'CONTRACT', 'TENDER', 'COMPLIANCE')
   * @param {string} context.action - Action type ('CREATED', 'UPDATED', 'DEADLINE', 'EXPIRES')
   * @param {object} context.entity - Entity object (Challenge, Contract, Tender, etc.)
   * @param {object} context.recipients - Recipients info
   * @param {number[]} context.recipients.userIds - User IDs to notify
   * @param {string[]} context.recipients.emails - Email addresses to notify
   * @param {object} context.actionLink - Optional action link
   * @param {string} context.actionLink.url - Link URL
   * @param {string} context.actionLink.label - Link label text
   * @param {number} context.organizationId - Organization ID (optional, for org-level notifications)
   * @param {object} context.variables - Template variables for email
   * @returns {Promise<object>} - Result with notified users/emails count
   */
  static async createNotification(context) {
    const {
      type,
      action,
      entity,
      recipients = { userIds: [], emails: [] },
      actionLink,
      organizationId,
      variables = {},
    } = context

    try {
      log.info('Creating notification', { type, action, entityId: entity.id })

      // Generate notification message and email subject
      const { message, subject, emailTemplate } = this.generateNotificationContent(type, action, entity, variables)

      // Create in-app notifications
      const notificationResult = await this.createInAppNotifications(
        recipients.userIds,
        {
          message,
          type: this.getNotificationType(type, action),
          linkUrl: actionLink?.url,
          linkLabel: actionLink?.label,
          organizationId,
        }
      )

      // Send emails
      let emailResult = { sent: 0, failed: 0 }
      if (recipients.emails.length > 0 && emailTemplate) {
        emailResult = await this.sendEmailNotifications(recipients.emails, {
          subject,
          template: emailTemplate,
          variables,
          actionLink,
        })
      }

      log.info('Notification created successfully', {
        type,
        action,
        inApp: notificationResult.created,
        emails: emailResult.sent,
      })

      return {
        success: true,
        notifiedUsers: notificationResult.created,
        emailedRecipients: emailResult.sent,
      }
    } catch (error) {
      logError('Failed to create notification', error, { type, action })
      return {
        success: false,
        notifiedUsers: 0,
        emailedRecipients: 0,
      }
    }
  }

  /**
   * Create in-app notifications for users
   * @private
   */
  static async createInAppNotifications(userIds, notificationData) {
    if (userIds.length === 0) return { created: 0 }

    try {
      // Create individual notifications for each user
      // Also create org-level notification if organizationId provided
      const notifications = userIds.map(userId => ({
        ...notificationData,
        userId,
      }))

      const result = await prisma.notification.createMany({
        data: notifications,
      })

      return { created: result.count }
    } catch (error) {
      logError('Failed to create in-app notifications', error)
      return { created: 0 }
    }
  }

  /**
   * Send email notifications to recipients
   * @private
   */
  static async sendEmailNotifications(emails, options) {
    const { subject, template, variables, actionLink } = options

    const results = { sent: 0, failed: 0 }

    for (const email of emails) {
      try {
        const html = this.renderEmailTemplate(template, variables, actionLink)

        const sent = await sendEmail({
          to: email,
          subject,
          html,
        })

        if (sent) {
          results.sent++
        } else {
          results.failed++
        }
      } catch (error) {
        logError(`Failed to send email to ${email}`, error)
        results.failed++
      }
    }

    return results
  }

  /**
   * Generate notification message and email template
   * @private
   */
  static generateNotificationContent(type, action, entity, variables) {
    const typeActions = {
      CHALLENGE: {
        CREATED: {
          message: `New challenge: "${escapeHtml(entity.reason)}" created for ${escapeHtml(entity.reason)}`,
          subject: `New Administrative Appeal: ${escapeHtml(entity.reason)}`,
        },
        DEADLINE: {
          message: `Challenge deadline approaching: ${getDaysRemainingLabel(entity.deadline)}`,
          subject: `Appeal Deadline ${getDaysRemainingLabel(entity.deadline)}`,
        },
        UPDATED: {
          message: `Challenge updated: "${escapeHtml(entity.reason)}"`,
          subject: `Appeal Updated`,
        },
      },
      CONTRACT: {
        CREATED: {
          message: `New appointment: "${escapeHtml(entity.title)}" assigned to you`,
          subject: `New Appointment: ${escapeHtml(entity.title)}`,
        },
        MILESTONE_ADDED: {
          message: `Milestone added to appointment "${escapeHtml(entity.title)}"`,
          subject: `Milestone Added: ${escapeHtml(entity.title)}`,
        },
        END_DATE_APPROACHING: {
          message: `Appointment "${escapeHtml(entity.title)}" ends ${getDaysRemainingLabel(entity.endDate)}`,
          subject: `Appointment Ending Soon: ${escapeHtml(entity.title)}`,
        },
        EXPIRES_SOON: {
          message: `Contract renewal date approaching: ${formatDate(entity.renewalDate)}`,
          subject: `Renewal Date Approaching: ${escapeHtml(entity.title)}`,
        },
      },
      TENDER: {
        CREATED: {
          message: `New pursuit: "${escapeHtml(entity.title)}"`,
          subject: `New Pursuit: ${escapeHtml(entity.title)}`,
        },
        DEADLINE: {
          message: `Pursuit deadline ${getDaysRemainingLabel(entity.deadline)}: ${escapeHtml(entity.title)}`,
          subject: `Deadline ${getDaysRemainingLabel(entity.deadline)}: ${escapeHtml(entity.title)}`,
        },
      },
      COMPLIANCE: {
        EXPIRES_SOON: {
          message: `Compliance document "${escapeHtml(entity.filename)}" expires ${getDaysRemainingLabel(entity.expiryDate)}`,
          subject: `Compliance Document Expiring Soon`,
        },
      },
    }

    const config = typeActions[type]?.[action] || {
      message: `Notification for ${type}`,
      subject: `Update on ${type}`,
    }

    return {
      message: config.message,
      subject: config.subject,
      emailTemplate: this.getEmailTemplate(type, action),
    }
  }

  /**
   * Get notification type badge for UI
   * @private
   */
  static getNotificationType(type, action) {
    if (action.includes('DEADLINE') || action.includes('EXPIRES')) return 'warning'
    if (action.includes('URGENT')) return 'critical'
    return 'info'
  }

  /**
   * Get email template for notification type
   * @private
   */
  static getEmailTemplate(type, action) {
    // Return a template name; actual template would be in email service
    return `${type.toLowerCase()}_${action.toLowerCase()}`
  }

  /**
   * Render email template with variables
   * @private
   */
  static renderEmailTemplate(templateName, variables, actionLink) {
  const { organizationName = 'Bid360', recipientName = 'Team Member', message = '' } = variables

    let actionButton = ''
    if (actionLink) {
      actionButton = `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="border-radius: 4px; background-color: #0d67b5; padding: 12px 24px;">
              <a href="${escapeHtml(actionLink.url)}" style="color: white; text-decoration: none; font-weight: bold;">
                ${escapeHtml(actionLink.label)}
              </a>
            </td>
          </tr>
        </table>
      `
    }

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #374151; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { margin-bottom: 32px; }
            .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${escapeHtml(organizationName)}</h2>
            </div>
            <p>Hello ${escapeHtml(recipientName)},</p>
            <p>${message}</p>
            ${actionButton}
            <div class="footer">
      <p>This is an automated message from Bid360. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `
  }

  /**
   * Batch mark notifications as read
   */
  static async markAsRead(notificationIds) {
    try {
      const result = await prisma.notification.updateMany({
        where: { id: { in: notificationIds } },
        data: { read: true },
      })
      return { updated: result.count }
    } catch (error) {
      logError('Failed to mark notifications as read', error)
      return { updated: 0 }
    }
  }

  /**
   * Delete old notifications
   */
  static async deleteOldNotifications(daysOld = 90) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    try {
      const result = await prisma.notification.deleteMany({
        where: {
          read: true,
          createdAt: { lt: cutoffDate },
        },
      })
      return { deleted: result.count }
    } catch (error) {
      logError('Failed to delete old notifications', error)
      return { deleted: 0 }
    }
  }
}

export default NotificationService
