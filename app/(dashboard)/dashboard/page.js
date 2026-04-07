import { requireAuth } from '@/lib/session'
import prisma from '@/lib/prisma'
import Link from 'next/link'
import Header from '@/app/components/Header'
import StatusBadge from '@/app/components/StatusBadge'

// How many days until deadline before we show a warning
const DEADLINE_WARNING_DAYS = 14
const CONTRACT_EXPIRY_WARNING_DAYS = 30

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export default async function DashboardPage() {
  await requireAuth()

  const now = new Date()

  // Fetch all stats in parallel for speed
  const [
    activeTenders,
    submittedTenders,
    awardedTenders,
    lostTenders,
    pendingAppeals,
    expiringContracts,
    upcomingDeadlines,
    recentActivity,
    unreadNotifications,
  ] = await Promise.all([
    prisma.tender.count({ where: { status: { in: ['New', 'Under Review', 'In Progress'] } } }),
    prisma.tender.count({ where: { status: 'Submitted' } }),
    prisma.tender.count({ where: { status: 'Awarded' } }),
    prisma.tender.count({ where: { status: 'Lost' } }),
    prisma.appeal.count({ where: { status: 'Pending' } }),
    prisma.contract.findMany({
      where: {
        endDate: {
          gte: now,
          lte: addDays(now, CONTRACT_EXPIRY_WARNING_DAYS),
        },
      },
      select: { id: true, title: true, client: true, endDate: true },
      orderBy: { endDate: 'asc' },
      take: 5,
    }),
    prisma.tender.findMany({
      where: {
        deadline: {
          gte: now,
          lte: addDays(now, DEADLINE_WARNING_DAYS),
        },
        status: { notIn: ['Submitted', 'Awarded', 'Lost', 'Cancelled'] },
      },
      select: { id: true, title: true, entity: true, deadline: true, status: true },
      orderBy: { deadline: 'asc' },
      take: 5,
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { name: true } } },
    }),
    prisma.notification.count({ where: { read: false } }),
  ])

  const stats = [
    { label: 'Active Tenders', value: activeTenders, color: '#185FA5', href: '/tenders?status=active' },
    { label: 'Submitted', value: submittedTenders, color: '#7c3aed', href: '/tenders?status=Submitted' },
    { label: 'Awarded', value: awardedTenders, color: '#059669', href: '/tenders?status=Awarded' },
    { label: 'Lost', value: lostTenders, color: '#dc2626', href: '/tenders?status=Lost' },
    { label: 'Pending Appeals', value: pendingAppeals, color: '#d97706', href: '/appeals' },
    { label: 'Contracts Expiring (30d)', value: expiringContracts.length, color: '#0891b2', href: '/contracts' },
  ]

  return (
    <div>
      <Header title="Dashboard" />
      <div className="p-6 space-y-6">

        {/* Unread notifications alert */}
        {unreadNotifications > 0 && (
          <Link href="/notifications">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3 hover:bg-yellow-100 transition-colors cursor-pointer">
              <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-yellow-800 text-sm font-medium">
                You have {unreadNotifications} unread notification{unreadNotifications > 1 ? 's' : ''}. Click to view.
              </p>
            </div>
          </Link>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map(s => (
            <Link key={s.label} href={s.href}>
              <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
                <p className="text-sm text-slate-500 font-medium">{s.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Upcoming deadlines */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Deadlines in the next 14 days</h3>
              <Link href="/tenders" className="text-sm text-[#185FA5] hover:underline">View all</Link>
            </div>
            {upcomingDeadlines.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 text-center">No upcoming deadlines</p>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map(t => (
                  <Link key={t.id} href={`/tenders/${t.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t.entity}</p>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-xs font-semibold text-red-600">
                          {new Date(t.deadline).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                        </p>
                        <StatusBadge status={t.status} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Contracts expiring soon */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Contracts expiring (30 days)</h3>
              <Link href="/contracts" className="text-sm text-[#185FA5] hover:underline">View all</Link>
            </div>
            {expiringContracts.length === 0 ? (
              <p className="text-slate-400 text-sm py-4 text-center">No contracts expiring soon</p>
            ) : (
              <div className="space-y-3">
                {expiringContracts.map(c => (
                  <Link key={c.id} href={`/contracts/${c.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{c.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{c.client}</p>
                      </div>
                      <p className="text-xs font-semibold text-orange-600 flex-shrink-0 ml-4">
                        Ends {new Date(c.endDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Recent Activity</h3>
            <Link href="/activity" className="text-sm text-[#185FA5] hover:underline">View all</Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">No activity yet</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map(log => (
                <div key={log.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#185FA5] mt-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-700">{log.action}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {log.user?.name && <span>{log.user.name} · </span>}
                      {new Date(log.createdAt).toLocaleDateString('en-ZA', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
