import { config } from '../../app/config'
import type { usePreflight } from './usePreflight'

export function PreflightArea({ address, query }: { address: string | null; query: ReturnType<typeof usePreflight> }) {
  return <section className="panel" aria-labelledby="chain-heading">
    <div className="section-heading"><div><p className="eyebrow">03 / Network</p><h2 id="chain-heading">Alpha preflight</h2></div><span className={`status ${query.isSuccess ? 'good' : ''}`}>{!address ? 'Waiting for wallet' : query.isPending ? 'Checking' : query.isError ? 'Unavailable' : 'Ready'}</span></div>
    {!address && <p className="muted">Connect Keplr to read chain and account state.</p>}
    {query.isError && <p className="error" role="alert">{query.error.message}</p>}
    {query.data && <dl className="facts"><div><dt>Detected chain</dt><dd className="mono">{query.data.chainId}</dd></div><div><dt>Latest height</dt><dd className="mono">{query.data.height}</dd></div><div><dt>Account number</dt><dd className="mono">{query.data.accountNumber}</dd></div><div><dt>Sequence</dt><dd className="mono">{query.data.sequence}</dd></div><div><dt>Balance ({config.transferDenom})</dt><dd className="mono">{query.data.balance ?? 'Unavailable'}</dd></div></dl>}
    {address && <button type="button" className="secondary" onClick={() => query.refetch()} disabled={query.isFetching}>Refresh preflight</button>}
  </section>
}
