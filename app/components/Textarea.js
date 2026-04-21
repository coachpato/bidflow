'use client'

import React from 'react'

export default function Textarea({
  label,
  error,
  hint,
  required = false,
  rows = 4,
  className = '',
  ...props
}) {
  const id = props.id || `textarea-${Math.random().toString(36).substr(2, 9)}`

  const textareaClass = `
    app-textarea
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

      <textarea
        id={id}
        rows={rows}
        className={textareaClass}
        {...props}
      />

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
