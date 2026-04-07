import { requireAuth } from '@/lib/session'
import prisma from '@/lib/prisma'
import Header from '@/app/components/Header'
import Link from 'next/link'

export default async function ActivityPage() {
  await requireAuth()

  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { name: true } },
      tender: { select: { title: true, id: true } },
      contract: { select: { title: true, id: true } },
      appeal: { select: { reason: true, id: true } },
    },
  })

  return (
    <div>
      <Header title="Activity Log" />
      <div className="p-6">
        <p className="text-slate-500 text-sm mb-6">Last {logs.length} recorded actions</p>

        {logs.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 text-center py-12">
            <p className="text-slate-400">No activity recorded yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-4 px-5 py-4">
                {/* Timeline dot */}
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#185FA5' }} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800">{log.action}</p>

                  {/* Links to related records */}
                  <div className="flex flex-wrap gap-3 mt-1">
                    {log.tender && (
                      <Link href={`/tenders/${log.tender.id}`} className="text-xs text-[#185FA5] hover:underline">
                        Tender: {log.tender.title}
                      </Link>
                    )}
                    {log.contract && (
                      <Link href={`/contracts/${log.contract.id}`} className="text-xs text-[#185FA5] hover:underline">
                        Contract: {log.contract.title}
                      </Link>
                    )}
                    {log.appeal && (
                      <Link href={`/appeals/${log.appeal.id}`} className="text-xs text-[#185FA5] hover:underline">
                        Appeal logged
                      </Link>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0 text-xs text-slate-400">
                  {log.user && <p className="font-medium text-slate-600 mb-0.5">{log.user.name}</p>}
                  <p>
                    {new Date(log.createdAt).toLocaleDateString('en-ZA', {
                      day: 'numeric', month: 'short',
                    })}
                  </p>
                  <p>
                    {new Date(log.createdAt).toLocaleTimeString('en-ZA', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
