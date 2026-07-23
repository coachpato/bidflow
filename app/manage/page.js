import Link from 'next/link'
import AppLogo from '@/app/components/AppLogo'
import ManageSubscriptions from '@/app/manage/ManageSubscriptions'

export const metadata = {
  title: 'Manage Bid360 Subscriptions',
  description: 'Update or unsubscribe from Bid360 tender digest subscriptions.',
}

export default async function ManagePage({ searchParams }) {
  const params = await searchParams
  const unsubscribed = params?.unsubscribed === '1'

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <section className="app-page py-10 sm:py-14">
        <div className="mb-10 flex items-center justify-between gap-4">
          <AppLogo tone="dark" caption="" />
          <Link href="/" className="app-button-secondary">
            Subscribe
          </Link>
        </div>

        <div className="mx-auto max-w-3xl space-y-6">
          <div className="space-y-3">
            <p className="app-kicker">Subscription settings</p>
            <h1 className="app-display text-4xl leading-tight sm:text-5xl">
              Manage your tender digests
            </h1>
          </div>

          {unsubscribed ? (
            <div className="alert alert-success" role="status">
              Your subscription has been unsubscribed.
            </div>
          ) : null}

          <ManageSubscriptions />
        </div>
      </section>
    </div>
  )
}
