import { certificateFixture } from '../../lib/alpha/testFixture'
import { verifyCertificate } from '../../lib/alpha/certificate'
import type { SendDraft } from '../send/validation'
import type { Observation } from './matrix'

type Fixture = Awaited<ReturnType<typeof certificateFixture>>
export type ClientScenarioId = 'RECEIVER_TAMPER' | 'AMOUNT_TAMPER' | 'MEMO_TAMPER' | 'GAS_TAMPER' | 'FEE_TAMPER'

const changes: Record<ClientScenarioId, { field: keyof SendDraft; value: (fixture: Fixture) => string; rejection: string }> = {
  RECEIVER_TAMPER: { field: 'receiver', value: (fixture) => fixture.address, rejection: 'Certificate receiver mismatch' },
  AMOUNT_TAMPER: { field: 'amount', value: (fixture) => (BigInt(fixture.draft.amount) + 1n).toString(), rejection: 'Certificate amount mismatch' },
  MEMO_TAMPER: { field: 'memo', value: (fixture) => `${fixture.draft.memo}-changed`, rejection: 'Certificate memo mismatch' },
  GAS_TAMPER: { field: 'gasLimit', value: (fixture) => (BigInt(fixture.draft.gasLimit) + 1n).toString(), rejection: 'Certificate gas_limit mismatch' },
  FEE_TAMPER: { field: 'feeAmount', value: (fixture) => (BigInt(fixture.draft.feeAmount) + 1n).toString(), rejection: 'Certificate fee mismatch' },
}

export const clientScenarioIds = Object.keys(changes) as ClientScenarioId[]

export async function runClientScenario(id: ClientScenarioId): Promise<Observation> {
  try {
    const fixture = await certificateFixture()
    await verifyCertificate(fixture.response, fixture.draft, fixture.address, fixture.preflight)
    const change = changes[id]
    const modified = change.value(fixture)
    const evidence = {
      field: change.field === 'feeAmount' ? 'fee_amount' : change.field === 'gasLimit' ? 'gas_limit' : change.field,
      expected: change.field === 'feeAmount' ? `${fixture.draft.feeAmount} ${fixture.draft.feeDenom}` : fixture.draft[change.field],
      modified: change.field === 'feeAmount' ? `${modified} ${fixture.draft.feeDenom}` : modified,
    }
    try {
      await verifyCertificate(fixture.response, { ...fixture.draft, [change.field]: modified }, fixture.address, fixture.preflight)
      return { status: 'CLIENT_ACCEPTED', reason: 'Client guard accepted modified intent; no transaction was sent.', observedAt: new Date().toISOString(), ...evidence }
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : ''
      return reason === change.rejection
        ? { status: 'CLIENT_REJECTED', reason, observedAt: new Date().toISOString(), ...evidence }
        : { status: 'LOCAL_ERROR', reason: 'Client check stopped before proving the intended mismatch.', observedAt: new Date().toISOString(), ...evidence }
    }
  } catch {
    return { status: 'LOCAL_ERROR', reason: 'Synthetic fixture baseline could not be validated.', observedAt: new Date().toISOString() }
  }
}
