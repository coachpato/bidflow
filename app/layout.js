import { Cormorant_Garamond, IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
})

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
})

export const metadata = {
  title: 'Bid360 - Tender 360 for Project Advisors',
  description: 'Bid360 for the built environment, legal and accounting firms behind South Africa’s biggest projects.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`h-full ${plusJakartaSans.variable} ${ibmPlexMono.variable} ${cormorantGaramond.variable}`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  )
}
// Build trigger at Sun Apr 19 12:39:50 SAST 2026
