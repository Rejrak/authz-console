import { expect, it, vi } from 'vitest'
import { toBase64 } from '@cosmjs/encoding'
import { broadcastAndConfirm } from './broadcast'
import { sha256Hex } from './certificate'

const raw = new Uint8Array([10, 20, 30])
const digest = 'a'.repeat(64)
const decision = { subject: 'cosmos1sender', msg_type: '/cosmos.bank.v1beta1.MsgSend', policy_id: 'p', policy_version: '1', issuer_set_id: '9', certificate_digest: digest, quorum_weight: '2', signature_count: '2', outcome: 'ALLOW', reason_code: 'AUTHZ_OK', height: '22' }

function included(hash: string, code = 0, eventDigest = digest) {
  return { result: { hash, tx: toBase64(raw), height: '22', tx_result: { code: String(code), codespace: code ? 'authzattrs' : '', log: code ? 'AUTHZ_V2_EXPIRED' : '', events: [{ type: 'authz_v2_decision', attributes: Object.entries({ ...decision, certificate_digest: eventDigest }).map(([key, value]) => ({ key, value })) }] } } }
}

it('broadcasts TxRaw once, waits for inclusion, and correlates event digest', async () => {
  const hash = (await sha256Hex(raw)).toUpperCase()
  let queries = 0
  const rpc = vi.fn(async (method: string) => method === 'broadcast_tx_sync'
    ? { result: { hash, code: '0' } }
    : ++queries === 1 ? { error: { message: 'tx not found' } } : included(hash))
  const wait = vi.fn(async () => {})
  expect(await broadcastAndConfirm(raw, digest, rpc, wait)).toMatchObject({ txHash: hash, height: '22', code: 0, decision: { certificate_digest: digest, outcome: 'ALLOW' } })
  expect(rpc.mock.calls.filter(([method]) => method === 'broadcast_tx_sync')).toHaveLength(1)
  expect(wait).toHaveBeenCalledTimes(1)
})

it('rejects nonzero included code and mismatched event digest', async () => {
  const hash = (await sha256Hex(raw)).toUpperCase()
  await expect(broadcastAndConfirm(raw, digest, async (method) => method === 'broadcast_tx_sync' ? { result: { hash, code: 0 } } : included(hash, 4))).rejects.toThrow('AUTHZ_V2_EXPIRED')
  await expect(broadcastAndConfirm(raw, digest, async (method) => method === 'broadcast_tx_sync' ? { result: { hash, code: 0 } } : included(hash, 0, 'b'.repeat(64)))).rejects.toThrow('digest mismatch')
  await expect(broadcastAndConfirm(raw, digest, async (method) => method === 'broadcast_tx_sync' ? { result: { hash, code: 0 } } : { result: { ...included(hash).result, tx: toBase64(new Uint8Array([1])) } })).rejects.toThrow('bytes mismatch')
})

it('stops after CheckTx rejection without querying inclusion', async () => {
  const hash = (await sha256Hex(raw)).toUpperCase()
  const rpc = vi.fn(async () => ({ result: { hash, code: 5, codespace: 'authzattrs', log: 'AUTHZ_V2_INVALID_CERTIFICATE' } }))
  await expect(broadcastAndConfirm(raw, digest, rpc)).rejects.toThrow('AUTHZ_V2_INVALID_CERTIFICATE')
  expect(rpc).toHaveBeenCalledTimes(1)
})
