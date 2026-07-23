/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ManageSubscriptions from '../ManageSubscriptions'

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }) => (
    <a href={typeof href === 'string' ? href : href.pathname} {...props}>
      {children}
    </a>
  ),
}))

describe('ManageSubscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    delete global.fetch
  })

  it('shows a no subscriptions message for an unknown email', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, subscriptions: [] }),
    })

    render(<ManageSubscriptions />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'missing@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Find subscriptions' }))

    expect(await screen.findByText('No subscriptions found for that email.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to registration' })).toHaveAttribute('href', '/')
  })

  it('updates and unsubscribes a sector subscription', async () => {
    const subscription = {
      id: 'subscriber_1',
      email: 'owner@example.com',
      entityName: 'Acme Projects',
      sector: 'construction',
      keywords: 'roads',
      location: 'Gauteng',
      subscribed: true,
    }

    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, subscriptions: [subscription] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          subscription: {
            ...subscription,
            keywords: 'bridges',
            location: 'Western Cape',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          subscription: {
            ...subscription,
            keywords: 'bridges',
            location: 'Western Cape',
            subscribed: false,
          },
        }),
      })

    render(<ManageSubscriptions />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'owner@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Find subscriptions' }))

    expect(await screen.findByRole('heading', { name: 'Construction' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Keywords'), {
      target: { value: 'bridges' },
    })
    fireEvent.change(screen.getByLabelText('Location'), {
      target: { value: 'Western Cape' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(screen.getByText('Construction subscription updated.')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }))

    await waitFor(() => {
      expect(screen.getByText('Construction subscription unsubscribed.')).toBeInTheDocument()
    })
  })
})
