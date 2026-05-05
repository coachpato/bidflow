import { randomBytes } from 'node:crypto'
import prisma from '@/lib/prisma'
import { getAppUrl, sendEmail } from '@/lib/email'
import { getSessionOrganizationId } from '@/lib/organization'
import { getSession } from '@/lib/session'

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeName(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeRole(value) {
  return value === 'manager' ? 'manager' : 'member'
}

function buildInviteUrl(token) {
  const appUrl = getAppUrl()
  return appUrl ? `${appUrl}/login?invite=${token}` : null
}

function renderInviteEmail({ inviterName, organizationName, inviteUrl, recipientName }) {
  const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,'

  return `
    <div style="margin:0;background:#f4efe6;padding:32px 0;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6dfd0;border-radius:24px;overflow:hidden;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f766e 0%,#155e75 100%);color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;opacity:0.9;">Bid360</div>
          <h1 style="margin:14px 0 0;font-size:28px;line-height:1.2;">You’ve been invited to a Bid360 workspace</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;">${greeting}</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.7;"><strong>${inviterName}</strong> invited you to join <strong>${organizationName}</strong> in Bid360.</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;">Use Google Sign-In to accept the invite and open the shared pursuit workspace.</p>
          ${inviteUrl ? `
            <a href="${inviteUrl}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;">
              Open Bid360
            </a>
          ` : ''}
          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#64748b;">If you already have a Bid360 account with this email, signing in will attach you to the invited firm automatically.</p>
        </div>
      </div>
    </div>
  `
}

export async function GET() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organisation context is missing.' }, { status: 400 })

  const invites = await prisma.teamInvite.findMany({
    where: { organizationId },
    orderBy: [{ status: 'asc' }, { invitedAt: 'desc' }],
  })

  return Response.json(invites)
}

export async function POST(request) {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })

  const organizationId = getSessionOrganizationId(session)
  if (!organizationId) return Response.json({ error: 'Organisation context is missing.' }, { status: 400 })

  const body = await request.json()
  const email = normalizeEmail(body.email)
  const name = normalizeName(body.name)
  const role = normalizeRole(body.role)

  if (!email) {
    return Response.json({ error: 'Invite email is required.' }, { status: 400 })
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  })

  const existingMembership = await prisma.membership.findFirst({
    where: {
      organizationId,
      user: {
        email,
      },
    },
  })

  if (existingMembership) {
    return Response.json({ error: 'That person is already part of this workspace.' }, { status: 409 })
  }

  const token = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14)

  const existingInvite = await prisma.teamInvite.findFirst({
    where: {
      organizationId,
      email,
      status: 'pending',
    },
  })

  const invite = existingInvite
    ? await prisma.teamInvite.update({
        where: { id: existingInvite.id },
        data: {
          name: name || null,
          role,
          token,
          expiresAt,
          invitedByUserId: session.userId,
        },
      })
    : await prisma.teamInvite.create({
        data: {
          email,
          name: name || null,
          role,
          token,
          expiresAt,
          invitedByUserId: session.userId,
          organizationId,
        },
      })

  const inviteUrl = buildInviteUrl(invite.token)

  if (inviteUrl && organization) {
    try {
      // Business event: a workspace invite was created or refreshed successfully.
      await sendEmail({
        to: email,
        subject: `Bid360 invitation for ${organization.name}`,
        html: renderInviteEmail({
          inviterName: session.name || session.email || 'A Bid360 admin',
          organizationName: organization.name,
          inviteUrl,
          recipientName: name,
        }),
        text: [
          `You’ve been invited to join ${organization.name} in Bid360.`,
          '',
          `${session.name || session.email || 'A Bid360 admin'} invited you to use Google Sign-In and join the shared workspace.`,
          inviteUrl ? `Open: ${inviteUrl}` : null,
        ].filter(Boolean).join('\n'),
      })
    } catch (error) {
      console.error('Team invite email failed:', error)
    }
  }

  return Response.json(invite, { status: 201 })
}
