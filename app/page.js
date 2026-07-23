import Link from 'next/link'
import AppLogo from '@/app/components/AppLogo'
import SubscribeForm from '@/app/SubscribeForm'
import { SECTORS } from '@/lib/sectors'

export default function RootPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <section className="app-page grid min-h-screen items-center gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:py-14">
        <div className="space-y-8">
          <AppLogo tone="dark" caption="" />

          <div className="max-w-3xl space-y-5">
            <p className="app-kicker">Bid360 tender digests</p>
            <h1 className="app-display text-4xl leading-tight sm:text-5xl lg:text-6xl">
              Get South African tender opportunities in your inbox
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--foreground-secondary)]">
              We crawl etenders daily and send you tenders matching your sector.
            </p>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Available sectors">
            {SECTORS.slice(0, 8).map(sector => (
              <span key={sector.value} className="app-badge app-badge-primary">
                {sector.label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <SubscribeForm sectors={SECTORS} />
        </div>
      </section>

      <footer className="border-t border-[var(--line)] bg-white/40 py-7">
        <div className="app-page flex flex-col gap-4 text-sm text-[var(--foreground-secondary)] sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright 2026 Talita Consulting Services (Pty) Ltd, trading as Bid360.</p>
          <nav className="flex flex-wrap gap-4 font-semibold">
            <Link href="/manage">Unsubscribe/Manage</Link>
            <a href="mailto:hello@bid360.co.za">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
