'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

export default function Header({ title }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.user) setUser(data.user) })
  }, [])

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>

      <div className="flex items-center gap-4">
        {/* Notifications icon */}
        <Link href="/notifications" className="text-slate-500 hover:text-slate-800 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </Link>

        {/* User info */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
              style={{ backgroundColor: '#185FA5' }}
            >
              {user.name?.[0]?.toUpperCase()}
            </div>
          </div>
        )}

        <LogoutButton />
      </div>
    </header>
  )
}
