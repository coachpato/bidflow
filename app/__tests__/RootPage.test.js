/**
 * @jest-environment jsdom
 */

/* eslint-disable @next/next/no-img-element */

import { render, screen } from '@testing-library/react'
import RootPage from '../page'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, priority, ...props }) => <img alt={alt} {...props} />,
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
}))

function setViewport(width, height) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })
  window.dispatchEvent(new Event('resize'))
}

describe('RootPage', () => {
  it('renders the subscription landing page at desktop size', () => {
    setViewport(1280, 900)
    render(<RootPage />)

    expect(screen.getByRole('heading', {
      name: 'Get South African tender opportunities in your inbox',
    })).toBeInTheDocument()
    expect(screen.getByText('We crawl etenders daily and send you tenders matching your sector.')).toBeInTheDocument()
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Entity\/Business Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Sector/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Unsubscribe/Manage' })).toHaveAttribute('href', '/manage')
  })

  it('renders the subscription landing page at mobile size', () => {
    setViewport(375, 812)
    render(<RootPage />)

    expect(screen.getByRole('heading', {
      name: 'Get South African tender opportunities in your inbox',
    })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument()
    expect(screen.getAllByText('Agriculture').length).toBeGreaterThan(0)
  })
})
