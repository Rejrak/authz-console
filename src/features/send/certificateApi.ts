import { config } from '../../app/config'
import type { SendDraft } from './validation'

export function certificateRequest(draft: SendDraft, subject: string) {
  return {
    subject,
    receiver: draft.receiver,
    denom: draft.denom,
    amount: draft.amount,
    timeout_height: draft.timeoutHeight,
    memo: draft.memo,
    fee_amount: draft.feeAmount === '0' ? [] : [{ denom: draft.feeDenom, amount: draft.feeAmount }],
    gas_limit: draft.gasLimit,
  }
}

export async function requestCertificate(draft: SendDraft, subject: string, token: string): Promise<unknown> {
  const response = await fetch(`${config.apiUrl.replace(/\/$/, '')}/v2/certificates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(certificateRequest(draft, subject)),
    cache: 'no-store',
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { code?: unknown } | null
    const code = typeof body?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(body.code) ? body.code : 'REQUEST_FAILED'
    throw new Error(`Certificate request failed (${code}, HTTP ${response.status}).`)
  }
  return response.json()
}
