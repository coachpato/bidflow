'use client'

import React from 'react'

export default function Input({
  label,
  error,
  hint,
  required = false,
  type = 'text',
  className = '',
  icon: Icon = null,
  'aria-label': ariaLabel = null,
  ...props
}) {
  const id = props.id || `input-${Math.random().toString(36).substr(2, 9)}`
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  // Build aria-describedby
  const describedByIds = []
  if (error) describedByIds.push(errorId)
  if (hint && !error) describedByIds.push(hintId)
  const ariaDescribedBy = describedByIds.length > 0 ? describedByIds.join(' ') : undefined

  const inputClass = `
    app-input
    ${error ? 'error' : ''}
    ${Icon ? 'pl-10' : ''}
    ${className}
  `.trim()

  return (
    <div className="space-y-2 w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-semibold text-var(--foreground)">
          {label}
          {required && <span className="required" aria-label="required">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-var(--muted) pointer-events-none" aria-hidden="true">
            <Icon size={18} />
          </div>
        )}
        <input
          id={id}
          type={type}
          className={inputClass}
          aria-label={ariaLabel}
          aria-invalid={error ? 'true' : 'false'}
          aria-required={required ? 'true' : 'false'}
          aria-describedby={ariaDescribedBy}
          {...props}
        />
      </div>

      {error && (
        <p id={errorId} className="text-sm text-var(--danger-500) error-message" role="alert">
          {error}
        </p>
      )}

      {hint && !error && (
        <p id={hintId} className="text-sm text-var(--muted) hint">
          {hint}
        </p>
      )}
    </div>
  )
}
