import { config } from '../../app/config'

export interface Preflight {
  chainId: string
  height: string
  accountNumber: string
  sequence: string
  balance: string | null
}

const uint = /^(0|[1-9][0-9]*)$/
const maxUint64 = (1n << 64n) - 1n

export function uint64String(value: unknown): string {
  if (typeof value !== 'string' || !uint.test(value) || BigInt(value) > maxUint64) throw new Error('Invalid uint64 value from Alpha')
  return value
}

function baseAccount(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('Alpha account response is invalid')
  const account = value as Record<string, unknown>
  if ('account_number' in account && 'sequence' in account) return account
  return baseAccount(account.base_account ?? (account.base_vesting_account as Record<string, unknown> | undefined)?.base_account)
}

export function mapPreflight(status: unknown, accountResponse: unknown, balanceResponse: unknown, expectedChain: string): Preflight {
  const node = status as { result?: { node_info?: { network?: string }; sync_info?: { latest_block_height?: string } } }
  const chainId = node?.result?.node_info?.network
  if (!chainId || chainId !== expectedChain) throw new Error(`Alpha chain mismatch: expected ${expectedChain}, received ${chainId || 'unknown'}`)
  const account = baseAccount((accountResponse as { account?: unknown })?.account)
  const balance = (balanceResponse as { balance?: { amount?: unknown } })?.balance
  return {
    chainId,
    height: uint64String(node.result?.sync_info?.latest_block_height),
    accountNumber: uint64String(account.account_number),
    sequence: uint64String(account.sequence),
    balance: balance == null ? null : uint64String(balance.amount),
  }
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Alpha query failed (HTTP ${response.status})`)
  return response.json()
}

export async function fetchPreflight(address: string): Promise<Preflight> {
  const rpc = config.rpcUrl.replace(/\/$/, '')
  const rest = config.restUrl.replace(/\/$/, '')
  const [status, account, balance] = await Promise.all([
    getJson(`${rpc}/status`),
    getJson(`${rest}/cosmos/auth/v1beta1/accounts/${encodeURIComponent(address)}`),
    getJson(`${rest}/cosmos/bank/v1beta1/balances/${encodeURIComponent(address)}/by_denom?denom=${encodeURIComponent(config.transferDenom)}`).catch(() => null),
  ])
  return mapPreflight(status, account, balance, config.chainId)
}
