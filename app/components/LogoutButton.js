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
      className="text-slate-500 hover:text-red-600 transition-colors text-sm"
    >
      Sign out
    </button>
  )
}
