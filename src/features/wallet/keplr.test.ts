// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import type { OfflineDirectSigner } from '@cosmjs/proto-signing'
import { connectKeplr } from './keplr'

afterEach(() => { delete window.keplr; vi.restoreAllMocks() })

it('obtains account, public key, and an arbitrary direct SignDoc signer', async () => {
  const address = `alpha1${'q'.repeat(38)}`
  const signer = { getAccounts: async () => [{ address, algo: 'secp256k1' as const, pubkey: new Uint8Array([1]) }], signDirect: vi.fn() }
  window.keplr = { enable: vi.fn(), getKey: async () => ({ bech32Address: address, pubKey: new Uint8Array([1]), isNanoLedger: false }), getOfflineSigner: () => signer }
  const session = await connectKeplr('alpha-1', 'alpha')
  const direct: OfflineDirectSigner = session.signer
  const customDoc: Parameters<typeof direct.signDirect>[1] = { bodyBytes: new Uint8Array([8, 255]), authInfoBytes: new Uint8Array([1]), chainId: 'alpha-1', accountNumber: 9007199254740993n }
  expect(direct.signDirect).toBe(signer.signDirect)
  expect(customDoc.bodyBytes).toEqual(new Uint8Array([8, 255]))
  expect(session.publicKey).toEqual(new Uint8Array([1]))
  expect(session.address).toBe(address)
})

it('rejects wallets without direct signing', async () => {
  window.keplr = { enable: vi.fn(), getKey: async () => ({ bech32Address: 'alpha1a', pubKey: new Uint8Array([1]), isNanoLedger: false }), getOfflineSigner: () => ({ getAccounts: async () => [], signAmino: vi.fn() }) }
  await expect(connectKeplr('alpha-1', 'alpha')).rejects.toThrow('SIGN_MODE_DIRECT')
})
