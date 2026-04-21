'use client'

import React from 'react'

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  type = 'button',
  className = '',
  icon: Icon = null,
  iconPosition = 'left',
  fullWidth = false,
  'aria-label': ariaLabel = null,
  ...props
}) {
  const baseClass = 'app-button inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all'

  const variantClass = {
    primary: 'app-button-primary',
    secondary: 'app-button-secondary',
    danger: 'app-button-danger',
    success: 'app-button-success',
    ghost: 'app-button-ghost',
  }[variant]

  const sizeClass = {
    sm: 'app-button-sm',
    md: 'px-4 py-2',
    lg: 'app-button-lg',
  }[size]

  const classes = `
    ${baseClass}
    ${variantClass}
    ${sizeClass}
    ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `.trim()

  // For icon-only buttons, ensure aria-label is set
  const iconOnly = !children || (Icon && !children)
  const finalAriaLabel = ariaLabel || (iconOnly ? 'Button' : undefined)

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={classes}
      aria-label={finalAriaLabel}
      aria-busy={loading ? 'true' : 'false'}
      aria-disabled={disabled || loading ? 'true' : 'false'}
      {...props}
    >
      {loading && <LoadingSpinner />}
      {!loading && Icon && iconPosition === 'left' && <Icon size={18} aria-hidden="true" />}
      {children && <span>{children}</span>}
      {!loading && Icon && iconPosition === 'right' && <Icon size={18} aria-hidden="true" />}
    </button>
  )
}

function LoadingSpinner() {
  return (
    <div className="animate-spin" aria-hidden="true">
      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
    </div>
  )
}
