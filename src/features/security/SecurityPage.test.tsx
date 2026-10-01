// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '../../app/App'

afterEach(() => { cleanup(); window.history.pushState({}, '', '/send') })

it('shows planned and observed results separately, with no fabricated chain event or secrets', async () => {
  window.history.pushState({}, '', '/security')
  render(<QueryClientProvider client={new QueryClient()}><App/></QueryClientProvider>)
  expect(await screen.findByRole('heading', { name: 'Security matrix' })).toBeTruthy()
  expect(screen.getAllByText('NOT_RUN')).toHaveLength(14)
  expect(screen.getAllByRole('button', { name: 'Run local check' })).toHaveLength(5)
  expect(screen.queryByText('DENY')).toBeNull()
  expect(screen.queryByText(/raw certificate bytes|access_token|refresh_token|issuer-1/)).toBeNull()
  fireEvent.click(screen.getAllByRole('button', { name: 'Run local check' })[0])
  await waitFor(() => expect(screen.getByText('Certificate receiver mismatch')).toBeTruthy())
  expect(screen.getByText('Expected receiver:')).toBeTruthy()
  expect(screen.getByText('Modified receiver:')).toBeTruthy()
  expect(screen.getAllByText('NOT_RUN')).toHaveLength(13)
  expect(screen.queryByText('DENY')).toBeNull()
  expect(document.body.textContent).not.toMatch(/certificate_bytes_base64|access_token|refresh_token|issuer-1/)
})
