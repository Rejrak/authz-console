import { fromBase64 } from '@cosmjs/encoding'
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin'
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys'
import { SignMode } from 'cosmjs-types/cosmos/tx/signing/v1beta1/signing'
import { Any } from 'cosmjs-types/google/protobuf/any'
import { AuthInfo, SignDoc, TxBody, TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx'
import type { WalletSession } from '../../features/wallet/keplr'
import type { SendDraft } from '../../features/send/validation'
import type { VerifiedCertificate } from './certificate'

const certificateTypeUrl = '/alpha.authzattrs.v2.AuthorizationCertificateV2'

function equal(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

export function buildSignDoc(draft: SendDraft, session: WalletSession, certificate: VerifiedCertificate): SignDoc {
  if (session.address === '' || session.chainId !== certificate.chainId || session.publicKey.length !== 33) throw new Error('Unsupported wallet public key')
  const message = MsgSend.encode(MsgSend.fromPartial({
    fromAddress: session.address, toAddress: draft.receiver,
    amount: [Coin.fromPartial({ denom: draft.denom, amount: draft.amount })],
  })).finish()
  const bodyBytes = TxBody.encode(TxBody.fromPartial({
    messages: [Any.fromPartial({ typeUrl: '/cosmos.bank.v1beta1.MsgSend', value: message })],
    memo: draft.memo,
    timeoutHeight: BigInt(draft.timeoutHeight),
    extensionOptions: [Any.fromPartial({ typeUrl: certificateTypeUrl, value: certificate.bytes })],
    nonCriticalExtensionOptions: [],
    unordered: false,
  })).finish()
  const fees = draft.feeAmount === '0' ? [] : [Coin.fromPartial({ denom: draft.feeDenom, amount: draft.feeAmount })]
  const authInfoBytes = AuthInfo.encode(AuthInfo.fromPartial({
    signerInfos: [{
      publicKey: Any.fromPartial({ typeUrl: '/cosmos.crypto.secp256k1.PubKey', value: PubKey.encode(PubKey.fromPartial({ key: session.publicKey })).finish() }),
      modeInfo: { single: { mode: SignMode.SIGN_MODE_DIRECT } },
      sequence: BigInt(certificate.sequence),
    }],
    fee: { amount: fees, gasLimit: BigInt(draft.gasLimit), payer: '', granter: '' },
  })).finish()
  return SignDoc.fromPartial({ bodyBytes, authInfoBytes, chainId: certificate.chainId, accountNumber: BigInt(certificate.accountNumber) })
}

export async function signTxRaw(session: WalletSession, signDoc: SignDoc): Promise<Uint8Array> {
  const response = await session.signer.signDirect(session.address, signDoc)
  if (!equal(response.signed.bodyBytes, signDoc.bodyBytes) || !equal(response.signed.authInfoBytes, signDoc.authInfoBytes) || response.signed.chainId !== signDoc.chainId || String(response.signed.accountNumber) !== String(signDoc.accountNumber)) {
    throw new Error('Unsupported wallet signing path: Keplr changed the V2 transaction bytes. Nothing was broadcast.')
  }
  const signature = fromBase64(response.signature.signature)
  const returnedKey = fromBase64(response.signature.pub_key.value)
  if (signature.length !== 64 || !equal(returnedKey, session.publicKey)) throw new Error('Wallet signature or public key mismatch')
  return TxRaw.encode(TxRaw.fromPartial({ bodyBytes: signDoc.bodyBytes, authInfoBytes: signDoc.authInfoBytes, signatures: [signature] })).finish()
}
