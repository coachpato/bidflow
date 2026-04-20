'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import AppLogo from './AppLogo'

export const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    aliases: [],
    accent: '#a07b39',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Opportunities',
    href: '/opportunities',
    aliases: [],
    accent: '#1f7a6c',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 7h16M4 12h10m-10 5h16M18 9l2 2-2 2" />
      </svg>
    ),
  },
  {
    label: 'Pursuits',
    href: '/pursuits',
    aliases: ['/tenders'],
    accent: '#8d6d33',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Appointments',
    href: '/appointments',
    aliases: ['/contracts'],
    accent: '#37624e',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Challenges',
    href: '/challenges',
    aliases: ['/appeals'],
    accent: '#a56b1f',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="app-scroll-shadow hidden h-screen w-[19rem] shrink-0 flex-col justify-between overflow-y-auto border-r border-white/10 bg-[linear-gradient(180deg,#091522_0%,#0d1c2d_58%,#132336_100%)] lg:flex">
      <div>
        <div className="border-b border-white/8 px-6 py-7">
          <AppLogo caption="Tender discovery, pursuit tracking, and award follow-through" />
        </div>

        <nav className="space-y-2 px-4 py-6">
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Navigation
          </p>
          {NAV_ITEMS.map(item => {
            const routeMatches = [item.href, ...(item.aliases || [])]
            const isActive = routeMatches.some(route => pathname === route || pathname.startsWith(`${route}/`))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-[20px] border px-4 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? 'border-white/10 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                    : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-slate-100'
                }`}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-[18px] border border-white/10 bg-white/5"
                  style={isActive ? { backgroundColor: 'rgba(160, 123, 57, 0.16)' } : {}}
                >
                  {item.icon}
                </span>
                <span className="flex flex-1 items-center justify-between gap-3">
                  <span>{item.label}</span>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.accent }} />
                </span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="space-y-4 border-t border-white/8 px-5 py-5">
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Operator note
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Keep the loop disciplined: review opportunities, run pursuits, store final submissions, then manage awards or challenges.
          </p>
        </div>
        <p className="px-2 text-xs text-slate-500">Bid360 workspace</p>
      </div>
    </aside>
  )
}
