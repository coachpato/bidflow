import { randomBytes } from 'node:crypto'
import { getAppUrl, sendEmail } from '@/lib/email'

export const EMAIL_VERIFICATION_TTL_MS = 1000 * 60 * 60 * 24
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_MS = 1000 * 60

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function createVerificationToken() {
  return randomBytes(32).toString('hex')
}

export function createVerificationExpiry() {
  return new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS)
}

export function wasVerificationTokenIssuedRecently(expiresAt) {
  if (!expiresAt) return false

  const expiresAtTime = new Date(expiresAt).getTime()
  if (!Number.isFinite(expiresAtTime)) return false

  const issuedAtTime = expiresAtTime - EMAIL_VERIFICATION_TTL_MS
  return Date.now() - issuedAtTime < EMAIL_VERIFICATION_RESEND_COOLDOWN_MS
}

export function buildVerificationUrl(token) {
  return `${getAppUrl()}/verify-email?token=${encodeURIComponent(token)}`
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderVerificationEmail({ name, email, verificationUrl }) {
  const safeName = escapeHtml(name)
  const safeEmail = escapeHtml(email)
  const safeVerificationUrl = escapeHtml(verificationUrl)
  const greeting = safeName ? `Hello ${safeName},` : 'Hello,'
  const emailLabel = safeEmail ? `<strong>${safeEmail}</strong>` : 'this email address'

  return `
    <div style="margin:0;background:#f4efe6;padding:32px 0;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6dfd0;border-radius:24px;overflow:hidden;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f766e 0%,#155e75 100%);color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;opacity:0.9;">Bid360</div>
          <h1 style="margin:14px 0 0;font-size:28px;line-height:1.2;">Verify your Bid360 email</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">${greeting}</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Please confirm ${emailLabel} to activate your Bid360 account and open your workspace.</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">This verification link expires in 24 hours.</p>
          <a href="${safeVerificationUrl}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;">
            Verify email
          </a>
          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#64748b;">If the button does not work, copy and paste this link into your browser:</p>
          <p style="margin:8px 0 0;font-size:13px;line-height:1.7;color:#155e75;word-break:break-all;">${safeVerificationUrl}</p>
        </div>
      </div>
    </div>
  `
}

export function renderVerificationEmailText({ name, verificationUrl }) {
  return [
    name ? `Hello ${name},` : 'Hello,',
    '',
    'Please confirm this email address to activate your Bid360 account and open your workspace.',
    '',
    `Verify your email: ${verificationUrl}`,
    '',
    'This verification link expires in 24 hours.',
  ].join('\n')
}

export async function sendVerificationEmail({ email, name, token }) {
  const verificationUrl = buildVerificationUrl(token)

  return sendEmail({
    to: email,
    subject: 'Verify your Bid360 email',
    html: renderVerificationEmail({ name, email, verificationUrl }),
    text: renderVerificationEmailText({ name, verificationUrl }),
  })
}
