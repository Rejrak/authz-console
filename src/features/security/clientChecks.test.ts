import { expect, it } from 'vitest'
import { clientScenarioIds, runClientScenario } from './clientChecks'

it.each(clientScenarioIds)('%s is rejected by the existing client certificate guard', async (id) => {
  const result = await runClientScenario(id)
  expect(result.status).toBe('CLIENT_REJECTED')
  expect(result.reason).toMatch(/^Certificate (receiver|amount|memo|gas_limit|fee) mismatch$/)
  expect(result.expected).not.toBe(result.modified)
  expect(result.observedAt).toBeTruthy()
  expect(result.txHash).toBeUndefined()
  expect(result.height).toBeUndefined()
})
