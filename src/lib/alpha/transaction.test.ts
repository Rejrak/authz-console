import { expect, it } from 'vitest'
import { fromBase64, toBase64 } from '@cosmjs/encoding'
import type { OfflineDirectSigner } from '@cosmjs/proto-signing'
import { Reader } from 'protobufjs/minimal'
import { AuthInfo, TxBody, TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import type { WalletSession } from '../../features/wallet/keplr'
import { certificateFixture } from './testFixture'
import { verifyCertificate } from './certificate'
import { buildSignDoc, signTxRaw } from './transaction'

function wallet(address: string, signer: OfflineDirectSigner): WalletSession {
  return { address, chainId: 'alpha-1', publicKey: new Uint8Array([2, ...new Uint8Array(32)]), signer }
}

it('encodes one critical V2 option and exact signer, fee, gas, and sequence', async () => {
  const fixture = await certificateFixture()
  const certificate = await verifyCertificate(fixture.response, fixture.draft, fixture.address, fixture.preflight)
  const session = wallet(fixture.address, { getAccounts: async () => [], signDirect: async () => { throw Error('unused') } })
  const doc = buildSignDoc(fixture.draft, session, certificate)
  const body = TxBody.decode(doc.bodyBytes)
  const auth = AuthInfo.decode(doc.authInfoBytes)
  expect(body.messages).toHaveLength(1)
  expect(body.messages[0].typeUrl).toBe('/cosmos.bank.v1beta1.MsgSend')
  expect(body.extensionOptions).toHaveLength(1)
  expect(body.extensionOptions[0].typeUrl).toBe('/alpha.authzattrs.v2.AuthorizationCertificateV2')
  expect(body.extensionOptions[0].value).toEqual(fixture.bytes)
  expect(body.nonCriticalExtensionOptions).toEqual([])
  expect(body.memo).toBe('research')
  expect(body.timeoutHeight).toBe(35n)
  expect(body.unordered).toBe(false)
  expect(body.timeoutTimestamp).toBeUndefined()
  const reader = Reader.create(doc.bodyBytes)
  const fields: number[] = []
  while (reader.pos < reader.len) { const tag = reader.uint32(); fields.push(tag >>> 3); reader.skipType(tag & 7) }
  expect(fields.filter((field) => field === 1023)).toHaveLength(1)
  expect(fields).not.toContain(2047)
  expect(auth.signerInfos).toHaveLength(1)
  expect(auth.signerInfos[0].sequence).toBe(3n)
  expect(auth.signerInfos[0].modeInfo?.single?.mode).toBe(1)
  expect(auth.fee?.amount).toEqual([{ denom: 'stake', amount: '2' }])
  expect(auth.fee?.gasLimit).toBe(200000n)
  expect(auth.fee?.payer).toBe('')
  expect(auth.fee?.granter).toBe('')
  expect(auth.tip).toBeUndefined()
  expect(doc.accountNumber).toBe(9n)
})

it('aborts when Keplr mutates body bytes or rejects', async () => {
  const fixture = await certificateFixture()
  const certificate = await verifyCertificate(fixture.response, fixture.draft, fixture.address, fixture.preflight)
  const key = new Uint8Array([2, ...new Uint8Array(32)])
  const signature = { pub_key: { type: 'tendermint/PubKeySecp256k1', value: toBase64(key) }, signature: toBase64(new Uint8Array(64)) }
  const changed = wallet(fixture.address, { getAccounts: async () => [], signDirect: async (_, doc) => ({ signed: { ...doc, bodyBytes: new Uint8Array([8]) }, signature }) })
  await expect(signTxRaw(changed, buildSignDoc(fixture.draft, changed, certificate))).rejects.toThrow('changed the V2 transaction bytes')
  const rejected = wallet(fixture.address, { getAccounts: async () => [], signDirect: async () => { throw Error('user rejected') } })
  await expect(signTxRaw(rejected, buildSignDoc(fixture.draft, rejected, certificate))).rejects.toThrow('user rejected')
  const accepted = wallet(fixture.address, { getAccounts: async () => [], signDirect: async (_, doc) => ({ signed: doc, signature }) })
  const raw = await signTxRaw(accepted, buildSignDoc(fixture.draft, accepted, certificate))
  expect(TxRaw.decode(raw).bodyBytes).toEqual(buildSignDoc(fixture.draft, accepted, certificate).bodyBytes)
  expect(fromBase64(signature.signature)).toHaveLength(64)
})
