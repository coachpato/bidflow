import { APP_URL } from '@/lib/config/app-url'

export function getEmailSender() {
  return process.env.EMAIL_FROM || 'Bid360 <onboarding@resend.dev>'
}

export function getAppUrl() {
  return APP_URL
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}

export function shouldDryRunEmail({ bypassDryRun = false } = {}) {
  if (bypassDryRun) return false

  return (
    process.env.DRY_RUN === 'true'
    || process.env.CRAWLER_DRY_RUN === 'true'
    || (process.env.NODE_ENV !== 'production' && process.env.EMAIL_DEV_DELIVER !== 'true')
  )
}

export async function sendEmail({ to, subject, html, text, bcc, bypassDryRun = false }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('Email skipped because RESEND_API_KEY is not configured.')
    return { skipped: true }
  }

  if (shouldDryRunEmail({ bypassDryRun })) {
    console.warn(`Email dry-run skipped delivery to ${Array.isArray(to) ? to.join(', ') : to}: ${subject}`)
    return { skipped: true, dryRun: true }
  }

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data, error } = await resend.emails.send({
    from: getEmailSender(),
    to,
    bcc,
    subject,
    html,
    text,
  })

  if (error) {
    console.error('Resend email delivery failed:', error)
    const deliveryError = new Error(error.message || 'Failed to send email.')
    deliveryError.provider = 'resend'
    deliveryError.statusCode = error.statusCode
    deliveryError.providerErrorName = error.name
    throw deliveryError
  }

  return { data }
}
