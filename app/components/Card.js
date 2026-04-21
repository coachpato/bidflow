'use client'

import React from 'react'

export default function Card({
  children,
  className = '',
  interactive = false,
  elevated = false,
  noPadding = false,
  role = 'region',
  'aria-label': ariaLabel = null,
  'aria-labelledby': ariaLabelledBy = null,
  as = 'section',
  ...props
}) {
  const classes = `
    app-card
    ${interactive ? 'interactive' : ''}
    ${elevated ? 'elevated' : ''}
    ${noPadding ? 'p-0' : ''}
    ${className}
  `.trim()

  const Component = as

  return (
    <Component
      className={classes}
      role={role}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      {...props}
    >
      {children}
    </Component>
  )
}

export function CardHeader({ children, className = '', as = 'header' }) {
  const Component = as
  return (
    <Component className={`border-b border-var(--line) pb-4 mb-4 ${className}`}>
      {children}
    </Component>
  )
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={className} role="main">
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }) {
  return (
    <footer className={`border-t border-var(--line) pt-4 mt-4 flex items-center justify-between gap-3 ${className}`}>
      {children}
    </footer>
  )
}
