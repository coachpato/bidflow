import { Inter, Playfair_Display, Inconsolata } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/app/components/ThemeProvider'
import { ToastProvider } from '@/app/components/Toast'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800', '900'],
})

const inconsolata = Inconsolata({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '700'],
})

export const metadata = {
  title: 'Bid360 - Tender Management for South Africa',
  description: "Bid360 for the built environment, legal and accounting firms behind South Africa's biggest projects.",
  colorScheme: 'light dark',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${playfairDisplay.variable} ${inconsolata.variable}`}>
      <body className="h-full antialiased">
        <ThemeProvider>
          <ToastProvider>
            {/* Skip to Content Link for Keyboard Navigation */}
            <a href="#main-content" className="skip-to-content">
              Skip to main content
            </a>

            {/* Main Content */}
            <main id="main-content" role="main">
              {children}
            </main>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
