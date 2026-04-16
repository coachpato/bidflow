'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import AppLogo from './AppLogo'
import LogoutButton from './LogoutButton'
import { NAV_ITEMS } from './Sidebar'

export default function TopNav() {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)
  const isInboxActive = pathname === '/inbox' || pathname === '/notifications'

  useEffect(() => {
    let isMounted = true

    async function loadUnreadCount() {
      const response = await fetch('/api/notifications')
      if (!response.ok) return
      const notifications = await response.json()
      if (!isMounted || !Array.isArray(notifications)) return
      setUnreadCount(notifications.filter(item => !item.read).length)
    }

    loadUnreadCount().catch(() => {
      if (isMounted) setUnreadCount(0)
    })

    return () => {
      isMounted = false
    }
  }, [pathname])

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[rgba(247,245,241,0.96)] backdrop-blur">
      <div className="app-page py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <AppLogo tone="dark" caption="" />

          <nav className="hidden items-center gap-2 lg:flex">
            {NAV_ITEMS.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-[14px] border px-3 py-2 text-sm font-semibold ${
                    isActive
                      ? 'border-transparent bg-[var(--brand-600)] text-white'
                      : 'border-slate-200 bg-white/90 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isActive ? '#f8fafc' : item.accent }} />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/inbox"
              className={`relative inline-flex items-center justify-center gap-2 rounded-[14px] border px-4 py-2 text-sm font-semibold ${
                isInboxActive
                  ? 'border-transparent bg-[var(--brand-600)] text-white'
                  : 'border-slate-200 bg-white/90 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Inbox
              {unreadCount > 0 && (
                <span className={`ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  isInboxActive ? 'bg-white/20 text-white' : 'bg-[var(--brand-600)] text-white'
                }`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
            <LogoutButton />
          </div>
        </div>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex min-w-fit items-center gap-2 rounded-[14px] border px-3 py-2 text-sm font-semibold ${
                  isActive
                    ? 'border-transparent bg-[var(--brand-600)] text-white'
                    : 'border-slate-200 bg-white/90 text-slate-600'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isActive ? '#f8fafc' : item.accent }} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
