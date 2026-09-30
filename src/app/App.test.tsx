// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function renderApp() {
  render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>)
}

describe('foundation', () => {
  it('renders disconnected state and unavailable certificate action', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Prepare transfer' })).toBeTruthy()
    expect(screen.getByText('Disconnected')).toBeTruthy()
    expect(screen.getByText('Waiting for wallet')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Request certificate' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows field validation and a missing wallet error', async () => {
    renderApp()
    const amount = screen.getByLabelText('Amount (base units)')
    fireEvent.change(amount, { target: { value: '1.5' } })
    fireEvent.blur(amount)
    expect(screen.getByText('Amount must be a positive integer.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Connect Keplr' }))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Keplr extension not found')
  })
})
