function normalizeBaseUrl(url) {
  return url ? url.replace(/\/+$/, '') : null
}

export function getEmailSender() {
  return process.env.EMAIL_FROM || 'BidFlow <onboarding@resend.dev>'
}

export function getAppUrl() {
  return normalizeBaseUrl(
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  )
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}

export async function sendEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('Email skipped because RESEND_API_KEY is not configured.')
    return { skipped: true }
  }

  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data, error } = await resend.emails.send({
    from: getEmailSender(),
    to,
    subject,
    html,
    text,
  })

  if (error) {
    throw new Error(error.message || 'Failed to send email.')
  }

  return { data }
}
