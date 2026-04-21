'use client'

import Link from 'next/link'

export default function EmptyState({
  icon = '📋',
  title,
  description,
  action,
  actionText,
  actionHref,
}) {
  return (
    <div className="app-page py-16 sm:py-24">
      <div className="flex flex-col items-center justify-center space-y-6 text-center">
        <div className="text-6xl sm:text-7xl">{icon}</div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-2xl sm:text-3xl font-bold text-var(--foreground)">
            {title}
          </h2>
          {description && (
            <p className="text-base text-var(--foreground-secondary)">
              {description}
            </p>
          )}
        </div>
        {actionText && actionHref && (
          <Link href={actionHref} className="app-button-primary app-button-lg mt-6">
            {actionText}
          </Link>
        )}
      </div>
    </div>
  )
}
