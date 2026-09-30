// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { toBech32 } from '@cosmjs/encoding'
import type { OfflineDirectSigner } from '@cosmjs/proto-signing'
import { connectKeplr } from './keplr'

afterEach(() => { delete window.keplr; vi.restoreAllMocks() })

it('obtains account, public key, and an arbitrary direct SignDoc signer', async () => {
  const address = toBech32('cosmos', new Uint8Array(20), 90)
  const pubkey = new Uint8Array(33)
  pubkey[0] = 2
  const signer = { getAccounts: async () => [{ address, algo: 'secp256k1' as const, pubkey }], signDirect: vi.fn() }
  const suggest = vi.fn()
  const enable = vi.fn()
  window.keplr = { experimentalSuggestChain: suggest, enable, getKey: async () => ({ bech32Address: address, pubKey: pubkey, isNanoLedger: false }), getOfflineSigner: () => signer }
  const session = await connectKeplr('alpha-1', 'cosmos')
  const direct: OfflineDirectSigner = session.signer
  const customDoc: Parameters<typeof direct.signDirect>[1] = { bodyBytes: new Uint8Array([8, 255]), authInfoBytes: new Uint8Array([1]), chainId: 'alpha-1', accountNumber: 9007199254740993n }
  expect(direct.signDirect).toBe(signer.signDirect)
  expect(customDoc.bodyBytes).toEqual(new Uint8Array([8, 255]))
  expect(session.publicKey).toEqual(pubkey)
  expect(session.address).toBe(address)
  expect(suggest.mock.invocationCallOrder[0]).toBeLessThan(enable.mock.invocationCallOrder[0])
  expect(suggest.mock.calls[0][0]).toMatchObject({ chainId: 'alpha-1', bech32Config: { bech32PrefixAccAddr: 'cosmos' }, stakeCurrency: { coinMinimalDenom: 'stake' } })
  expect(suggest.mock.calls[0][0].currencies).toEqual(expect.arrayContaining([expect.objectContaining({ coinMinimalDenom: 'token' })]))
})

it('rejects wallets without direct signing', async () => {
  window.keplr = { experimentalSuggestChain: vi.fn(), enable: vi.fn(), getKey: async () => ({ bech32Address: 'cosmos1a', pubKey: new Uint8Array([1]), isNanoLedger: false }), getOfflineSigner: () => ({ getAccounts: async () => [], signAmino: vi.fn() }) }
  await expect(connectKeplr('alpha-1', 'cosmos')).rejects.toThrow('SIGN_MODE_DIRECT')
})
