import Link from 'next/link'
import { ETENDERS_GENERAL_OPPORTUNITIES_URL, normalizeEtendersSourceUrl } from '@/lib/crawler/etenders-links'
import { deriveTenderLifecycleStatus } from '@/lib/crawler/tender-identity'
import { buildAppUrl } from '@/lib/config/app-url'
import CopyReferenceButton from './CopyReferenceButton'

function formatDate(value, includeTime = false) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'

  return new Intl.DateTimeFormat('en-ZA', {
    dateStyle: 'medium',
    ...(includeTime ? { timeStyle: 'short' } : {}),
  }).format(date)
}

function getSourceLink(tender) {
  const storedUrl = normalizeEtendersSourceUrl(tender.sourceUrl)
  const fallbackUrl = normalizeEtendersSourceUrl(tender.sourceFallbackUrl) || ETENDERS_GENERAL_OPPORTUNITIES_URL

  // The crawler-generated tenderDetails endpoint is a source API response, not
  // a stable human-facing tender page. Keep it for provenance, but use the
  // honest general opportunities link until eTenders supplies a real detail URL.
  const hasHumanSourceUrl = storedUrl && storedUrl !== normalizeEtendersSourceUrl(tender.sourceDetailUrl)

  return {
    url: hasHumanSourceUrl ? storedUrl : fallbackUrl,
    label: hasHumanSourceUrl ? 'Open source tender page' : 'View opportunities on eTenders',
    direct: Boolean(hasHumanSourceUrl),
  }
}

function StatusBadge({ lifecycle }) {
  const toneClass = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    danger: 'border-red-200 bg-red-50 text-red-800',
    muted: 'border-slate-200 bg-slate-100 text-slate-700',
  }[lifecycle.tone] || 'border-slate-200 bg-slate-100 text-slate-700'

  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${toneClass}`}>{lifecycle.label}</span>
}

function DetailRow({ label, value }) {
  if (!value) return null
  return (
    <div className="border-b border-[var(--line)] py-3 last:border-b-0">
      <dt className="text-xs font-bold uppercase tracking-wider text-[var(--foreground-secondary)]">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--foreground)]">{value}</dd>
    </div>
  )
}

export default function TenderDetailContent({ tender }) {
  const lifecycle = deriveTenderLifecycleStatus(tender)
  const source = getSourceLink(tender)
  const closedNotice = lifecycle.closed && tender.deadline
    ? `This tender closed on ${formatDate(tender.deadline)}. The information is retained for reference.`
    : null
  const sourceMissingNotice = lifecycle.sourceMissing
    ? 'This tender is retained from the last verified Bid360 record because it could not recently be verified at eTenders.'
    : null
  const documents = (tender.documents || []).filter(document => normalizeEtendersSourceUrl(document.sourceUrl))

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--line)] bg-white/70">
        <div className="app-page flex items-center justify-between gap-4 py-5">
          <Link href="/" className="text-lg font-bold tracking-tight text-[var(--foreground)]">Bid360</Link>
          <Link href="/manage" className="text-sm font-semibold text-[var(--foreground-secondary)] hover:text-[var(--foreground)]">Manage digest</Link>
        </div>
      </header>

      <main className="app-page py-10 sm:py-14">
        <div className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge lifecycle={lifecycle} />
            {tender.category ? <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{tender.category}</span> : null}
          </div>

          <h1 className="app-display mt-5 max-w-4xl text-3xl leading-tight sm:text-5xl">{tender.title}</h1>
          <p className="mt-4 text-lg font-semibold text-[var(--foreground-secondary)]">{tender.entity}</p>

          {closedNotice ? <p className="mt-6 border-l-4 border-slate-400 bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-700">{closedNotice}</p> : null}
          {sourceMissingNotice ? <p className="mt-3 border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">{sourceMissingNotice}</p> : null}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {tender.reference ? (
              <>
                <span className="rounded-md bg-[var(--foreground)] px-3 py-2 font-mono text-sm text-white">{tender.reference}</span>
                <CopyReferenceButton reference={tender.reference} />
              </>
            ) : null}
            <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-bold text-white hover:opacity-90">
              {source.label}
            </a>
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section aria-labelledby="tender-details-heading">
              <h2 id="tender-details-heading" className="text-xl font-bold text-[var(--foreground)]">Tender details</h2>
              <dl className="mt-3 border-y border-[var(--line)]">
                <DetailRow label="Reference number" value={tender.reference} />
                <DetailRow label="Category" value={tender.category} />
                <DetailRow label="Bid360 classification" value={tender.matchedSectors?.length ? tender.matchedSectors.join(', ') : tender.practiceArea} />
                <DetailRow label="Publication date" value={formatDate(tender.publishedAt)} />
                <DetailRow label="Briefing date" value={formatDate(tender.briefingDate, true)} />
                <DetailRow label="Briefing details" value={tender.briefingDetails} />
                <DetailRow label="Closing date and time" value={formatDate(tender.deadline, true)} />
                <DetailRow label="Location" value={tender.location} />
                <DetailRow label="Contact person" value={tender.contactPerson} />
                <DetailRow label="Contact email" value={tender.contactEmail} />
              </dl>
            </section>

            <aside className="space-y-7">
              {documents.length > 0 ? (
                <section aria-labelledby="documents-heading">
                  <h2 id="documents-heading" className="text-xl font-bold text-[var(--foreground)]">Official documents</h2>
                  <ul className="mt-3 space-y-2">
                    {documents.map(document => (
                      <li key={document.id}>
                        <a href={document.sourceUrl} target="_blank" rel="noreferrer" className="block rounded-md border border-[var(--line)] bg-white px-3 py-3 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)]">
                          {document.filename}
                          <span className="mt-1 block text-xs font-normal text-[var(--foreground-secondary)]">Official eTenders document</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section aria-labelledby="verification-heading" className="border-t border-[var(--line)] pt-5">
                <h2 id="verification-heading" className="text-sm font-bold uppercase tracking-wider text-[var(--foreground-secondary)]">Source and verification</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground-secondary)]">Source: {tender.sourceName || 'eTenders.gov.za'}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--foreground-secondary)]">Last verified by Bid360: {formatDate(tender.lastVerifiedAt || tender.lastSeenAt)}</p>
                {tender.firstSeenAt ? <p className="mt-1 text-sm leading-6 text-[var(--foreground-secondary)]">First seen: {formatDate(tender.firstSeenAt)}</p> : null}
              </section>
            </aside>
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--line)] bg-white/40 py-7">
        <div className="app-page text-sm text-[var(--foreground-secondary)]">
          Bid360 retains this tender page for reference. The source attribution links to eTenders.gov.za.
        </div>
      </footer>
    </div>
  )
}
