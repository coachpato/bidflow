'use client'

import React from 'react'

export default function Card({
  children,
  className = '',
  interactive = false,
  elevated = false,
  noPadding = false,
  ...props
}) {
  const classes = `
    app-card
    ${interactive ? 'interactive' : ''}
    ${elevated ? 'elevated' : ''}
    ${noPadding ? 'p-0' : ''}
    ${className}
  `.trim()

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`border-b border-var(--line) pb-4 mb-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`border-t border-var(--line) pt-4 mt-4 flex items-center justify-between gap-3 ${className}`}>
      {children}
    </div>
  )
}
