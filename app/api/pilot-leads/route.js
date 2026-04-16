import prisma from '@/lib/prisma'
import { getSession } from '@/lib/session'

function normalizeValue(value) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export async function GET() {
  const session = await getSession()
  if (!session.userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 })

  const leads = await prisma.pilotLead.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return Response.json(leads)
}

export async function POST(request) {
  try {
    const body = await request.json()
    const name = normalizeValue(body.name)
    const email = normalizeValue(body.email)?.toLowerCase()
    const company = normalizeValue(body.company)
    const role = normalizeValue(body.role)
    const teamSize = normalizeValue(body.teamSize)
    const whoWouldUseIt = normalizeValue(body.whoWouldUseIt)
    const pricingPreference = normalizeValue(body.pricingPreference)
    const monthlyBudget = normalizeValue(body.monthlyBudget)
    const lifetimeBudget = normalizeValue(body.lifetimeBudget)
    const painPoint = normalizeValue(body.painPoint)

    if (!name || !email || !whoWouldUseIt) {
      return Response.json(
        { error: 'Name, email, and who would use BidFlow are required.' },
        { status: 400 }
      )
    }

    const existingLead = await prisma.pilotLead.findUnique({
      where: { email },
    })

    if (existingLead) {
      return Response.json(
        { error: 'This email is already on the pilot list.' },
        { status: 400 }
      )
    }

    const lead = await prisma.pilotLead.create({
      data: {
        name,
        email,
        company,
        role,
        teamSize,
        whoWouldUseIt,
        pricingPreference,
        monthlyBudget,
        lifetimeBudget,
        painPoint,
      },
    })

    const leadMessage = [
      `New pilot request from ${name}`,
      company ? `at ${company}` : null,
      pricingPreference ? `(${pricingPreference})` : null,
    ].filter(Boolean).join(' ')

    await prisma.notification.create({
      data: {
        message: leadMessage,
        type: 'info',
        userId: null,
      },
    })

    return Response.json({ success: true, leadId: lead.id }, { status: 201 })
  } catch (error) {
    console.error('Pilot lead error:', error)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
