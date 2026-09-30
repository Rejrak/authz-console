import { useState } from 'react'
import { config } from '../../app/config'
import type { WalletSession } from '../wallet/keplr'
import { WalletArea } from '../wallet/WalletArea'
import { PreflightArea } from '../chain/PreflightArea'
import { validateDraft } from './validation'
import type { SendDraft } from './validation'

const fields: { key: keyof SendDraft; label: string; hint?: string }[] = [
  { key: 'receiver', label: 'Receiver address' },
  { key: 'denom', label: 'Denom' },
  { key: 'amount', label: 'Amount (base units)' },
  { key: 'feeAmount', label: 'Fee amount (base units)' },
  { key: 'feeDenom', label: 'Fee denom' },
  { key: 'gasLimit', label: 'Gas limit' },
  { key: 'memo', label: 'Memo', hint: 'Included in the signed intent.' },
  { key: 'timeoutHeight', label: 'Timeout height', hint: '0 means no transaction timeout; certificate still expires.' },
]

export function SendPage() {
  const [session, setSession] = useState<WalletSession | null>(null)
  const [draft, setDraft] = useState<SendDraft>({ receiver: '', denom: config.denom, amount: '', feeAmount: '0', feeDenom: config.denom, gasLimit: '', memo: '', timeoutHeight: '0' })
  const [touched, setTouched] = useState<Partial<Record<keyof SendDraft, boolean>>>({})
  const errors = validateDraft(draft, config.prefix)

  return <div className="page">
    <header className="page-header"><p className="eyebrow">Authorization / V2 bank send</p><h1>Prepare transfer</h1><p className="muted">Review every bound field before requesting a certificate. No transaction is sent from this page.</p></header>
    <div className="two-column"><WalletArea session={session} onChange={setSession}/><PreflightArea address={session?.address ?? null}/></div>
    <section className="panel send-panel" aria-labelledby="send-heading"><div className="section-heading"><div><p className="eyebrow">03 / Intent</p><h2 id="send-heading">Transaction fields</h2></div><span className="status">Draft only</span></div>
      <p className="muted">Receiver, amount, fee, gas, memo, timeout, account number, and sequence will be bound by the issuer certificate.</p>
      <form noValidate onSubmit={(event) => event.preventDefault()}><div className="form-grid">{fields.map(({ key, label, hint }) => <div className={`field ${key === 'receiver' || key === 'memo' ? 'wide' : ''}`} key={key}>
        <label htmlFor={key}>{label}</label><input id={key} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} onBlur={() => setTouched({ ...touched, [key]: true })} aria-invalid={!!(touched[key] && errors[key])} aria-describedby={touched[key] && errors[key] ? `${key}-error` : hint ? `${key}-hint` : undefined} inputMode={['amount', 'feeAmount', 'gasLimit', 'timeoutHeight'].includes(key) ? 'numeric' : undefined} autoComplete="off" />
        {hint && <small id={`${key}-hint`} className="muted">{hint}</small>}{touched[key] && errors[key] && <small id={`${key}-error`} className="error">{errors[key]}</small>}
      </div>)}</div><div className="form-footer"><button type="submit" disabled>Request certificate</button><p className="muted">Certificate API integration comes in UI-2. Form cannot submit yet.</p></div></form>
    </section>
  </div>
}
