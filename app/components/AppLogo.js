import Link from 'next/link'

export default function AppLogo({
  href = '/dashboard',
  caption = 'For the built environment, legal and accounting firms behind South Africa\'s biggest projects',
  tone = 'light',
}) {
  const labelColor = tone === 'dark' ? 'text-slate-950' : 'text-white'
  const captionColor = tone === 'dark' ? 'text-slate-500' : 'text-slate-400'

  return (
    <Link href={href} className="inline-flex flex-col gap-1">
      <span className={`app-display text-[2rem] font-semibold leading-none tracking-tight ${labelColor}`}>
        <span className={labelColor}>Bid</span>
        <span className="text-[var(--accent-500)]">360</span>
      </span>
      {caption ? (
        <span className={`text-[11px] font-medium uppercase tracking-[0.28em] ${captionColor}`}>
          {caption}
        </span>
      ) : null}
    </Link>
  )
}
