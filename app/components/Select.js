'use client'

import React from 'react'

export default function Select({
  label,
  error,
  hint,
  required = false,
  options = [],
  placeholder = 'Choose...',
  className = '',
  'aria-label': ariaLabel = null,
  ...props
}) {
  const id = props.id || `select-${Math.random().toString(36).substr(2, 9)}`
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  // Build aria-describedby
  const describedByIds = []
  if (error) describedByIds.push(errorId)
  if (hint && !error) describedByIds.push(hintId)
  const ariaDescribedBy = describedByIds.length > 0 ? describedByIds.join(' ') : undefined

  const selectClass = `
    app-input
    ${error ? 'error' : ''}
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

      <select
        id={id}
        className={selectClass}
        aria-label={ariaLabel}
        aria-invalid={error ? 'true' : 'false'}
        aria-required={required ? 'true' : 'false'}
        aria-describedby={ariaDescribedBy}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

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
