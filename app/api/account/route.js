import prisma from '@/lib/prisma'
import { getAppUrl, sendEmail } from '@/lib/email'
import { getSession } from '@/lib/session'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sendAccountChangedEmail({ user, previousName }) {
  if (!user?.email || previousName === user.name) return

  const appUrl = getAppUrl()
  const html = `
    <div style="margin:0;background:#f7f5ef;padding:32px 0;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6dfd0;border-radius:24px;overflow:hidden;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="padding:28px 32px;background:#18314a;color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;opacity:0.85;">Account</div>
          <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;">Account settings changed</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Hello ${escapeHtml(user.name || user.email)},</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">Your Bid360 display name was updated.</p>
          <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.7;color:#334155;">
            <li><strong>Display name:</strong> ${escapeHtml(previousName)} to ${escapeHtml(user.name)}</li>
          </ul>
          ${appUrl ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(`${appUrl}/manage`)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#18314a;color:#ffffff;text-decoration:none;font-weight:700;">Manage subscription</a></p>` : ''}
          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#64748b;">If you did not make this change, reply to this email so we can help secure your account.</p>
        </div>
      </div>
    </div>
  `

  const text = [
    'Account settings changed',
    '',
    `Hello ${user.name || user.email},`,
    '',
    'Your Bid360 display name was updated.',
    `Display name: ${previousName} to ${user.name}`,
    '',
    appUrl ? `Manage subscription: ${appUrl}/manage` : null,
    'If you did not make this change, reply to this email so we can help secure your account.',
  ].filter(Boolean).join('\n')

  await sendEmail({
    to: user.email,
    subject: 'Bid360 account settings changed',
    html,
    text,
  })
}

export async function PATCH(request) {
  const session = await getSession()
  if (!session.userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!name) {
    return Response.json({ error: 'Display name is required.' }, { status: 400 })
  }

  if (name.length > 120) {
    return Response.json({ error: 'Display name must be under 120 characters.' }, { status: 400 })
  }

  const previousUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      name: true,
    },
  })

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { name },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  })

  session.name = user.name
  await session.save()

  try {
    await sendAccountChangedEmail({
      user,
      previousName: previousUser?.name || 'Not set',
    })
  } catch (error) {
    console.error('Account settings confirmation email failed:', error)
  }

  return Response.json(user)
}
