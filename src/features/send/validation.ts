import { uint64String } from '../chain/preflight'
import { isAccountAddress } from '../../lib/alpha/address'

export interface SendDraft {
  receiver: string
  denom: string
  amount: string
  feeAmount: string
  feeDenom: string
  gasLimit: string
  memo: string
  timeoutHeight: string
}

export function validateDraft(draft: SendDraft, prefix: string): Partial<Record<keyof SendDraft, string>> {
  const errors: Partial<Record<keyof SendDraft, string>> = {}
  if (!isAccountAddress(draft.receiver, prefix)) errors.receiver = `Enter a valid ${prefix} bech32 address.`
  if (!draft.denom.trim()) errors.denom = 'Denom is required.'
  if (!draft.feeDenom.trim()) errors.feeDenom = 'Fee denom is required.'
  for (const field of ['amount', 'feeAmount'] as const) {
    const value = draft[field]
    if (value.length > 78 || !/^(0|[1-9][0-9]*)$/.test(value) || BigInt(value) > (1n << 256n) - 1n || (field === 'amount' && value === '0')) errors[field] = `${field === 'amount' ? 'Amount' : 'Fee amount'} must be ${field === 'amount' ? 'a positive' : 'a nonnegative'} integer.`
  }
  for (const field of ['gasLimit', 'timeoutHeight'] as const) {
    try {
      const value = uint64String(draft[field])
      if (field === 'gasLimit' && value === '0') throw new Error()
    } catch { errors[field] = `${field === 'timeoutHeight' ? 'Timeout height' : 'Gas limit'} must be ${field === 'gasLimit' ? 'a positive' : 'a nonnegative'} uint64 integer.` }
  }
  return errors
}
