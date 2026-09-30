import { useEffect, useState } from 'react'
import { config } from '../../app/config'
import { connectKeplr, disconnectKeplr } from './keplr'
import type { WalletSession } from './keplr'

interface Props {
  session: WalletSession | null
  onChange(session: WalletSession | null): void
}

export function WalletArea({ session, onChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const accountChanged = () => { onChange(null); setError('Wallet account changed. Reconnect to continue.') }
    window.addEventListener('keplr_keystorechange', accountChanged)
    return () => window.removeEventListener('keplr_keystorechange', accountChanged)
  }, [onChange])

  async function connect() {
    setBusy(true)
    setError('')
    try { onChange(await connectKeplr(config.chainId, config.prefix)) }
    catch (cause) { onChange(null); setError(cause instanceof Error ? cause.message : 'Wallet connection failed') }
    finally { setBusy(false) }
  }

  async function disconnect() {
    setBusy(true)
    try { await disconnectKeplr(config.chainId); onChange(null); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Wallet disconnect failed') }
    finally { setBusy(false) }
  }

  return <section className="panel" aria-labelledby="wallet-heading">
    <div className="section-heading"><div><p className="eyebrow">01 / Identity</p><h2 id="wallet-heading">Cosmos wallet</h2></div><span className={`status ${session ? 'good' : ''}`}>{session ? 'Connected' : 'Disconnected'}</span></div>
    <p className="muted">Keplr signs in your browser. This app never sees private keys.</p>
    {session && <dl className="facts"><div><dt>Address</dt><dd className="mono break">{session.address}</dd></div><div><dt>Selected chain</dt><dd className="mono">{session.chainId}</dd></div><div><dt>Signer</dt><dd>SIGN_MODE_DIRECT available</dd></div></dl>}
    <div className="actions"><button type="button" onClick={connect} disabled={busy}>{session ? 'Change account' : 'Connect Keplr'}</button>{session && <button type="button" className="secondary" onClick={disconnect} disabled={busy}>Disconnect</button>}</div>
    {error && <p className="error" role="alert">{error}</p>}
  </section>
}
