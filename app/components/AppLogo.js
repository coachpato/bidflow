import Image from 'next/image'
import Link from 'next/link'

export default function AppLogo({
  href = '/',
  className = '',
  caption = 'For the built environment, legal and accounting firms behind South Africa\'s biggest projects',
  tone = 'light',
}) {
  const captionColor = tone === 'dark' ? 'text-slate-500' : 'text-slate-400'

  return (
    <Link
      href={href}
      className={caption ? 'inline-flex flex-col gap-1' : 'flex items-center'}
      aria-label="Bid360"
    >
      <Image
        src="/logo.png"
        alt="Bid360"
        width={160}
        height={43}
        className={`h-6 w-auto sm:h-8 md:h-10 ${className}`}
        priority
        style={{ objectFit: 'contain' }}
      />
      {caption ? (
        <span className={`text-[11px] font-medium uppercase tracking-[0.28em] ${captionColor}`}>
          {caption}
        </span>
      ) : null}
    </Link>
  )
}
