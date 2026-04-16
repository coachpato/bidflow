import prisma from '@/lib/prisma'

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export async function GET(request) {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const now = new Date()
    const results = {}

    // Test each query individually
    try {
      results.activeTenders = await prisma.tender.count({ where: { status: { in: ['New', 'Under Review', 'In Progress'] } } })
    } catch (e) {
      results.activeTendersError = e.message
    }

    try {
      results.submittedTenders = await prisma.tender.count({ where: { status: 'Submitted' } })
    } catch (e) {
      results.submittedTendersError = e.message
    }

    try {
      results.awardedTenders = await prisma.tender.count({ where: { status: 'Awarded' } })
    } catch (e) {
      results.awardedTendersError = e.message
    }

    try {
      results.lostTenders = await prisma.tender.count({ where: { status: 'Lost' } })
    } catch (e) {
      results.lostTendersError = e.message
    }

    try {
      results.pendingAppeals = await prisma.appeal.count({ where: { status: 'Pending' } })
    } catch (e) {
      results.pendingAppealsError = e.message
    }

    try {
      results.expiringContracts = await prisma.contract.findMany({
        where: {
          endDate: {
            gte: now,
            lte: addDays(now, 30),
          },
        },
        select: { id: true, title: true, client: true, endDate: true },
        take: 5,
      })
    } catch (e) {
      results.expiringContractsError = e.message
    }

    try {
      results.upcomingDeadlines = await prisma.tender.findMany({
        where: {
          deadline: {
            gte: now,
            lte: addDays(now, 14),
          },
          status: { notIn: ['Submitted', 'Awarded', 'Lost', 'Cancelled'] },
        },
        select: { id: true, title: true, entity: true, deadline: true, status: true },
        take: 5,
      })
    } catch (e) {
      results.upcomingDeadlinesError = e.message
    }

    try {
      results.recentActivity = await prisma.activityLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { name: true } } },
      })
    } catch (e) {
      results.recentActivityError = e.message
    }

    try {
      results.unreadNotifications = await prisma.notification.count({ where: { read: false } })
    } catch (e) {
      results.unreadNotificationsError = e.message
    }

    return Response.json(results)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
