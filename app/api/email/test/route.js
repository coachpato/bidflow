import { NextResponse } from 'next/server'
import { getAppUrl, getEmailSender, isEmailConfigured, sendEmail } from '@/lib/email'
import { getSession } from '@/lib/session'

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value)
}

export async function POST() {
  const session = await getSession()

  if (!session.userId) {
    return NextResponse.json({ error: 'You must be signed in to send a test email.' }, { status: 401 })
  }

  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Only administrators can send test emails.' }, { status: 403 })
  }

  if (!session.email) {
    return NextResponse.json({ error: 'Your account does not have an email address yet.' }, { status: 400 })
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: 'Resend is not configured yet. Add RESEND_API_KEY before sending a test email.' },
      { status: 400 }
    )
  }

  const sentAt = new Date()
  const appUrl = getAppUrl()
  const sender = getEmailSender()
  const recipientName = session.name || session.email

  await sendEmail({
    to: session.email,
      subject: 'Bid360 test email',
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <p>Hello ${escapeHtml(recipientName)},</p>
        <p>This is a test email from Bid360.</p>
        <p><strong>Sent at:</strong> ${escapeHtml(formatDateTime(sentAt))}</p>
        <p><strong>Sender:</strong> ${escapeHtml(sender)}</p>
        <p>If this lands correctly, contract allocation and due-date reminders will use the same delivery setup.</p>
        ${appUrl ? `<p><a href="${appUrl}">Open Bid360</a></p>` : ''}
      </div>
    `,
    text: [
      `Hello ${recipientName},`,
      '',
      'This is a test email from Bid360.',
      `Sent at: ${formatDateTime(sentAt)}`,
      `Sender: ${sender}`,
      'If this lands correctly, contract allocation and due-date reminders will use the same delivery setup.',
      appUrl ? `Open Bid360: ${appUrl}` : null,
    ].filter(Boolean).join('\n'),
  })

  return NextResponse.json({
    ok: true,
    message: `Test email sent to ${session.email}.`,
  })
}
