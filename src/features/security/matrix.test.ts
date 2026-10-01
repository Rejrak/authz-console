import { expect, it } from 'vitest'
import { clientScenarioIds } from './clientChecks'
import { layers, scenarios } from './matrix'
import sendSource from '../send/SendPage.tsx?raw'
import broadcastSource from '../../lib/alpha/broadcast.ts?raw'

it('defines fourteen distinct scenarios with expected layers and no fabricated observation', () => {
  expect(scenarios).toHaveLength(14)
  expect(new Set(scenarios.map((scenario) => scenario.id)).size).toBe(14)
  expect(Object.keys(layers)).toEqual(['Client', 'Middleware', 'Alpha CheckTx/Ante', 'FinalizeBlock'])
  for (const scenario of scenarios) {
    expect(layers[scenario.expectedLayer]).toBeTruthy()
    expect(scenario.property).toBeTruthy()
    expect(scenario.expectedResult).toBeTruthy()
    expect(scenario.observed).toEqual({ status: 'NOT_RUN' })
  }
  expect(scenarios.find((scenario) => scenario.id === 'KEYCLOAK_SUBJECT_MISMATCH')).toMatchObject({ expectedLayer: 'Middleware', expectedResult: 'MIDDLEWARE_REJECTED' })
  for (const id of clientScenarioIds) expect(scenarios.find((scenario) => scenario.id === id)).toMatchObject({ expectedLayer: 'Client', expectedResult: 'CLIENT_REJECTED' })
  for (const scenario of scenarios.filter((item) => item.expectedLayer === 'Alpha CheckTx/Ante')) expect(scenario.expectedResult).toBe('CHECKTX_REJECTED')
})

it('keeps adversarial checks out of SendPage and retains direct signing and one-broadcast path', () => {
  expect(sendSource).toContain("import { buildSignDoc, signTxRaw } from '../../lib/alpha/transaction'")
  expect(sendSource).toContain('broadcastAndConfirm(raw, value.digest)')
  expect(sendSource).not.toMatch(/features\/security|clientChecks|runClientScenario/)
  expect(broadcastSource).toContain("rpc('broadcast_tx_sync', { tx: toBase64(raw) })")
  expect(broadcastSource).not.toMatch(/features\/security|clientChecks|runClientScenario/)
})
