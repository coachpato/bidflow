'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import AppLogo from './AppLogo'
import LogoutButton from './LogoutButton'
import ThemeToggle from './ThemeToggle'
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
    <header className="sticky top-0 z-40 border-b border-var(--line) bg-var(--surface) backdrop-blur-md">
      <div className="app-page py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <AppLogo tone="dark" caption="" />

          <nav className="hidden items-center gap-2 lg:flex">
            {NAV_ITEMS.map(item => {
              const routeMatches = [item.href, ...(item.aliases || [])]
              const isActive = routeMatches.some(route => pathname === route || pathname.startsWith(`${route}/`))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'border-transparent bg-var(--brand-600) text-white'
                      : 'border-var(--line) bg-var(--background-muted) text-var(--foreground) hover:border-var(--brand-500)'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isActive ? 'white' : item.accent }} />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/inbox"
              className={`relative inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                isInboxActive
                  ? 'border-transparent bg-var(--brand-600) text-white'
                  : 'border-var(--line) bg-var(--background-muted) text-var(--foreground) hover:bg-var(--line)'
              }`}
            >
              Inbox
              {unreadCount > 0 && (
                <span className={`ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  isInboxActive ? 'bg-white/20 text-white' : 'bg-var(--brand-600) text-white'
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
            const routeMatches = [item.href, ...(item.aliases || [])]
            const isActive = routeMatches.some(route => pathname === route || pathname.startsWith(`${route}/`))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex min-w-fit items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'border-transparent bg-var(--brand-600) text-white'
                    : 'border-var(--line) bg-var(--background-muted) text-var(--foreground)'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isActive ? 'white' : item.accent }} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
