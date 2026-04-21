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
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!dialogRef.current) return

    if (isOpen) {
      dialogRef.current.showModal()
      document.body.style.overflow = 'hidden'
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
    >
      <div className={`bg-var(--surface) ${sizeClass} w-full`}>
        {title && (
          <div className="flex items-center justify-between border-b border-var(--line) px-6 py-4">
            <h2 className="text-xl font-bold">{title}</h2>
            <button
              onClick={onClose}
              className="text-var(--muted) hover:text-var(--foreground) transition"
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        )}

        <div className="px-6 py-4">
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
