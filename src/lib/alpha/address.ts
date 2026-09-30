import { fromBech32 } from '@cosmjs/encoding'

export function isAccountAddress(address: string, prefix: string): boolean {
  try {
    const decoded = fromBech32(address, 90)
    return decoded.prefix === prefix && decoded.data.length === 20
  } catch { return false }
}
