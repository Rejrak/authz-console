import { expect, it } from 'vitest'
import { parse } from 'protobufjs'
import { Root } from 'protobufjs/light'
import { toBase64 } from '@cosmjs/encoding'
import source from '../../../proto/alpha/authzattrs/v2/certificate.proto?raw'
import schema from './certificate.schema.json'
import { certificateFixture } from './testFixture'
import { sha256Hex, verifyCertificate } from './certificate'

it('generates descriptor from the frozen Alpha proto', async () => {
  expect(await sha256Hex(new TextEncoder().encode(source))).toBe('7fea3e733818f58978215e409f78acb121010c19ef4b3282fee465ec72f9028e')
  expect(schema).toEqual(parse(source).root.toJSON())
})

it('verifies canonical sign-doc digest and certificate intent', async () => {
  const fixture = await certificateFixture()
  const result = await verifyCertificate(fixture.response, fixture.draft, fixture.address, fixture.preflight)
  expect(result.digest).toBe(fixture.digest)
  expect(result.bytes).toEqual(fixture.bytes)
  expect(result.certificateBytesHash).not.toBe(result.digest)
  expect(result.policyId).toBe('policy-bank-send')
  expect(result.signatureCount).toBe(1)
})

it('rejects digest, intent, and sequence mismatch', async () => {
  const fixture = await certificateFixture()
  await expect(verifyCertificate({ ...fixture.response, certificate_digest: '0'.repeat(64) }, fixture.draft, fixture.address, fixture.preflight)).rejects.toThrow('digest mismatch')
  await expect(verifyCertificate(fixture.response, { ...fixture.draft, receiver: fixture.address }, fixture.address, fixture.preflight)).rejects.toThrow('receiver mismatch')
  await expect(verifyCertificate(fixture.response, fixture.draft, fixture.address, { ...fixture.preflight, sequence: '4' })).rejects.toThrow('sequence mismatch')
})

it('accepts canonical omitted zero fields', async () => {
  const fixture = await certificateFixture()
  const root = Root.fromJSON(schema)
  const type = root.lookupType('alpha.authzattrs.v2.AuthorizationCertificateV2')
  const signType = root.lookupType('alpha.authzattrs.v2.AuthorizationCertificateSignDocV2')
  const original = type.decode(fixture.bytes) as unknown as { signDoc: { intent: Record<string, unknown> }; signatures: unknown[] }
  const intent = { ...original.signDoc.intent }
  delete intent.accountNumber
  delete intent.sequence
  delete intent.timeoutHeight
  delete intent.memo
  const doc = { ...original.signDoc, intent }
  const bytes = type.encode({ signDoc: doc, signatures: original.signatures }).finish()
  const digest = await sha256Hex(signType.encode(doc).finish())
  const response = { ...fixture.response, certificate_bytes_base64: toBase64(bytes), certificate_digest: digest, account_number: '0', sequence: '0', intent: { ...fixture.response.intent, account_number: '0', sequence: '0', timeout_height: '0', memo: '' } }
  const draft = { ...fixture.draft, timeoutHeight: '0', memo: '' }
  const preflight = { ...fixture.preflight, accountNumber: '0', sequence: '0' }
  expect((await verifyCertificate(response, draft, fixture.address, preflight)).digest).toBe(digest)
})
