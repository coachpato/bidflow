'use client'

import { CheckIcon, ClipboardDocumentIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'

export default function CopyReferenceButton({ reference }) {
  const [copied, setCopied] = useState(false)

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(reference)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={copyReference}
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)] shadow-sm transition hover:border-[var(--accent)]"
      aria-label="Copy reference number"
      title="Copy reference number"
    >
      {copied ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : <ClipboardDocumentIcon className="h-4 w-4" aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy reference number'}
    </button>
  )
}
