'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from './Sidebar'

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <div className="sticky top-0 z-30 border-b border-white/70 bg-[rgba(247,245,241,0.94)] backdrop-blur lg:hidden">
      <div className="app-page py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex min-w-fit items-center gap-2 rounded-[14px] border px-3 py-2 text-sm font-semibold ${
                  isActive
                    ? 'border-transparent bg-[var(--brand-600)] text-white shadow-sm'
                    : 'border-slate-200 bg-[rgba(255,252,247,0.94)] text-slate-600'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isActive ? '#f8fafc' : item.accent }} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
