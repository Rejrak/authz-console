import { isOfflineDirectSigner } from '@cosmjs/proto-signing'
import type { OfflineDirectSigner, OfflineSigner } from '@cosmjs/proto-signing'

// Interchain Kit core exposes direct signing, but this install has no Keplr adapter.
// Keplr's native getOfflineSigner gives the exact capability without another package.
interface KeplrProvider {
  enable(chainId: string): Promise<void>
  disable?(chainId: string): Promise<void>
  getOfflineSigner(chainId: string): OfflineSigner
  getKey(chainId: string): Promise<{ bech32Address: string; pubKey: Uint8Array; isNanoLedger: boolean }>
}

declare global {
  interface Window { keplr?: KeplrProvider }
}

export interface WalletSession {
  address: string
  publicKey: Uint8Array
  chainId: string
  signer: OfflineDirectSigner
}

export async function connectKeplr(chainId: string, prefix: string): Promise<WalletSession> {
  const wallet = window.keplr
  if (!wallet) throw new Error('Keplr extension not found')
  await wallet.enable(chainId)
  const key = await wallet.getKey(chainId)
  if (key.isNanoLedger) throw new Error('This Keplr account does not expose direct signing')
  const signer = wallet.getOfflineSigner(chainId)
  if (!isOfflineDirectSigner(signer)) throw new Error('Wallet does not support SIGN_MODE_DIRECT')
  const accounts = await signer.getAccounts()
  const account = accounts.find((item) => item.address === key.bech32Address)
  if (!account || !account.address.startsWith(`${prefix}1`) || !account.pubkey.length) {
    throw new Error('Wallet account or address prefix does not match Alpha')
  }
  return { address: account.address, publicKey: account.pubkey, chainId, signer }
}

export async function disconnectKeplr(chainId: string): Promise<void> {
  await window.keplr?.disable?.(chainId)
}
