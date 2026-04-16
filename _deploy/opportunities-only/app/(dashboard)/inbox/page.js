'use client'

import { useEffect, useMemo, useState } from 'react'
import Header from '@/app/components/Header'

const TYPE_STYLES = {
  info: {
    badge: 'bg-slate-100 text-slate-700',
    line: 'bg-[var(--brand-500)]',
  },
  warning: {
    badge: 'bg-amber-50 text-amber-700',
    line: 'bg-amber-600',
  },
  danger: {
    badge: 'bg-red-50 text-red-700',
    line: 'bg-red-600',
  },
}

function formatDateTime(value) {
  return new Date(value).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function InboxPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function fetchNotifications() {
      const response = await fetch('/api/notifications')
      const data = await response.json()

      if (!isMounted) return

      setNotifications(Array.isArray(data) ? data : [])
      setLoading(false)
    }

    fetchNotifications().catch(() => {
      if (!isMounted) return
      setNotifications([])
      setLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [])

  const summary = useMemo(() => {
    const unread = notifications.filter(notification => !notification.read).length

    return {
      total: notifications.length,
      unread,
      archived: notifications.length - unread,
    }
  }, [notifications])

  async function markRead(id) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications(current =>
      current.map(notification => (
        notification.id === id
          ? { ...notification, read: true }
          : notification
      ))
    )
  }

  async function markAllRead() {
    const unread = notifications.filter(notification => !notification.read)
    await Promise.all(unread.map(notification => fetch(`/api/notifications/${notification.id}`, { method: 'PATCH' })))
    setNotifications(current => current.map(notification => ({ ...notification, read: true })))
  }

  async function removeNotification(id) {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    setNotifications(current => current.filter(notification => notification.id !== id))
  }

  return (
    <div className="space-y-6">
      <Header
        title="Inbox"
        eyebrow="Alerts"
        meta={[
          { label: 'In view', value: `${summary.total}` },
          { label: 'Unread', value: `${summary.unread}` },
          { label: 'Read', value: `${summary.archived}` },
        ]}
      />

      <div className="app-page space-y-6">
        <div className="flex justify-end">
          {summary.unread > 0 ? (
            <button onClick={markAllRead} className="app-button-secondary">
              Mark all read
            </button>
          ) : null}
        </div>

        {loading ? (
          <section className="app-surface rounded-[24px] px-6 py-16 text-center text-slate-500">
            Loading inbox...
          </section>
        ) : notifications.length === 0 ? (
          <section className="app-surface rounded-[24px] px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800">Inbox is clear.</p>
          </section>
        ) : (
          <section className="space-y-3">
            {notifications.map(notification => {
              const style = TYPE_STYLES[notification.type] || TYPE_STYLES.info

              return (
                <div
                  key={notification.id}
                  className={`app-surface flex gap-4 rounded-[24px] p-5 ${notification.read ? 'opacity-70' : ''}`}
                >
                  <div className={`mt-1 h-10 w-1 rounded-full ${style.line}`} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${style.badge}`}>
                        {notification.type || 'info'}
                      </span>
                      {!notification.read ? (
                        <span className="rounded-full bg-[var(--brand-600)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                          Unread
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-3 text-sm font-medium leading-6 text-slate-800">{notification.message}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDateTime(notification.createdAt)}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {!notification.read ? (
                      <button onClick={() => markRead(notification.id)} className="app-button-ghost px-0 py-0 text-xs font-semibold">
                        Mark read
                      </button>
                    ) : null}
                    <button onClick={() => removeNotification(notification.id)} className="app-button-ghost px-0 py-0 text-xs font-semibold text-slate-400 hover:text-slate-700">
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </section>
        )}
      </div>
    </div>
  )
}
