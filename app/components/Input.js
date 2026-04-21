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
  ...props
}) {
  const id = props.id || `input-${Math.random().toString(36).substr(2, 9)}`

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
          {required && <span className="text-var(--danger-500) ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-var(--muted) pointer-events-none">
            <Icon size={18} />
          </div>
        )}
        <input
          id={id}
          type={type}
          className={inputClass}
          {...props}
        />
      </div>

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
