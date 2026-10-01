import { useState } from 'react'
import { clientScenarioIds, runClientScenario } from './clientChecks'
import type { ClientScenarioId } from './clientChecks'
import { layers, scenarios } from './matrix'
import type { Observation } from './matrix'

export default function SecurityPage() {
  const [observations, setObservations] = useState<Record<string, Observation>>({})
  const [running, setRunning] = useState<ClientScenarioId | null>(null)

  async function run(id: ClientScenarioId) {
    setRunning(id)
    try {
      const result = await runClientScenario(id)
      setObservations((current) => ({ ...current, [id]: result }))
    } finally {
      setRunning(null)
    }
  }

  return <div className="page">
    <header className="page-header"><p className="eyebrow">Authorization / V2 security</p><h1>Security matrix</h1><p className="muted">Expected enforcement is a test plan. Observed status changes only after a check runs.</p></header>
    <section className="panel security-intro" aria-labelledby="lab-scope"><h2 id="lab-scope">Phase 1 scope</h2><p>Five client checks use a synthetic local certificate fixture and the production certificate integrity guard. They prove only local mismatch rejection. This page makes no middleware request, wallet signature, or Alpha broadcast.</p><p className="muted">Synthetic issuer signatures are not quorum evidence. Alpha scenarios remain NOT_RUN until a separate controlled chain test records them.</p></section>
    <section className="security-section" aria-labelledby="layers-heading"><h2 id="layers-heading">Enforcement layers</h2><dl className="layer-list">{Object.entries(layers).map(([layer, description]) => <div key={layer}><dt>{layer}</dt><dd>{description}</dd></div>)}</dl></section>
    <section className="security-section" aria-labelledby="matrix-heading"><h2 id="matrix-heading">Scenarios</h2><ol className="security-matrix">{scenarios.map((scenario) => {
      const observed = observations[scenario.id] ?? scenario.observed
      const runnable = clientScenarioIds.includes(scenario.id as ClientScenarioId)
      return <li key={scenario.id} className="panel security-card">
        <div className="section-heading"><div><p className="eyebrow mono">{scenario.id}</p><h3>{scenario.title}</h3></div><span className={`status ${observed.status === scenario.expectedResult ? 'good' : observed.status === 'CLIENT_ACCEPTED' || observed.status === 'LOCAL_ERROR' ? 'bad' : ''}`}>{observed.status}</span></div>
        <p>{scenario.property}</p>
        <dl className="facts"><div><dt>Expected layer</dt><dd>{scenario.expectedLayer}</dd></div><div><dt>Expected class</dt><dd className="mono">{scenario.expectedResult}</dd></div></dl>
        {runnable && <button type="button" className="secondary" disabled={running !== null} onClick={() => run(scenario.id as ClientScenarioId)}>{running === scenario.id ? 'Running local check' : 'Run local check'}</button>}
        {observed.status !== 'NOT_RUN' && <div className="security-evidence" aria-live="polite"><p><strong>Observed:</strong> {observed.status}</p>{observed.field && <p><strong>Expected {observed.field}:</strong> <span className="mono break">{observed.expected}</span><br/><strong>Modified {observed.field}:</strong> <span className="mono break">{observed.modified}</span></p>}{observed.reason && <p><strong>Reason:</strong> {observed.reason}</p>}{observed.txHash && <p><strong>Tx hash:</strong> <span className="mono break">{observed.txHash}</span></p>}{observed.height && <p><strong>Height:</strong> {observed.height}</p>}{observed.observedAt && <p><strong>Observed at:</strong> <time dateTime={observed.observedAt}>{observed.observedAt}</time></p>}</div>}
      </li>
    })}</ol></section>
  </div>
}
