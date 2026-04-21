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
  ...props
}) {
  const id = props.id || `select-${Math.random().toString(36).substr(2, 9)}`

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
          {required && <span className="text-var(--danger-500) ml-1">*</span>}
        </label>
      )}

      <select
        id={id}
        className={selectClass}
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
        <p className="text-sm text-var(--danger-500)" role="alert">
          {error}
        </p>
      )}

      {hint && !error && (
        <p className="text-sm text-var(--muted)">
          {hint}
        </p>
      )}
    </div>
  )
}
