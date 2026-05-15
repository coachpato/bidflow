/**
 * @jest-environment jsdom
 */

import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import { ToastProvider, useToast } from '../Toast'

function SuccessToastTrigger() {
  const { addToast } = useToast()

  useEffect(() => {
    addToast('Firm profile saved.', 'success', 0)
  }, [addToast])

  return null
}

describe('ToastProvider', () => {
  it('renders success toasts with the success background token class', async () => {
    render(
      <ToastProvider>
        <SuccessToastTrigger />
      </ToastProvider>
    )

    expect(await screen.findByRole('alert', { name: 'Success notification' }))
      .toHaveClass('bg-[var(--success-500)]')
  })
})
