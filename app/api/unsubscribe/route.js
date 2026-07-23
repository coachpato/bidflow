import prisma from '@/lib/prisma'

export async function GET(request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')?.trim()

  if (!token) {
    return Response.json({ error: 'Unsubscribe token is required.' }, { status: 400 })
  }

  try {
    const subscriber = await prisma.subscriber.findUnique({
      where: { unsubscribeToken: token },
      select: { id: true },
    })

    if (!subscriber) {
      return Response.json({ error: 'Subscription not found.' }, { status: 404 })
    }

    await prisma.subscriber.update({
      where: { unsubscribeToken: token },
      data: { subscribed: false },
      select: { id: true },
    })

    return Response.redirect(new URL('/manage?unsubscribed=1', request.url), 302)
  } catch (error) {
    console.error('Unsubscribe failed:', error)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
