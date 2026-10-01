import { config } from '../../app/config'
import type { Preflight } from '../chain/preflight'
import type { Inclusion } from '../../lib/alpha/broadcast'
import type { VerifiedCertificate } from '../../lib/alpha/certificate'
import type { SendDraft } from './validation'
import { lifecycleSteps, stepLabels } from './lifecycle'
import type { StepId } from './lifecycle'

export function LifecyclePanel({ steps, failureAt, error }: { steps: ReturnType<typeof lifecycleSteps>; failureAt: StepId | null; error: string }) {
  return <section className="panel lifecycle-panel" aria-labelledby="lifecycle-heading">
    <div className="section-heading"><div><p className="eyebrow">Protocol path</p><h2 id="lifecycle-heading">Transaction lifecycle</h2></div></div>
    <ol className="lifecycle-list">{steps.map(({ id, label, state }) => <li key={id} className={`lifecycle-step ${state}`}><div className="step-row"><span className="step-name">{label}</span><span className={`status ${state === 'complete' ? 'good' : state === 'failed' ? 'bad' : ''}`}>{state}</span></div></li>)}</ol>
    {failureAt && error && <p className="error lifecycle-error" role="alert">Stopped at {stepLabels[failureAt]}: {error}</p>}
  </section>
}

function Facts({ values }: { values: { label: string; value: string }[] }) {
  return <dl className="facts observation-facts">{values.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd className="mono break">{value}</dd></div>)}</dl>
}

export function AuthorizationIntent({ draft, address, preflight, certificate }: { draft: SendDraft; address: string | null; preflight?: Preflight; certificate: VerifiedCertificate | null }) {
  const value = (text: string) => text || '—'
  return <section className="panel observation-panel" aria-labelledby="intent-heading">
    <div className="section-heading"><div><p className="eyebrow">Signed scope</p><h2 id="intent-heading">Authorization intent</h2></div><span className={`status ${certificate ? 'good' : ''}`}>{certificate ? 'Certificate-bound' : 'Draft'}</span></div>
    <p className="muted">{certificate ? 'These fields match the locally verified certificate.' : 'Draft values become immutable after certificate issuance.'}</p>
    <Facts values={[
      { label: 'subject', value: address ?? '—' }, { label: 'receiver', value: value(draft.receiver) },
      { label: 'denom', value: draft.denom }, { label: 'amount', value: value(draft.amount) },
      { label: 'chain_id', value: certificate?.chainId ?? preflight?.chainId ?? config.chainId },
      { label: 'account_number', value: certificate?.accountNumber ?? preflight?.accountNumber ?? '—' },
      { label: 'sequence', value: certificate?.sequence ?? preflight?.sequence ?? '—' },
      { label: 'gas_limit', value: value(draft.gasLimit) },
      { label: 'fee', value: draft.feeAmount === '0' ? '0 (no fee coins)' : `${value(draft.feeAmount)} ${draft.feeDenom}` },
      { label: 'memo', value: draft.memo || '(empty)' }, { label: 'timeout_height', value: draft.timeoutHeight },
    ]}/>
  </section>
}

export function CertificateFacts({ certificate, inclusion }: { certificate: VerifiedCertificate; inclusion: Inclusion | null }) {
  return <>
    <Facts values={[
      { label: 'Protocol version', value: certificate.protocolVersion },
      { label: 'Policy ID', value: certificate.policyId }, { label: 'Policy version', value: certificate.policyVersion },
      { label: 'Issuer set ID', value: certificate.issuerSetId },
      { label: 'Valid heights', value: `${certificate.validFromHeight}–${certificate.validUntilHeight}` },
      { label: 'Certificate digest', value: certificate.digest },
      { label: 'Issuer signature count', value: String(certificate.signatureCount) },
    ]}/>
    <p className="muted">{inclusion ? `Quorum verified on-chain: weight ${inclusion.decision.quorum_weight}, ${inclusion.decision.signature_count} signatures.` : 'Issuer signatures are present. Alpha verifies quorum on inclusion.'}</p>
  </>
}

const decisionFields = ['subject', 'msg_type', 'policy_id', 'policy_version', 'issuer_set_id', 'certificate_digest', 'quorum_weight', 'signature_count', 'outcome', 'reason_code', 'height'] as const

export function ChainVerification({ inclusion, certificateDigest }: { inclusion: Inclusion; certificateDigest: string | null }) {
  const correlated = certificateDigest !== null && inclusion.decision.certificate_digest === certificateDigest
  return <section className="panel result-panel" aria-labelledby="result-heading">
    <p className="eyebrow">Chain verification</p><h2 id="result-heading">Included at height {inclusion.height}</h2>
    <p className="muted">Alpha included this transaction with code {inclusion.code} and emitted authz_v2_decision.</p>
    <Facts values={[{ label: 'Transaction hash', value: inclusion.txHash }, { label: 'Code', value: String(inclusion.code) }, ...decisionFields.map((label) => ({ label, value: inclusion.decision[label] ?? 'Missing' }))]}/>
    {correlated ? <div className="digest-correlation" role="status"><span>Certificate digest<br/><strong className="mono break">{certificateDigest}</strong></span><strong aria-label="equals">=</strong><span>On-chain decision digest<br/><strong className="mono break">{inclusion.decision.certificate_digest}</strong></span><p>Digest match verified</p></div>
      : <p className="error" role="alert">Certificate digest correlation is unavailable or mismatched.</p>}
  </section>
}
