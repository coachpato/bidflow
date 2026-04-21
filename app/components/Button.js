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

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={classes}
      {...props}
    >
      {loading && <LoadingSpinner />}
      {!loading && Icon && iconPosition === 'left' && <Icon size={18} />}
      <span>{children}</span>
      {!loading && Icon && iconPosition === 'right' && <Icon size={18} />}
    </button>
  )
}

function LoadingSpinner() {
  return (
    <div className="animate-spin">
      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
    </div>
  )
}
