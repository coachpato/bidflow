'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SETTINGS_ITEMS = [
  {
    label: 'Firm Profile',
    href: '/settings',
  },
  {
    label: 'Account',
    href: '/settings/account',
  },
  {
    label: 'Notifications',
    disabled: true,
  },
  {
    label: 'Team & Invites',
    disabled: true,
  },
  {
    label: 'Billing & Plan',
    disabled: true,
  },
]

function isActiveItem(pathname, href) {
  if (!href) return false
  return pathname === href
}

function SettingsNavItem({ item, active }) {
  const baseClass = 'flex min-w-[190px] items-center justify-between gap-3 rounded-[18px] border px-4 py-3 text-left text-sm font-semibold transition lg:min-w-0'
  const activeClass = 'border-[var(--brand-500)] bg-[rgba(14,110,129,0.08)] text-[var(--foreground)] shadow-sm'
  const inactiveClass = 'border-transparent text-slate-600 hover:border-[var(--line)] hover:bg-[var(--background-muted)] hover:text-[var(--foreground)]'
  const disabledClass = 'cursor-not-allowed border-transparent bg-transparent text-slate-500'

  if (item.disabled) {
    return (
      <button type="button" disabled className={`${baseClass} ${disabledClass}`}>
        <span>{item.label}</span>
        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Coming soon
        </span>
      </button>
    )
  }

  return (
    <Link href={item.href} className={`${baseClass} ${active ? activeClass : inactiveClass}`}>
      <span>{item.label}</span>
    </Link>
  )
}

export default function SettingsLayout({ children }) {
  const pathname = usePathname()

  return (
    <div className="app-page py-5 sm:py-6">
      <div className="grid min-w-0 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <aside className="app-surface min-w-0 rounded-[24px] p-3 lg:sticky lg:top-24">
          <div className="border-b border-slate-100 px-2 pb-3">
            <p className="app-kicker">Settings</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Workspace and personal preferences.
            </p>
          </div>

          <nav aria-label="Settings" className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SETTINGS_ITEMS.map(item => (
              <SettingsNavItem
                key={item.label}
                item={item}
                active={isActiveItem(pathname, item.href)}
              />
            ))}
          </nav>
        </aside>

        <main className="min-w-0 [&_.app-page]:px-0">
          {children}
        </main>
      </div>
    </div>
  )
}
