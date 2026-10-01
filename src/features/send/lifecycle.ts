export type StepState = 'waiting' | 'ready' | 'active' | 'complete' | 'failed'
export type StepId = 'wallet' | 'keycloak' | 'preflight' | 'intent' | 'issuance' | 'certificate' | 'quorum' | 'signing' | 'broadcast' | 'inclusion' | 'decision'
export type SendStage = 'draft' | 'requesting' | 'issued' | 'awaiting-signature' | 'signed' | 'broadcasting' | 'included' | 'failed'

export const stepLabels: Record<StepId, string> = {
  wallet: 'Cosmos wallet', keycloak: 'Keycloak authentication', preflight: 'Alpha preflight',
  intent: 'Authorization intent', issuance: 'Policy decision / issuance', certificate: 'Certificate metadata',
  quorum: 'Issuer quorum', signing: 'Wallet signing', broadcast: 'Broadcast / CheckTx',
  inclusion: 'Chain inclusion', decision: 'authz_v2_decision',
}

interface LifecycleInput {
  wallet: boolean
  authentication: 'checking' | 'authenticated' | 'disconnected' | 'error'
  preflight: 'waiting' | 'checking' | 'ready' | 'failed'
  intentValid: boolean
  canRequest: boolean
  certificate: boolean
  certificateCurrent: boolean
  signed: boolean
  stage: SendStage
  included: boolean
  failureAt: StepId | null
}

export function lifecycleSteps(input: LifecycleInput): { id: StepId; label: string; state: StepState }[] {
  const status: Record<StepId, StepState> = {
    wallet: input.wallet ? 'complete' : 'ready',
    keycloak: input.authentication === 'authenticated' ? 'complete' : input.authentication === 'checking' ? 'active' : input.authentication === 'error' ? 'failed' : 'ready',
    preflight: input.preflight === 'ready' ? 'complete' : input.preflight === 'checking' ? 'active' : input.preflight === 'failed' ? 'failed' : 'waiting',
    intent: input.certificate ? 'complete' : input.intentValid ? 'ready' : 'waiting',
    issuance: input.certificate ? 'complete' : input.stage === 'requesting' ? 'active' : input.canRequest ? 'ready' : 'waiting',
    certificate: input.certificate ? 'complete' : 'waiting',
    quorum: input.included ? 'complete' : input.certificate ? 'ready' : 'waiting',
    signing: input.signed || input.included ? 'complete' : input.stage === 'awaiting-signature' ? 'active' : input.certificate && input.certificateCurrent ? 'ready' : 'waiting',
    broadcast: input.included ? 'complete' : input.stage === 'broadcasting' ? 'active' : input.signed ? 'ready' : 'waiting',
    inclusion: input.included ? 'complete' : 'waiting',
    decision: input.included ? 'complete' : 'waiting',
  }
  if (input.failureAt) status[input.failureAt] = 'failed'
  return (Object.keys(stepLabels) as StepId[]).map((id) => ({ id, label: stepLabels[id], state: status[id] }))
}
