'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { CheckIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline'

const ToastContext = createContext()

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }

    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

function ToastContainer({ toasts, onRemove }) {
  // Separate toasts by type for aria-live regions
  const assertiveToasts = toasts.filter(t => ['error', 'warning'].includes(t.type))
  const politeToasts = toasts.filter(t => ['success', 'info'].includes(t.type))

  return (
    <>
      {/* Assertive region for errors and warnings */}
      {assertiveToasts.length > 0 && (
        <div
          className="fixed bottom-4 right-4 z-50 space-y-3 pointer-events-none"
          aria-live="assertive"
          aria-atomic="true"
          role="alert"
        >
          {assertiveToasts.map(toast => (
            <Toast key={toast.id} {...toast} onRemove={onRemove} />
          ))}
        </div>
      )}

      {/* Polite region for success and info */}
      {politeToasts.length > 0 && (
        <div
          className="fixed bottom-4 right-4 z-50 space-y-3 pointer-events-none"
          aria-live="polite"
          aria-atomic="false"
          role="status"
        >
          {politeToasts.map(toast => (
            <Toast key={toast.id} {...toast} onRemove={onRemove} />
          ))}
        </div>
      )}
    </>
  )
}

function Toast({ id, message, type, onRemove }) {
  const bgColor = {
    success: 'bg-var(--success-500)',
    error: 'bg-var(--danger-500)',
    warning: 'bg-var(--warning-500)',
    info: 'bg-var(--info-500)',
  }[type]

  const Icon = {
    success: CheckIcon,
    error: XMarkIcon,
    warning: ExclamationTriangleIcon,
  }[type]

  const ariaLabel = {
    success: 'Success notification',
    error: 'Error notification',
    warning: 'Warning notification',
    info: 'Information notification',
  }[type]

  return (
    <div
      className={`
        ${bgColor} text-white rounded-lg px-4 py-3 shadow-lg
        flex items-center gap-3 pointer-events-auto
        animate-slideInUp
      `}
      role="alert"
      aria-label={ariaLabel}
    >
      {Icon ? <Icon className="h-5 w-5 flex-shrink-0 text-white/90" aria-hidden="true" /> : null}
      <p className="flex-1">{message}</p>
      <button
        onClick={() => onRemove(id)}
        className="hover:opacity-80 transition"
        aria-label={`Close ${ariaLabel.toLowerCase()}`}
        type="button"
      >
        <XMarkIcon className="h-4 w-4 text-white/90" aria-hidden="true" />
      </button>
    </div>
  )
}
