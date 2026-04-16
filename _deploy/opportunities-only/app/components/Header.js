'use client'

import Link from 'next/link'

export default function Header({
  title,
  eyebrow = 'Workspace',
  badge,
  meta = [],
  primaryAction,
  secondaryAction,
}) {
  return (
    <section className="app-page pt-5 sm:pt-6">
      <div className="app-surface rounded-[24px] p-5 sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="app-kicker">{eyebrow}</span>
              {badge && (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {badge}
                </span>
              )}
            </div>

            <h1 className="app-display text-[2.3rem] font-semibold leading-none text-slate-950 sm:text-[2.8rem]">
              {title}
            </h1>

            {meta.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {meta.map(item => (
                  <div key={item.label} className="rounded-[16px] border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                    <p className={`app-data mt-1 text-sm font-semibold ${item.tone || 'text-slate-900'}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {primaryAction && (
              <Link href={primaryAction.href} className="app-button-primary">
                {primaryAction.label}
              </Link>
            )}
            {secondaryAction && (
              <Link href={secondaryAction.href} className="app-button-secondary">
                {secondaryAction.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
