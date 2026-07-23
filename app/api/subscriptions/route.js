import prisma from '@/lib/prisma'
import {
  normalizeEmail,
  validateSubscriptionLookup,
  validateSubscriptionSectorInput,
} from '@/lib/subscriber-validation'

const SUBSCRIPTION_SELECT = {
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

async function readJsonBody(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function findSubscription(values) {
  return prisma.subscriber.findUnique({
    where: {
      email_sector: {
        email: values.email,
        sector: values.sector,
      },
    },
    select: { id: true },
  })
}

export async function GET(request) {
  const url = new URL(request.url)
  const { values, errors, valid } = validateSubscriptionLookup({
    email: normalizeEmail(url.searchParams.get('email')),
  })

  if (!valid) {
    return validationResponse(errors)
  }

  try {
    const subscriptions = await prisma.subscriber.findMany({
      where: { email: values.email },
      orderBy: [
        { subscribed: 'desc' },
        { createdAt: 'desc' },
      ],
      select: SUBSCRIPTION_SELECT,
    })

    return Response.json({ success: true, subscriptions })
  } catch (error) {
    console.error('Subscription lookup failed:', error)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

export async function PATCH(request) {
  const body = await readJsonBody(request)

  if (!body) {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const { values, errors, valid } = validateSubscriptionSectorInput(body)

  if (!valid) {
    return validationResponse(errors)
  }

  try {
    const existingSubscription = await findSubscription(values)

    if (!existingSubscription) {
      return Response.json({ error: 'Subscription not found.' }, { status: 404 })
    }

    const subscription = await prisma.subscriber.update({
      where: {
        email_sector: {
          email: values.email,
          sector: values.sector,
        },
      },
      data: {
        keywords: values.keywords,
        location: values.location,
      },
      select: SUBSCRIPTION_SELECT,
    })

    return Response.json({ success: true, subscription })
  } catch (error) {
    console.error('Subscription update failed:', error)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(request) {
  const body = await readJsonBody(request)

  if (!body) {
    return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const { values, errors, valid } = validateSubscriptionSectorInput(body)

  if (!valid) {
    return validationResponse(errors)
  }

  try {
    const existingSubscription = await findSubscription(values)

    if (!existingSubscription) {
      return Response.json({ error: 'Subscription not found.' }, { status: 404 })
    }

    const subscription = await prisma.subscriber.update({
      where: {
        email_sector: {
          email: values.email,
          sector: values.sector,
        },
      },
      data: { subscribed: false },
      select: SUBSCRIPTION_SELECT,
    })

    return Response.json({ success: true, subscription })
  } catch (error) {
    console.error('Subscription unsubscribe failed:', error)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
