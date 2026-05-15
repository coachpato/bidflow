/**
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import NewTenderPage from '../new/page'

const mockAddToast = jest.fn()
const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

jest.mock('@/app/components/Toast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
  }),
}))

jest.mock('@/app/components/Header', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/app/components/UserSelect', () => ({
  __esModule: true,
  default: () => null,
}))

describe('NewTenderPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 123 }),
    })
  })

  afterEach(() => {
    delete global.fetch
  })

  it("shows a success toast after creating a tender", async () => {
    const { container } = render(<NewTenderPage />)

    fireEvent.change(container.querySelector('input[name="title"]'), {
      target: { value: 'Panel of attorneys' },
    })
    fireEvent.change(container.querySelector('input[name="entity"]'), {
      target: { value: 'National Treasury' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create tender' }))

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith('Pursuit created.', 'success')
    })

    expect(global.fetch).toHaveBeenCalledWith('/api/tenders', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(mockPush).toHaveBeenCalledWith('/tenders/123')
  })
})
