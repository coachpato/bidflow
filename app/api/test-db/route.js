import prisma from '@/lib/prisma'

export async function GET(request) {
  try {
    const tenderCount = await prisma.tender.count()
    return Response.json({
      success: true,
      tenderCount,
      message: 'Database connection working'
    })
  } catch (err) {
    return Response.json({
      error: err.message,
      code: err.code,
      fullError: err.toString()
    }, { status: 500 })
  }
}
