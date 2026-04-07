import './globals.css'

export const metadata = {
  title: 'BidFlow — Tender & Contract Management',
  description: 'Manage tenders, contracts, and appeals for South African law firms',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
