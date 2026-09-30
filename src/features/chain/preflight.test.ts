import { afterEach, expect, it, vi } from 'vitest'
import { fetchPreflight, mapPreflight, uint64String } from './preflight'

afterEach(() => vi.unstubAllGlobals())

it('maps standard RPC and LCD responses without Number conversion', async () => {
  const responses = [
    { result: { node_info: { network: 'alpha-1' }, sync_info: { latest_block_height: '9007199254740993' } } },
    { account: { '@type': '/cosmos.auth.v1beta1.BaseAccount', account_number: '18446744073709551615', sequence: '3' } },
    { balance: { denom: 'stake', amount: '9007199254740993' } },
  ]
  const fetchMock = vi.fn().mockImplementation(async () => ({ ok: true, json: async () => responses.shift() }))
  vi.stubGlobal('fetch', fetchMock)
  expect(await fetchPreflight('alpha1test')).toEqual({ chainId: 'alpha-1', height: '9007199254740993', accountNumber: '18446744073709551615', sequence: '3', balance: '9007199254740993' })
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    'http://127.0.0.1:26657/status',
    'http://127.0.0.1:1317/cosmos/auth/v1beta1/accounts/alpha1test',
    'http://127.0.0.1:1317/cosmos/bank/v1beta1/balances/alpha1test/by_denom?denom=stake',
  ])
})

it('rejects wrong chain and unsafe uint64 strings', () => {
  expect(() => mapPreflight({ result: { node_info: { network: 'wrong' } } }, {}, {}, 'alpha-1')).toThrow('Alpha chain mismatch')
  expect(() => uint64String('18446744073709551616')).toThrow('Invalid uint64')
  expect(() => uint64String('01')).toThrow('Invalid uint64')
})

it('keeps account query errors visible', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
  await expect(fetchPreflight('alpha1test')).rejects.toThrow('HTTP 503')
})
