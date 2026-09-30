import { config } from '../../app/config'
import type { Preflight } from '../chain/preflight'
import type { WalletSession } from '../wallet/keplr'
import { validateDraft } from './validation'
import type { SendDraft } from './validation'

export function canRequestCertificate(authenticated: boolean, session: WalletSession | null, preflight: Preflight | undefined, draft: SendDraft): boolean {
  return authenticated && !!session && !!preflight && session.chainId === config.chainId && preflight.chainId === config.chainId && Object.keys(validateDraft(draft, config.prefix)).length === 0
}

export function certificateCurrent(accountNumber: string, sequence: string, validFromHeight: string, validUntilHeight: string, preflight: Preflight | undefined, address: string | undefined, issuedAddress: string): boolean {
  return !!preflight && address === issuedAddress && preflight.chainId === config.chainId && preflight.accountNumber === accountNumber && preflight.sequence === sequence && BigInt(preflight.height) >= BigInt(validFromHeight) && BigInt(preflight.height) <= BigInt(validUntilHeight)
}
