import { isOfflineDirectSigner } from '@cosmjs/proto-signing'
import type { OfflineDirectSigner, OfflineSigner } from '@cosmjs/proto-signing'
import { config } from '../../app/config'
import { isAccountAddress } from '../../lib/alpha/address'

interface KeplrProvider {
  experimentalSuggestChain(info: ReturnType<typeof alphaChainInfo>): Promise<void>
  enable(chainId: string): Promise<void>
  disable?(chainId: string): Promise<void>
  getOfflineSigner(chainId: string, options?: { preferNoSetFee?: boolean; preferNoSetMemo?: boolean; disableBalanceCheck?: boolean }): OfflineSigner
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

export function alphaChainInfo() {
  const fee = { coinDenom: config.feeDenom.toUpperCase(), coinMinimalDenom: config.feeDenom, coinDecimals: config.coinDecimals }
  const transfer = { coinDenom: config.transferDenom.toUpperCase(), coinMinimalDenom: config.transferDenom, coinDecimals: config.coinDecimals }
  const prefix = config.prefix
  return {
    chainId: config.chainId,
    chainName: config.chainName,
    rpc: new URL(config.rpcUrl, window.location.origin).href,
    rest: new URL(config.restUrl, window.location.origin).href,
    bip44: { coinType: config.coinType },
    bech32Config: {
      bech32PrefixAccAddr: prefix,
      bech32PrefixAccPub: `${prefix}pub`,
      bech32PrefixValAddr: `${prefix}valoper`,
      bech32PrefixValPub: `${prefix}valoperpub`,
      bech32PrefixConsAddr: `${prefix}valcons`,
      bech32PrefixConsPub: `${prefix}valconspub`,
    },
    stakeCurrency: fee,
    feeCurrencies: [fee],
    currencies: config.transferDenom === config.feeDenom ? [fee] : [transfer, fee],
  }
}

export async function connectKeplr(chainId: string, prefix: string): Promise<WalletSession> {
  const wallet = window.keplr
  if (!wallet) throw new Error('Keplr extension not found')
  await wallet.experimentalSuggestChain(alphaChainInfo())
  await wallet.enable(chainId)
  const key = await wallet.getKey(chainId)
  if (key.isNanoLedger) throw new Error('This Keplr account does not expose direct signing')
  const signer = wallet.getOfflineSigner(chainId, { preferNoSetFee: true, preferNoSetMemo: true, disableBalanceCheck: true })
  if (!isOfflineDirectSigner(signer)) throw new Error('Wallet does not support SIGN_MODE_DIRECT')
  const accounts = await signer.getAccounts()
  const account = accounts.find((item) => item.address === key.bech32Address)
  if (!account || !isAccountAddress(account.address, prefix) || account.algo !== 'secp256k1' || account.pubkey.length !== 33 || ![2, 3].includes(account.pubkey[0]) || account.pubkey.some((value, index) => value !== key.pubKey[index])) {
    throw new Error('Wallet account or address prefix does not match Alpha')
  }
  return { address: account.address, publicKey: account.pubkey, chainId, signer }
}

export async function disconnectKeplr(chainId: string): Promise<void> {
  await window.keplr?.disable?.(chainId)
}
