import Sidebar from '@/app/components/Sidebar'

// This layout wraps every page inside the dashboard (tenders, contracts, etc.)
export default function DashboardLayout({ children }) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
