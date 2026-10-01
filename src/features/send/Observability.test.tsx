// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AuthorizationIntent, CertificateFacts, ChainVerification, LifecyclePanel } from './Observability'
import { lifecycleSteps } from './lifecycle'
import type { VerifiedCertificate } from '../../lib/alpha/certificate'
import type { Inclusion } from '../../lib/alpha/broadcast'

afterEach(cleanup)

const digest = 'a'.repeat(64)
const certificate: VerifiedCertificate = {
  bytes: new TextEncoder().encode('raw-certificate-secret-marker'),
  certificateBytesHash: 'b'.repeat(64), digest,
  protocolVersion: 'authz-protocol-v2.0.0', policyId: 'policy-bank-send', policyVersion: '1',
  issuerSetId: '9', signatureCount: 2, validFromHeight: '100', validUntilHeight: '200',
  accountNumber: '18', sequence: '0', chainId: 'alpha-1',
}
const inclusion: Inclusion = {
  txHash: '9EA0A8', height: '15634', code: 0,
  decision: {
    subject: 'cosmos1subject', msg_type: '/cosmos.bank.v1beta1.MsgSend', policy_id: 'policy-bank-send',
    policy_version: '1', issuer_set_id: '9', certificate_digest: digest, quorum_weight: '5',
    signature_count: '2', outcome: 'ALLOW', reason_code: 'AUTHZ_OK', height: '15634',
    access_token: 'raw-token-secret-marker', wallet_signature: 'raw-signature-secret-marker',
  },
}

const base = {
  wallet: false, authentication: 'disconnected' as const, preflight: 'waiting' as const,
  intentValid: false, canRequest: false, certificate: false, certificateCurrent: false,
  signed: false, stage: 'draft' as const, included: false, failureAt: null,
}

function state(steps: ReturnType<typeof lifecycleSteps>, id: string) {
  return steps.find((step) => step.id === id)?.state
}

it('maps real lifecycle milestones without marking issuer quorum verified before inclusion', () => {
  const draft = lifecycleSteps(base)
  expect(state(draft, 'wallet')).toBe('ready')
  expect(state(draft, 'inclusion')).toBe('waiting')
  const ready = lifecycleSteps({ ...base, wallet: true, authentication: 'authenticated', preflight: 'ready', intentValid: true, canRequest: true })
  expect(state(ready, 'issuance')).toBe('ready')
  const requesting = lifecycleSteps({ ...base, wallet: true, authentication: 'authenticated', preflight: 'ready', stage: 'requesting' })
  expect(state(requesting, 'issuance')).toBe('active')
  const issued = lifecycleSteps({ ...base, wallet: true, authentication: 'authenticated', preflight: 'ready', certificate: true, certificateCurrent: true, stage: 'issued' })
  expect(state(issued, 'certificate')).toBe('complete')
  expect(state(issued, 'quorum')).toBe('ready')
  expect(state(issued, 'signing')).toBe('ready')
  expect(state(lifecycleSteps({ ...base, certificate: true, stage: 'awaiting-signature' }), 'signing')).toBe('active')
  expect(state(lifecycleSteps({ ...base, signed: true, stage: 'broadcasting' }), 'broadcast')).toBe('active')
  const included = lifecycleSteps({ ...base, certificate: true, signed: true, stage: 'included', included: true })
  for (const id of ['quorum', 'signing', 'broadcast', 'inclusion', 'decision']) expect(state(included, id)).toBe('complete')
})

it('shows bound intent and certificate metadata without raw certificate or signatures', () => {
  render(<><AuthorizationIntent draft={{ receiver: 'cosmos1receiver', denom: 'token', amount: '9007199254740993', feeAmount: '0', feeDenom: 'stake', gasLimit: '200000', memo: '', timeoutHeight: '0' }} address="cosmos1subject" certificate={certificate}/><CertificateFacts certificate={certificate} inclusion={null}/></>)
  expect(screen.getByText('Certificate-bound')).toBeTruthy()
  expect(screen.getByText('9007199254740993')).toBeTruthy()
  expect(screen.getByText('0 (no fee coins)')).toBeTruthy()
  expect(screen.getByText('Issuer signature count').nextElementSibling?.textContent).toBe('2')
  expect(screen.getByText('Valid heights').nextElementSibling?.textContent).toBe('100–200')
  expect(screen.getByText('Issuer signatures are present. Alpha verifies quorum on inclusion.')).toBeTruthy()
  expect(document.body.textContent).not.toContain('raw-certificate-secret-marker')
})

it('shows included decision, verified digest equality, and on-chain quorum without extra event fields', () => {
  render(<><CertificateFacts certificate={certificate} inclusion={inclusion}/><ChainVerification inclusion={inclusion} certificateDigest={digest}/></>)
  expect(screen.getByText('Quorum verified on-chain: weight 5, 2 signatures.')).toBeTruthy()
  expect(screen.getByText('Included at height 15634')).toBeTruthy()
  expect(screen.getByText('Digest match verified')).toBeTruthy()
  expect(screen.getByLabelText('equals')).toBeTruthy()
  expect(screen.getByText('AUTHZ_OK')).toBeTruthy()
  expect(screen.getByText('9EA0A8')).toBeTruthy()
  expect(document.body.textContent).not.toContain('raw-token-secret-marker')
  expect(document.body.textContent).not.toContain('raw-signature-secret-marker')
})

it('shows stopped stage and never asserts an unverified digest match', () => {
  const steps = lifecycleSteps({ ...base, stage: 'failed', failureAt: 'signing', certificate: true })
  expect(state(steps, 'signing')).toBe('failed')
  render(<><LifecyclePanel steps={steps} failureAt="signing" error="Wallet rejected signing. Nothing was broadcast."/><ChainVerification inclusion={inclusion} certificateDigest={'b'.repeat(64)}/></>)
  expect(screen.getByText(/Stopped at Wallet signing: Wallet rejected signing/)).toBeTruthy()
  expect(screen.queryByText('Digest match verified')).toBeNull()
  expect(screen.queryByLabelText('equals')).toBeNull()
  expect(screen.getByText('Certificate digest correlation is unavailable or mismatched.')).toBeTruthy()
})
