import Keycloak from 'keycloak-js'
import { useEffect, useState } from 'react'
import { config } from '../../app/config'

const client = new Keycloak({ url: config.keycloakUrl, realm: config.keycloakRealm, clientId: config.keycloakClientId })
let initialization: Promise<boolean> | undefined

export function useKeycloak() {
  const [status, setStatus] = useState<'checking' | 'authenticated' | 'disconnected' | 'error'>('checking')

  useEffect(() => {
    let active = true
    initialization ??= client.init({ onLoad: 'check-sso', flow: 'standard', pkceMethod: 'S256', checkLoginIframe: false, silentCheckSsoFallback: false })
    initialization.then((authenticated) => { if (active) setStatus(authenticated ? 'authenticated' : 'disconnected') })
      .catch(() => { if (active) setStatus('error') })
    client.onAuthSuccess = () => setStatus('authenticated')
    client.onAuthLogout = () => setStatus('disconnected')
    client.onAuthRefreshError = () => setStatus('disconnected')
    return () => { active = false }
  }, [])

  return {
    status,
    username: client.tokenParsed?.preferred_username || client.tokenParsed?.name || client.subject || '',
    login: () => client.login({ redirectUri: `${window.location.origin}/send` }),
    logout: () => client.logout({ redirectUri: `${window.location.origin}/send` }),
  }
}

export async function accessToken(): Promise<string> {
  if (!client.authenticated) throw new Error('Keycloak login required')
  try { await client.updateToken(30) }
  catch { throw new Error('Keycloak session expired. Sign in again.') }
  if (!client.token) throw new Error('Keycloak session expired. Sign in again.')
  return client.token
}
