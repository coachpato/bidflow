'use client'
import { useState, useEffect } from 'react'
import Header from '@/app/components/Header'

const TYPE_STYLES = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  danger: 'bg-red-50 border-red-200 text-red-800',
}

const TYPE_ICONS = {
  info: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  danger: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchNotifications() {
    const res = await fetch('/api/notifications')
    const data = await res.json()
    setNotifications(data)
    setLoading(false)
  }

  useEffect(() => { fetchNotifications() }, [])

  async function markRead(id) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications(n => n.map(notif => notif.id === id ? { ...notif, read: true } : notif))
  }

  async function markAllRead() {
    const unread = notifications.filter(n => !n.read)
    await Promise.all(unread.map(n => fetch(`/api/notifications/${n.id}`, { method: 'PATCH' })))
    setNotifications(n => n.map(notif => ({ ...notif, read: true })))
  }

  async function deleteNotification(id) {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    setNotifications(n => n.filter(notif => notif.id !== id))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div>
      <Header title="Notifications" />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-slate-500 text-sm">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-sm text-[#185FA5] hover:underline">
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-12">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 text-center py-12">
            <p className="text-slate-400">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-4 rounded-xl border transition-opacity ${
                  TYPE_STYLES[n.type] || TYPE_STYLES.info
                } ${n.read ? 'opacity-60' : ''}`}
              >
                <div className="flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] || TYPE_ICONS.info}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{n.message}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {new Date(n.createdAt).toLocaleDateString('en-ZA', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!n.read && (
                    <button onClick={() => markRead(n.id)} className="text-xs underline opacity-70 hover:opacity-100">
                      Mark read
                    </button>
                  )}
                  <button onClick={() => deleteNotification(n.id)} className="text-xs opacity-50 hover:opacity-100">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
