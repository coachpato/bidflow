import prisma from '@/lib/prisma'
import {
  createVerificationExpiry,
  createVerificationToken,
  normalizeEmail,
  sendVerificationEmail,
  wasVerificationTokenIssuedRecently,
} from '@/lib/email-verification'

export async function POST(request) {
  const body = await request.json().catch(() => ({}))
  const email = normalizeEmail(body.email)

  if (!email) {
    return Response.json({ success: true })
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      verificationTokenExpiresAt: true,
    },
  })

  if (!user || user.emailVerified) {
    return Response.json({ success: true })
  }

  if (wasVerificationTokenIssuedRecently(user.verificationTokenExpiresAt)) {
    return Response.json({ success: true })
  }

  const verificationToken = createVerificationToken()
  const verificationTokenExpiresAt = createVerificationExpiry()

  await prisma.user.update({
    where: { id: user.id },
    data: {
      verificationToken,
      verificationTokenExpiresAt,
    },
  })

  try {
    await sendVerificationEmail({
      email: user.email,
      name: user.name,
      token: verificationToken,
    })
  } catch (error) {
    console.error('Verification email resend failed:', error)
  }

  return Response.json({ success: true })
}
