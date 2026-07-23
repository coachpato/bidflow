import prisma from '@/lib/prisma'
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
