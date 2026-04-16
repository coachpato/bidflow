'use client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="app-button-ghost rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600"
    >
      Sign out
    </button>
  )
}
