import { afterEach, expect, it, vi } from 'vitest'
import { certificateFixture } from '../../lib/alpha/testFixture'
import { certificateRequest, requestCertificate } from './certificateApi'
import { canRequestCertificate, certificateCurrent } from './gate'
import type { WalletSession } from '../wallet/keplr'

afterEach(() => vi.unstubAllGlobals())

it('gates issuance on login, wallet, preflight, and valid form', async () => {
  const fixture = await certificateFixture()
  const wallet = { address: fixture.address, chainId: 'alpha-1' } as WalletSession
  expect(canRequestCertificate(false, wallet, fixture.preflight, fixture.draft)).toBe(false)
  expect(canRequestCertificate(true, null, fixture.preflight, fixture.draft)).toBe(false)
  expect(canRequestCertificate(true, wallet, undefined, fixture.draft)).toBe(false)
  expect(canRequestCertificate(true, wallet, fixture.preflight, fixture.draft)).toBe(true)
  expect(canRequestCertificate(true, wallet, fixture.preflight, { ...fixture.draft, amount: '0' })).toBe(false)
  expect(certificateCurrent('9', '3', '10', '40', fixture.preflight, fixture.address, fixture.address)).toBe(true)
  expect(certificateCurrent('9', '3', '10', '40', { ...fixture.preflight, sequence: '4' }, fixture.address, fixture.address)).toBe(false)
  expect(certificateCurrent('9', '3', '10', '40', fixture.preflight, 'other', fixture.address)).toBe(false)
})

it('sends only backend fields with bearer token', async () => {
  const fixture = await certificateFixture()
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => fixture.response })
  vi.stubGlobal('fetch', fetchMock)
  expect(await requestCertificate(fixture.draft, fixture.address, 'memory-token')).toBe(fixture.response)
  const [url, options] = fetchMock.mock.calls[0]
  expect(url).toBe('/api/v2/certificates')
  expect(options.headers.Authorization).toBe('Bearer memory-token')
  expect(options.cache).toBe('no-store')
  expect(JSON.parse(options.body)).toEqual(certificateRequest(fixture.draft, fixture.address))
  expect(Object.keys(JSON.parse(options.body)).sort()).toEqual(['amount', 'denom', 'fee_amount', 'gas_limit', 'memo', 'receiver', 'subject', 'timeout_height'])
  expect(certificateRequest({ ...fixture.draft, feeAmount: '0' }, fixture.address).fee_amount).toEqual([])
})

it('shows stable denial code and hides raw backend message', async () => {
  const fixture = await certificateFixture()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ code: 'SUBJECT_MISMATCH', message: 'sensitive details' }) }))
  await expect(requestCertificate(fixture.draft, fixture.address, 'token')).rejects.toThrow('SUBJECT_MISMATCH')
  await expect(requestCertificate(fixture.draft, fixture.address, 'token')).rejects.not.toThrow('sensitive details')
})
