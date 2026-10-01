export type EnforcementLayer = 'Client' | 'Middleware' | 'Alpha CheckTx/Ante' | 'FinalizeBlock'
export type ResultClass = 'CLIENT_REJECTED' | 'MIDDLEWARE_REJECTED' | 'CHECKTX_REJECTED' | 'INCLUDED_FAILED' | 'INCLUDED_SUCCESS'
export type ObservedStatus = 'NOT_RUN' | ResultClass | 'CLIENT_ACCEPTED' | 'LOCAL_ERROR'

export interface Observation {
  status: ObservedStatus
  reason?: string
  field?: string
  expected?: string
  modified?: string
  txHash?: string
  observedAt?: string
  height?: string
}

export interface Scenario {
  id: string
  title: string
  property: string
  expectedLayer: EnforcementLayer
  expectedResult: ResultClass
  observed: Observation
}

const notRun = { status: 'NOT_RUN' } as const

export const scenarios: Scenario[] = [
  { id: 'KEYCLOAK_SUBJECT_MISMATCH', title: 'Subject binding', property: 'Authenticated identity must equal certificate subject.', expectedLayer: 'Middleware', expectedResult: 'MIDDLEWARE_REJECTED', observed: notRun },
  { id: 'RECEIVER_TAMPER', title: 'Receiver tamper', property: 'Certificate cannot authorize a different receiver.', expectedLayer: 'Client', expectedResult: 'CLIENT_REJECTED', observed: notRun },
  { id: 'AMOUNT_TAMPER', title: 'Amount tamper', property: 'Amount is bound to the certified intent.', expectedLayer: 'Client', expectedResult: 'CLIENT_REJECTED', observed: notRun },
  { id: 'MEMO_TAMPER', title: 'Memo tamper', property: 'Memo is transaction-bound.', expectedLayer: 'Client', expectedResult: 'CLIENT_REJECTED', observed: notRun },
  { id: 'GAS_TAMPER', title: 'Gas tamper', property: 'Gas limit is transaction-bound.', expectedLayer: 'Client', expectedResult: 'CLIENT_REJECTED', observed: notRun },
  { id: 'FEE_TAMPER', title: 'Fee tamper', property: 'Fee coin list is transaction-bound.', expectedLayer: 'Client', expectedResult: 'CLIENT_REJECTED', observed: notRun },
  { id: 'SEQUENCE_REPLAY', title: 'Sequence replay', property: 'An intent cannot be replayed after sequence advancement.', expectedLayer: 'Alpha CheckTx/Ante', expectedResult: 'CHECKTX_REJECTED', observed: notRun },
  { id: 'EXPIRED_CERTIFICATE', title: 'Expired certificate', property: 'Certificate must be valid at execution height.', expectedLayer: 'Alpha CheckTx/Ante', expectedResult: 'CHECKTX_REJECTED', observed: notRun },
  { id: 'INVALID_ISSUER_SIGNATURE', title: 'Invalid issuer signature', property: 'Issuer signatures must verify over the certified sign doc.', expectedLayer: 'Alpha CheckTx/Ante', expectedResult: 'CHECKTX_REJECTED', observed: notRun },
  { id: 'INSUFFICIENT_QUORUM', title: 'Insufficient quorum', property: 'Valid issuer weight must meet policy quorum.', expectedLayer: 'Alpha CheckTx/Ante', expectedResult: 'CHECKTX_REJECTED', observed: notRun },
  { id: 'UNKNOWN_OR_INACTIVE_ISSUER', title: 'Unknown or inactive issuer', property: 'Only active issuers in the selected set count.', expectedLayer: 'Alpha CheckTx/Ante', expectedResult: 'CHECKTX_REJECTED', observed: notRun },
  { id: 'POLICY_METADATA_MISMATCH', title: 'Policy metadata mismatch', property: 'Policy ID, version, and hash must match active policy.', expectedLayer: 'Alpha CheckTx/Ante', expectedResult: 'CHECKTX_REJECTED', observed: notRun },
  { id: 'MALFORMED_V2_EXTENSION', title: 'Malformed V2 extension', property: 'Critical certificate extension must decode correctly.', expectedLayer: 'Alpha CheckTx/Ante', expectedResult: 'CHECKTX_REJECTED', observed: notRun },
  { id: 'DUPLICATE_V2_EXTENSION', title: 'Duplicate V2 extension', property: 'TxBody must contain exactly one critical V2 certificate.', expectedLayer: 'Alpha CheckTx/Ante', expectedResult: 'CHECKTX_REJECTED', observed: notRun },
]

export const layers: Record<EnforcementLayer, string> = {
  Client: 'Local pre-sign integrity guard.',
  Middleware: 'Identity and issuance request validation.',
  'Alpha CheckTx/Ante': 'Chain admission and AnteHandler checks.',
  FinalizeBlock: 'Included transaction result; only code 0 is success.',
}
