import { Cormorant_Garamond, IBM_Plex_Mono, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/app/components/ThemeProvider'
import { ToastProvider } from '@/app/components/Toast'

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
  title: 'Bid360 - Tender Management for South Africa',
  description: "Bid360 for the built environment, legal and accounting firms behind South Africa's biggest projects.",
  colorScheme: 'light dark',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`h-full ${plusJakartaSans.variable} ${ibmPlexMono.variable} ${cormorantGaramond.variable}`}>
      <body className="h-full antialiased">
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
