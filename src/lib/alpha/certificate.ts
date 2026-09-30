import { fromBase64 } from '@cosmjs/encoding'
import { Root } from 'protobufjs/light'
import schema from './certificate.schema.json'
import { config } from '../../app/config'
import { uint64String } from '../../features/chain/preflight'
import { certificateRequest } from '../../features/send/certificateApi'
import type { SendDraft } from '../../features/send/validation'
import type { Preflight } from '../../features/chain/preflight'

const root = Root.fromJSON(schema)
const certificateType = root.lookupType('alpha.authzattrs.v2.AuthorizationCertificateV2')
const signDocType = root.lookupType('alpha.authzattrs.v2.AuthorizationCertificateSignDocV2')

type ObjectValue = Record<string, unknown>

function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid certificate response')
  return value as ObjectValue
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid certificate response')
  return value
}

function same(value: unknown, expected: string, field: string) {
  if (string(value) !== expected) throw new Error(`Certificate ${field} mismatch`)
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export interface VerifiedCertificate {
  bytes: Uint8Array
  digest: string
  certificateBytesHash: string
  protocolVersion: string
  policyId: string
  policyVersion: string
  issuerSetId: string
  validFromHeight: string
  validUntilHeight: string
  accountNumber: string
  sequence: string
  chainId: string
}

export async function verifyCertificate(responseValue: unknown, draft: SendDraft, address: string, preflight: Preflight): Promise<VerifiedCertificate> {
  const response = object(responseValue)
  same(response.protocol_version, 'authz-protocol-v2.0.0', 'protocol version')
  const digest = string(response.certificate_digest)
  if (!/^[0-9a-f]{64}$/.test(digest)) throw new Error('Invalid certificate digest')
  const bytes = fromBase64(string(response.certificate_bytes_base64))
  if (!bytes.length || bytes.length > 4096) throw new Error('Invalid certificate size')
  const decoded = certificateType.decode(bytes)
  if (certificateType.verify(decoded)) throw new Error('Invalid certificate protobuf')
  const encoded = certificateType.encode(decoded).finish()
  if (encoded.length !== bytes.length || !bytes.every((value, index) => encoded[index] === value)) throw new Error('Noncanonical certificate protobuf')
  const certificate = object(certificateType.toObject(decoded, { longs: String, bytes: Uint8Array, arrays: true, defaults: true }))
  const doc = object(certificate.signDoc)
  const intent = object(doc.intent)
  const responseIntent = object(response.intent)
  same(doc.domain, 'alpha.authzattrs.certificate.v2', 'domain')
  const policyId = string(doc.policyId)
  const policyVersion = uint64String(doc.policyVersion)
  const issuerSetId = uint64String(doc.issuerSetId)
  if (!policyId || policyVersion === '0' || issuerSetId === '0' || !(doc.policyHash instanceof Uint8Array) || doc.policyHash.length !== 32) throw new Error('Invalid certificate policy metadata')
  const validFromHeight = uint64String(doc.validFromHeight)
  const validUntilHeight = uint64String(doc.validUntilHeight)
  if (validFromHeight === '0' || BigInt(validUntilHeight) < BigInt(validFromHeight) || BigInt(preflight.height) < BigInt(validFromHeight) || BigInt(preflight.height) > BigInt(validUntilHeight)) throw new Error('Certificate outside valid height range')
  same(response.valid_from_height, validFromHeight, 'valid from height')
  same(response.valid_until_height, validUntilHeight, 'valid until height')
  const accountNumber = uint64String(response.account_number)
  const sequence = uint64String(response.sequence)
  same(accountNumber, preflight.accountNumber, 'account number')
  same(sequence, preflight.sequence, 'sequence')
  same(response.chain_id, config.chainId, 'chain ID')
  const expected = certificateRequest(draft, address)
  const fields = {
    chain_id: config.chainId, subject: address, receiver: expected.receiver,
    denom: expected.denom, amount: expected.amount,
    account_number: accountNumber, sequence, timeout_height: expected.timeout_height,
    memo: expected.memo, gas_limit: expected.gas_limit,
  }
  const wireFields: Record<keyof typeof fields, string> = {
    chain_id: 'chainId', subject: 'subject', receiver: 'receiver', denom: 'denom', amount: 'amount',
    account_number: 'accountNumber', sequence: 'sequence', timeout_height: 'timeoutHeight', memo: 'memo', gas_limit: 'gasLimit',
  }
  for (const [key, value] of Object.entries(fields) as [keyof typeof fields, string][]) {
    same(responseIntent[key], value, key)
    same(intent[wireFields[key]], value, key)
  }
  if (!Array.isArray(intent.feeAmount) || !Array.isArray(responseIntent.fee_amount)) throw new Error('Invalid certificate fees')
  const fees = intent.feeAmount.map((coin) => ({ denom: string(object(coin).denom), amount: string(object(coin).amount) }))
  const responseFees = responseIntent.fee_amount.map((coin) => ({ denom: string(object(coin).denom), amount: string(object(coin).amount) }))
  if (JSON.stringify(fees) !== JSON.stringify(expected.fee_amount) || JSON.stringify(responseFees) !== JSON.stringify(fees)) throw new Error('Certificate fee mismatch')
  const signatures = certificate.signatures as unknown[]
  if (!Array.isArray(signatures) || signatures.length < 1 || signatures.length > 16) throw new Error('Invalid certificate signatures')
  // Alpha defines certificate_digest over the canonical sign doc, not over the full signed certificate.
  const signBytes = signDocType.encode(object(decoded).signDoc as Record<string, unknown>).finish()
  if (await sha256Hex(signBytes) !== digest) throw new Error('Certificate digest mismatch')
  return { bytes, digest, certificateBytesHash: await sha256Hex(bytes), protocolVersion: string(response.protocol_version), policyId, policyVersion, issuerSetId, validFromHeight, validUntilHeight, accountNumber, sequence, chainId: config.chainId }
}
