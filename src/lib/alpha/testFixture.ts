import { toBase64, toBech32 } from '@cosmjs/encoding'
import { Root } from 'protobufjs/light'
import schema from './certificate.schema.json'
import { sha256Hex } from './certificate'

const root = Root.fromJSON(schema)
const certificateType = root.lookupType('alpha.authzattrs.v2.AuthorizationCertificateV2')
const signDocType = root.lookupType('alpha.authzattrs.v2.AuthorizationCertificateSignDocV2')

export async function certificateFixture() {
  const address = toBech32('cosmos', new Uint8Array(20).fill(1), 90)
  const receiver = toBech32('cosmos', new Uint8Array(20).fill(2), 90)
  const draft = { receiver, denom: 'token', amount: '9007199254740993', feeAmount: '2', feeDenom: 'stake', gasLimit: '200000', memo: 'research', timeoutHeight: '35' }
  const preflight = { chainId: 'alpha-1', height: '20', accountNumber: '9', sequence: '3', balance: '10000000000000000' }
  const intent = { chainId: 'alpha-1', subject: address, receiver, denom: 'token', amount: draft.amount, accountNumber: '9', sequence: '3', timeoutHeight: '35', memo: draft.memo, feeAmount: [{ denom: 'stake', amount: '2' }], gasLimit: '200000' }
  const signDoc = { domain: 'alpha.authzattrs.certificate.v2', intent, policyId: 'policy-bank-send', policyVersion: '1', policyHash: new Uint8Array(32).fill(3), issuerSetId: '9', validFromHeight: '10', validUntilHeight: '40' }
  const bytes = Uint8Array.from(certificateType.encode(certificateType.fromObject({ signDoc, signatures: [{ issuerId: 'issuer-1', signature: new Uint8Array(64).fill(4) }] })).finish())
  const digest = await sha256Hex(signDocType.encode(signDocType.fromObject(signDoc)).finish())
  const response = {
    protocol_version: 'authz-protocol-v2.0.0', certificate_bytes_base64: toBase64(bytes), certificate_digest: digest,
    intent: { chain_id: 'alpha-1', subject: address, receiver, denom: 'token', amount: draft.amount, account_number: '9', sequence: '3', timeout_height: '35', memo: draft.memo, fee_amount: [{ denom: 'stake', amount: '2' }], gas_limit: '200000' },
    valid_from_height: '10', valid_until_height: '40', account_number: '9', sequence: '3', chain_id: 'alpha-1',
  }
  return { address, draft, preflight, response, bytes, digest }
}
