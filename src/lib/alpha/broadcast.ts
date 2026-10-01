import { fromBase64, toBase64, fromHex } from '@cosmjs/encoding'
import { config } from '../../app/config'
import { sha256Hex } from './certificate'

type Rpc = (method: string, params: Record<string, unknown>) => Promise<unknown>

export async function alphaRpc(method: string, params: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(config.rpcUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!response.ok) throw new Error(`Alpha RPC unavailable (HTTP ${response.status})`)
  return response.json()
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Alpha RPC response')
  return value as Record<string, unknown>
}

function code(value: unknown): number {
  if ((typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffffff) || (typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value) && BigInt(value) <= 0xffffffffn)) return Number(value)
  throw new Error('Invalid Alpha transaction code')
}

function failure(code: number, codespace: unknown, log: unknown): Error {
  const reason = typeof log === 'string' ? log.match(/AUTHZ_V2_[A-Z_]+/)?.[0] : undefined
  return new Error(`Transaction failed (code ${code}${typeof codespace === 'string' && codespace ? `, codespace ${codespace}` : ''}${reason ? `, ${reason}` : ''}).`)
}

export interface DecisionEvent { [key: string]: string }
export interface Inclusion {
  txHash: string
  height: string
  code: number
  decision: DecisionEvent
}

export async function broadcastAndConfirm(raw: Uint8Array, digest: string, rpc: Rpc = alphaRpc, wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))): Promise<Inclusion> {
  const hash = (await sha256Hex(raw)).toUpperCase()
  const broadcast = object(await rpc('broadcast_tx_sync', { tx: toBase64(raw) }))
  if (broadcast.error) throw new Error('Alpha broadcast failed')
  const check = object(broadcast.result)
  if (typeof check.hash !== 'string' || check.hash.toUpperCase() !== hash) throw new Error('Broadcast hash mismatch')
  const checkCode = code(check.code)
  if (checkCode !== 0) throw failure(checkCode, check.codespace, check.log)
  for (let attempt = 0; attempt < 20; attempt++) {
    const hashBytes = fromHex(hash.toLowerCase())

    const answer = object(
      await rpc('tx', {
        hash: toBase64(hashBytes),
        prove: false,
      }),
    )
    if (answer.error) {
      const error = object(answer.error)
      const detail = `${typeof error.message === 'string' ? error.message : ''} ${typeof error.data === 'string' ? error.data : ''}`
      if (!detail.toLowerCase().includes('not found')) throw new Error('Alpha transaction query failed')
    } else {
      const included = object(answer.result)
      if (typeof included.hash !== 'string' || included.hash.toUpperCase() !== hash) throw new Error('Included transaction hash mismatch')
      if (typeof included.tx !== 'string' || toBase64(fromBase64(included.tx)) !== toBase64(raw)) throw new Error('Included transaction bytes mismatch')
      const result = object(included.tx_result)
      const includedCode = code(result.code)
      if (includedCode !== 0) throw failure(includedCode, result.codespace, result.log)
      const events = Array.isArray(result.events) ? result.events : []
      const event = events.map(object).find((item) => item.type === 'authz_v2_decision')
      if (!event || !Array.isArray(event.attributes)) throw new Error('Included V2 decision event missing')
      const decision: DecisionEvent = {}
      for (const attribute of event.attributes.map(object)) {
        if (typeof attribute.key === 'string' && typeof attribute.value === 'string') decision[attribute.key] = attribute.value
      }
      for (const field of ['subject', 'msg_type', 'policy_id', 'policy_version', 'issuer_set_id', 'certificate_digest', 'quorum_weight', 'signature_count', 'outcome', 'reason_code', 'height']) {
        if (!decision[field]) throw new Error('Included V2 decision event incomplete')
      }
      if (decision.certificate_digest !== digest) throw new Error('Included certificate digest mismatch')
      if (decision.outcome !== 'ALLOW' || decision.reason_code !== 'AUTHZ_OK') throw new Error('Included V2 decision is not an allow')
      if (typeof included.height !== 'string' || !/^[1-9][0-9]*$/.test(included.height)) throw new Error('Invalid inclusion height')
      if (decision.height !== included.height) throw new Error('Included V2 decision height mismatch')
      return { txHash: hash, height: included.height, code: includedCode, decision }
    }
    if (attempt < 19) await wait(2000)
  }
  throw new Error(`Broadcast accepted; inclusion not found yet. Transaction hash: ${hash}`)
}
