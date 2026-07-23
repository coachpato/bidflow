import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { getSectorLabel } from '@/lib/sectors'
import { validateSubscriberInput } from '@/lib/subscriber-validation'

const SUBSCRIBER_SELECT = {
  id: true,
  email: true,
  entityName: true,
  sector: true,
  keywords: true,
  location: true,
  subscribed: true,
  createdAt: true,
  updatedAt: true,
}

function validationResponse(errors) {
  return Response.json(
    { error: 'Please fix the highlighted fields.', errors },
    { status: 400 }
  )
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getAdminEmail() {
  return typeof process.env.ADMIN_EMAIL === 'string'
    ? process.env.ADMIN_EMAIL.trim()
    : ''
}

async function getActiveSubscriberEmailCount(db = prisma) {
  const subscribers = await db.subscriber.findMany({
    where: { subscribed: true },
    distinct: ['email'],
    select: { email: true },
  })

  return subscribers.length
}

function renderAdminNotificationEmail({ subscriber, sectorLabel, timestamp, totalSubscriberCount }) {
  const details = [
    ['Entity name', subscriber.entityName],
    ['Sector', sectorLabel],
    ['Email', subscriber.email],
    subscriber.keywords ? ['Keywords', subscriber.keywords] : null,
    subscriber.location ? ['Location', subscriber.location] : null,
    ['Timestamp', timestamp],
    ['Active unique subscriber emails', totalSubscriberCount],
  ].filter(Boolean)

  const rows = details.map(([label, value]) => `
    <tr>
      <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #e6dfd0;color:#475569;width:190px;">${escapeHtml(label)}</th>
      <td style="padding:10px 12px;border-bottom:1px solid #e6dfd0;color:#0f172a;">${escapeHtml(value)}</td>
    </tr>
  `).join('')

  const html = `
    <div style="margin:0;background:#f7f5ef;padding:32px 0;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e6dfd0;border-radius:8px;overflow:hidden;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="padding:24px 28px;background:#18314a;color:#ffffff;">
          <div style="font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;opacity:0.85;">Bid360 subscriber</div>
          <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">New sector subscription</h1>
        </div>
        <div style="padding:28px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.5;">
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  `

  const text = details
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n')

  return { html, text }
}

async function sendNewSubscriberAdminNotification(subscriber, db = prisma) {
  const adminEmail = getAdminEmail()
  if (!adminEmail) {
    console.warn('New subscriber admin notification skipped because ADMIN_EMAIL is not configured.')
    return { skipped: true }
  }

  const sectorLabel = getSectorLabel(subscriber.sector)
  const timestamp = new Date().toISOString()
  const totalSubscriberCount = await getActiveSubscriberEmailCount(db)
  const { html, text } = renderAdminNotificationEmail({
    subscriber,
    sectorLabel,
    timestamp,
    totalSubscriberCount,
  })

  return sendEmail({
    to: adminEmail,
    subject: `New bid360 subscriber: ${subscriber.entityName} \u2014 ${sectorLabel}`,
    html,
    text,
  })
}

export async function POST(request) {
  let body

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const { values, errors, valid } = validateSubscriberInput(body)

  if (!valid) {
    return validationResponse(errors)
  }

  try {
    const where = {
      email_sector: {
        email: values.email,
        sector: values.sector,
      },
    }

    const existingSubscriber = await prisma.subscriber.findUnique({
      where,
      select: { id: true },
    })

    if (existingSubscriber) {
      const subscriber = await prisma.subscriber.update({
        where,
        data: {
          entityName: values.entityName,
          keywords: values.keywords,
          location: values.location,
          subscribed: true,
        },
        select: SUBSCRIBER_SELECT,
      })

      return Response.json({
        success: true,
        updated: true,
        subscriber,
      })
    }

    const subscriber = await prisma.subscriber.create({
      data: {
        email: values.email,
        entityName: values.entityName,
        sector: values.sector,
        keywords: values.keywords,
        location: values.location,
        subscribed: true,
      },
      select: SUBSCRIBER_SELECT,
    })

    try {
      await sendNewSubscriberAdminNotification(subscriber)
    } catch (error) {
      console.error('New subscriber admin notification failed:', error)
    }

    return Response.json({
      success: true,
      updated: false,
      subscriber,
    }, { status: 201 })
  } catch (error) {
    console.error('Subscriber registration failed:', error)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
