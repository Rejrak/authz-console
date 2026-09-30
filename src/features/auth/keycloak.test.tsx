// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

const client = vi.hoisted(() => ({
  authenticated: true,
  token: 'memory-only-token',
  tokenParsed: { preferred_username: 'alice' },
  init: vi.fn(async () => true),
  updateToken: vi.fn(async () => false),
  login: vi.fn(),
  logout: vi.fn(),
}))
vi.mock('keycloak-js', () => ({ default: function Keycloak() { return client } }))

import { accessToken, useKeycloak } from './keycloak'

afterEach(cleanup)

it('uses authorization code with PKCE S256 and keeps token in the adapter', async () => {
  const { result } = renderHook(() => useKeycloak())
  await waitFor(() => expect(result.current.status).toBe('authenticated'))
  expect(client.init).toHaveBeenCalledWith(expect.objectContaining({ flow: 'standard', pkceMethod: 'S256', onLoad: 'check-sso' }))
  expect(result.current.username).toBe('alice')
  expect(await accessToken()).toBe('memory-only-token')
  expect(client.updateToken).toHaveBeenCalledWith(30)
})
