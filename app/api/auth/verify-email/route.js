import prisma from '@/lib/prisma'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return Response.json({ error: 'Invalid or expired verification link.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { verificationToken: token },
    select: {
      id: true,
      email: true,
      verificationTokenExpiresAt: true,
    },
  })

  if (!user) {
    return Response.json({ error: 'Invalid or expired verification link.' }, { status: 400 })
  }

  if (!user.verificationTokenExpiresAt || user.verificationTokenExpiresAt < new Date()) {
    return Response.json({
      error: 'This verification link has expired. Please request a new one.',
      code: 'EXPIRED',
    }, { status: 400 })
  }

  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      verificationToken: null,
      verificationTokenExpiresAt: null,
    },
    select: {
      email: true,
    },
  })

  return Response.json({ success: true, email: verifiedUser.email })
}
