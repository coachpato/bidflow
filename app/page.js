import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

// Root page: send logged-in users to dashboard, others to login
export default async function RootPage() {
  const session = await getSession()
  if (session.userId) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
