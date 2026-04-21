'use client'

import { useEffect, useRef } from 'react'

export default function Modal({
  isOpen = false,
  onClose = () => {},
  title,
  children,
  footer,
  size = 'md',
  closeOnEscape = true,
  closeOnBackdrop = true,
  'aria-label': ariaLabel = null,
  'aria-describedby': ariaDescribedBy = null,
}) {
  const dialogRef = useRef(null)
  const titleId = useRef(`modal-title-${Math.random().toString(36).substr(2, 9)}`).current
  const contentId = useRef(`modal-content-${Math.random().toString(36).substr(2, 9)}`).current

  useEffect(() => {
    if (!dialogRef.current) return

    if (isOpen) {
      dialogRef.current.showModal()
      document.body.style.overflow = 'hidden'
      // Focus the first focusable element in the modal
      setTimeout(() => {
        const focusable = dialogRef.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        focusable?.focus()
      }, 0)
    } else {
      dialogRef.current.close()
      document.body.style.overflow = 'auto'
    }

    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isOpen])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && closeOnEscape) {
      onClose()
    }
  }

  const handleBackdropClick = (e) => {
    if (closeOnBackdrop && e.target === dialogRef.current) {
      onClose()
    }
  }

  const sizeClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[size]

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:bg-var(--overlay) backdrop:backdrop-blur-sm p-0 rounded-2xl border border-var(--line) shadow-xl animate-slideInUp"
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={title ? titleId : ariaLabel ? undefined : undefined}
      aria-describedby={ariaDescribedBy}
      role="dialog"
    >
      <div className={`bg-var(--surface) ${sizeClass} w-full`}>
        {title && (
          <div className="flex items-center justify-between border-b border-var(--line) px-6 py-4">
            <h2 id={titleId} className="text-xl font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="text-var(--muted) hover:text-var(--foreground) transition"
              aria-label="Close modal"
              type="button"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        )}

        <div id={contentId} className="px-6 py-4">
          {children}
        </div>

        {footer && (
          <div className="border-t border-var(--line) px-6 py-4 flex items-center gap-3 justify-end">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  )
}
