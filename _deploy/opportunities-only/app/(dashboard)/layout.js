import TopNav from '@/app/components/TopNav'

// This layout wraps every page inside the dashboard (tenders, contracts, etc.)
export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="pb-8">{children}</main>
    </div>
  )
}
