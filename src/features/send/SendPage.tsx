import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { config } from '../../app/config'
import { AuthArea } from '../auth/AuthArea'
import { accessToken, useKeycloak } from '../auth/keycloak'
import { PreflightArea } from '../chain/PreflightArea'
import { usePreflight } from '../chain/usePreflight'
import { fetchPreflight } from '../chain/preflight'
import type { WalletSession } from '../wallet/keplr'
import { WalletArea } from '../wallet/WalletArea'
import { verifyCertificate } from '../../lib/alpha/certificate'
import type { VerifiedCertificate } from '../../lib/alpha/certificate'
import { broadcastAndConfirm } from '../../lib/alpha/broadcast'
import type { Inclusion } from '../../lib/alpha/broadcast'
import { buildSignDoc, signTxRaw } from '../../lib/alpha/transaction'
import { requestCertificate } from './certificateApi'
import { canRequestCertificate, certificateCurrent } from './gate'
import { validateDraft } from './validation'
import type { SendDraft } from './validation'
import { AuthorizationIntent, CertificateFacts, ChainVerification, LifecyclePanel } from './Observability'
import { lifecycleSteps } from './lifecycle'
import type { SendStage, StepId } from './lifecycle'

const fields: { key: keyof SendDraft; label: string; hint?: string }[] = [
  { key: 'receiver', label: 'Receiver address' },
  { key: 'denom', label: 'Transfer denom' },
  { key: 'amount', label: 'Amount (base units)' },
  { key: 'feeAmount', label: 'Fee amount (base units)' },
  { key: 'feeDenom', label: 'Fee denom' },
  { key: 'gasLimit', label: 'Gas limit' },
  { key: 'memo', label: 'Memo', hint: 'Included in the signed intent.' },
  { key: 'timeoutHeight', label: 'Timeout height', hint: '0 means no transaction timeout; certificate still expires.' },
]

export function SendPage() {
  const [session, setSession] = useState<WalletSession | null>(null)
  const sessionRef = useRef<WalletSession | null>(null)
  const [draft, setDraft] = useState<SendDraft>({ receiver: '', denom: config.transferDenom, amount: '', feeAmount: '0', feeDenom: config.feeDenom, gasLimit: '', memo: '', timeoutHeight: '0' })
  const draftRef = useRef(draft)
  const [touched, setTouched] = useState<Partial<Record<keyof SendDraft, boolean>>>({})
  const [certificate, setCertificate] = useState<{ value: VerifiedCertificate; address: string } | null>(null)
  const [stage, setStage] = useState<SendStage>('draft')
  const [error, setError] = useState('')
  const [failureAt, setFailureAt] = useState<StepId | null>(null)
  const [signed, setSigned] = useState(false)
  const [inclusion, setInclusion] = useState<Inclusion | null>(null)
  const broadcastAttempted = useRef(false)
  const [broadcasted, setBroadcasted] = useState(false)
  const auth = useKeycloak()
  const preflight = usePreflight(session?.address ?? null)
  const errors = validateDraft(draft, config.prefix)
  const current = certificate && certificateCurrent(certificate.value.accountNumber, certificate.value.sequence, certificate.value.validFromHeight, certificate.value.validUntilHeight, preflight.isSuccess ? preflight.data : undefined, session?.address, certificate.address)
  const canRequest = canRequestCertificate(auth.status === 'authenticated', session, preflight.isSuccess ? preflight.data : undefined, draft)

  const issue = useMutation({
    mutationFn: async ({ snapshot, wallet }: { snapshot: SendDraft; wallet: WalletSession }) => {
      const token = await accessToken()
      const response = await requestCertificate(snapshot, wallet.address, token)
      const latest = await fetchPreflight(wallet.address)
      return verifyCertificate(response, snapshot, wallet.address, latest)
    },
  })

  function changeWallet(next: WalletSession | null) {
    sessionRef.current = next
    setSession(next)
    setCertificate(null)
    setInclusion(null)
    setStage('draft')
    setError('')
    setFailureAt(null)
    setSigned(false)
    broadcastAttempted.current = false
    setBroadcasted(false)
  }

  function changeField(key: keyof SendDraft, value: string) {
    const next = { ...draftRef.current, [key]: value }
    draftRef.current = next
    setDraft(next)
    if (certificate) { setCertificate(null); setStage('draft'); setInclusion(null); setFailureAt(null); setSigned(false) }
  }

  async function request() {
    if (!canRequest || !session) return
    const wallet = session
    const snapshot = { ...draft }
    setStage('requesting')
    setError('')
    setFailureAt(null)
    try {
      const value = await issue.mutateAsync({ snapshot, wallet })
      if (sessionRef.current !== wallet || JSON.stringify(draftRef.current) !== JSON.stringify(snapshot)) throw new Error('Wallet or draft changed during certificate issuance')
      setCertificate({ value, address: wallet.address })
      setStage('issued')
    } catch (cause) {
      setCertificate(null)
      setStage('failed')
      setFailureAt('issuance')
      setError(cause instanceof Error ? cause.message : 'Certificate request failed')
    }
  }

  async function fresh(value: VerifiedCertificate, wallet: WalletSession) {
    if (sessionRef.current !== wallet) throw new Error('Wallet changed; request a new certificate')
    const latest = await fetchPreflight(wallet.address)
    if (!certificateCurrent(value.accountNumber, value.sequence, value.validFromHeight, value.validUntilHeight, latest, wallet.address, wallet.address)) throw new Error('Account sequence, chain, or certificate height changed; request a new certificate')
    const accounts = await wallet.signer.getAccounts()
    if (!accounts.some((account) => account.address === wallet.address)) throw new Error('Wallet account changed; request a new certificate')
  }

  async function signAndSubmit() {
    if (!certificate || !current || !session || auth.status !== 'authenticated' || broadcastAttempted.current) return
    const { value } = certificate
    const wallet = session
    setError('')
    setFailureAt(null)
    let stoppedAt: StepId = 'preflight'
    try {
      await fresh(value, wallet)
      stoppedAt = 'signing'
      const signDoc = buildSignDoc(draft, wallet, value)
      setStage('awaiting-signature')
      let raw: Uint8Array
      try { raw = await signTxRaw(wallet, signDoc) }
      catch (cause) {
        if (cause instanceof Error && cause.message.startsWith('Unsupported wallet signing path')) throw cause
        throw new Error('Wallet signing was rejected or failed. Nothing was broadcast.', { cause })
      }
      setStage('signed')
      setSigned(true)
      stoppedAt = 'preflight'
      await fresh(value, wallet)
      stoppedAt = 'broadcast'
      broadcastAttempted.current = true
      setBroadcasted(true)
      setStage('broadcasting')
      const result = await broadcastAndConfirm(raw, value.digest)
      setInclusion(result)
      setStage('included')
    } catch (cause) {
      setStage('failed')
      setFailureAt(stoppedAt)
      setError(cause instanceof Error ? cause.message : 'Transaction failed')
      if (cause instanceof Error && /changed|height/.test(cause.message)) setCertificate(null)
    }
  }

  function discard() {
    setCertificate(null)
    setInclusion(null)
    setStage('draft')
    setError('')
    setFailureAt(null)
    setSigned(false)
    broadcastAttempted.current = false
    setBroadcasted(false)
    preflight.refetch()
  }

  const lifecycle = auth.status === 'checking' ? 'Authenticating' : stage === 'draft' && session && preflight.isSuccess ? 'Wallet ready' : ({ draft: 'Draft', requesting: 'Requesting certificate', issued: 'Certificate issued', 'awaiting-signature': 'Awaiting wallet signature', signed: 'Signed', broadcasting: 'Broadcasting', included: 'Included', failed: 'Failed' } as const)[stage]
  const locked = !!certificate || stage === 'requesting' || stage === 'awaiting-signature' || stage === 'broadcasting' || stage === 'included'
  const steps = lifecycleSteps({
    wallet: !!session, authentication: auth.status,
    preflight: !session ? 'waiting' : preflight.isError ? 'failed' : preflight.isPending ? 'checking' : 'ready',
    intentValid: Object.keys(errors).length === 0, canRequest, certificate: !!certificate,
    certificateCurrent: !!current, signed, stage, included: !!inclusion, failureAt,
  })

  return <div className="page">
    <header className="page-header"><p className="eyebrow">Authorization / V2 bank send</p><h1>Prepare transfer</h1><p className="muted">Certificate, wallet signature, and chain inclusion are separate steps.</p><p className={`status ${stage === 'failed' ? 'bad' : stage === 'included' ? 'good' : ''}`} aria-live="polite">{lifecycle}</p></header>
    <LifecyclePanel steps={steps} failureAt={failureAt} error={error}/>
    <div className="two-column"><WalletArea session={session} onChange={changeWallet}/><AuthArea auth={auth}/></div>
    <div className="preflight-row"><PreflightArea address={session?.address ?? null} query={preflight}/></div>
    <section className="panel send-panel" aria-labelledby="send-heading"><div className="section-heading"><div><p className="eyebrow">04 / Intent</p><h2 id="send-heading">Transaction fields</h2></div><span className="status">{locked ? 'Bound' : 'Draft'}</span></div>
      <p className="muted">Receiver, amount, fee, gas, memo, timeout, account number, and sequence are bound by the certificate.</p>
      <form noValidate onSubmit={(event) => event.preventDefault()}><div className="form-grid">{fields.map(({ key, label, hint }) => <div className={`field ${key === 'receiver' || key === 'memo' ? 'wide' : ''}`} key={key}>
        <label htmlFor={key}>{label}</label><input id={key} value={draft[key]} disabled={locked} onChange={(event) => changeField(key, event.target.value)} onBlur={() => setTouched({ ...touched, [key]: true })} aria-invalid={!!(touched[key] && errors[key])} aria-describedby={touched[key] && errors[key] ? `${key}-error` : hint ? `${key}-hint` : undefined} inputMode={['amount', 'feeAmount', 'gasLimit', 'timeoutHeight'].includes(key) ? 'numeric' : undefined} autoComplete="off" />
        {hint && <small id={`${key}-hint`} className="muted">{hint}</small>}{touched[key] && errors[key] && <small id={`${key}-error`} className="error">{errors[key]}</small>}
      </div>)}</div><div className="form-footer"><button type="button" onClick={request} disabled={!canRequest || !!certificate || issue.isPending || stage === 'broadcasting' || stage === 'included'}>Request certificate</button>{!canRequest && <p className="muted">Connect Keplr, sign in, complete preflight, and enter valid fields.</p>}</div></form>
    </section>
    <AuthorizationIntent draft={draft} address={session?.address ?? null} preflight={preflight.isSuccess ? preflight.data : undefined} certificate={certificate?.value ?? null}/>
    {certificate && <section className="panel certificate-panel" aria-labelledby="certificate-heading"><div className="section-heading"><div><p className="eyebrow">05 / Certificate</p><h2 id="certificate-heading">Certificate issued off-chain</h2></div><span className={`status ${current || inclusion ? 'good' : ''}`}>{inclusion ? 'Verified on-chain' : current ? 'Current' : 'Stale'}</span></div>
      <p className="muted">{inclusion ? 'Alpha verified this certificate during transaction inclusion.' : 'Issuance is not transaction approval. Keplr must sign the exact V2 body before Alpha can include it.'}</p>
      <CertificateFacts certificate={certificate.value} inclusion={inclusion}/>
      {!current && !inclusion && <p className="error" role="alert">Account, chain, or height changed. Discard this certificate and request another.</p>}
      <div className="actions"><button type="button" onClick={signAndSubmit} disabled={!current || auth.status !== 'authenticated' || broadcasted || ['awaiting-signature', 'signed', 'broadcasting', 'included'].includes(stage)}>Sign and submit V2 transaction</button><button type="button" className="secondary" onClick={discard} disabled={stage === 'awaiting-signature' || stage === 'broadcasting'}>Discard certificate</button></div>
    </section>}
    {inclusion && <ChainVerification inclusion={inclusion} certificateDigest={certificate?.value.digest ?? null}/>}
  </div>
}
