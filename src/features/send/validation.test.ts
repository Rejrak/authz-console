import { expect, it } from 'vitest'
import { validateDraft } from './validation'

it('validates bound fields as strings beyond JavaScript safe integers', () => {
  const draft = { receiver: `alpha1${'q'.repeat(38)}`, denom: 'stake', amount: '9007199254740993', feeAmount: '0', feeDenom: 'stake', gasLimit: '18446744073709551615', memo: '', timeoutHeight: '0' }
  expect(validateDraft(draft, 'alpha')).toEqual({})
  expect(validateDraft({ ...draft, amount: '1.5', gasLimit: '18446744073709551616', receiver: 'bad' }, 'alpha')).toMatchObject({ amount: expect.any(String), gasLimit: expect.any(String), receiver: expect.any(String) })
})
