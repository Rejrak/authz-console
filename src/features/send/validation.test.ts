import { expect, it } from 'vitest'
import { toBech32 } from '@cosmjs/encoding'
import { validateDraft } from './validation'

it('validates bound fields as strings beyond JavaScript safe integers', () => {
  const draft = { receiver: toBech32('cosmos', new Uint8Array(20), 90), denom: 'token', amount: '9007199254740993', feeAmount: '0', feeDenom: 'stake', gasLimit: '18446744073709551615', memo: '', timeoutHeight: '0' }
  expect(validateDraft(draft, 'cosmos')).toEqual({})
  expect(validateDraft({ ...draft, amount: '1.5', gasLimit: '18446744073709551616', receiver: 'bad' }, 'cosmos')).toMatchObject({ amount: expect.any(String), gasLimit: expect.any(String), receiver: expect.any(String) })
})
