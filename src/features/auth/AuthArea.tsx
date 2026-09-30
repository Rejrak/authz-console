import { useState } from 'react'
import { useKeycloak } from './keycloak'

export function AuthArea({ auth }: { auth: ReturnType<typeof useKeycloak> }) {
  const [error, setError] = useState('')
  const authenticated = auth.status === 'authenticated'
  async function act() {
    try { if (authenticated) await auth.logout(); else await auth.login() }
    catch { setError('Keycloak could not complete authentication.') }
  }
  return <section className="panel" aria-labelledby="auth-heading">
    <div className="section-heading"><div><p className="eyebrow">02 / Access</p><h2 id="auth-heading">Keycloak</h2></div><span className={`status ${authenticated ? 'good' : ''}`}>{authenticated ? 'Authenticated' : auth.status === 'checking' ? 'Checking' : 'Disconnected'}</span></div>
    <p className="muted">Your public-client session authorizes certificate requests. Wallet ownership remains separate.</p>
    {authenticated && <dl className="facts"><div><dt>Username</dt><dd>{auth.username}</dd></div></dl>}
    {auth.status !== 'checking' && <button type="button" className={authenticated ? 'secondary' : ''} onClick={act}>{authenticated ? 'Sign out' : 'Sign in'}</button>}
    {(error || auth.status === 'error') && <p role="alert" className="error">{error || 'Keycloak is unavailable.'}</p>}
  </section>
}
