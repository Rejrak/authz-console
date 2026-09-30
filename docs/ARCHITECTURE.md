# Authz Console architecture

Status: proposed frontend and API boundary. No console API exists yet. V2 chain protocol is implemented in Alpha; middleware currently exposes Go services and a CLI demo, not an HTTP issuer.

## Scope and authority

React, TypeScript, and Vite render one V2 direct bank send flow and its result. The browser proposes transfer facts and signs with the user's Cosmos wallet. A trusted server runs the existing middleware `CertificateIssuerV2.Issue`: it reads Keycloak attributes, evaluates policy, reads Alpha account state, selects policy and issuer set from server configuration, and signs with issuer keys. Issuer private keys and private material, plus Keycloak admin credentials, never reach the browser. Issuer signatures are part of the serialized `AuthorizationCertificateV2` returned to the browser; do not expose them separately as admin or observability data. Never let the browser choose `policy_id`, `policy_version`, `policy_hash`, `issuer_set_id`, issuer signatures, account number, or sequence as authority. Alpha consensus code is unchanged.

```text
Browser form + Cosmos wallet
    | proposed MsgSend, fee, gas, memo, timeout
    v
Authenticated issuer API -> existing CertificateIssuerV2 -> Keycloak + Alpha state + issuer keys
    | certificate bytes + signed intent
    v
Browser builds TxBody/AuthInfo -> wallet SIGN_MODE_DIRECT -> Alpha RPC broadcast/tx query
                                                        |
                                                        v
                                      Alpha V2 Ante verifies issuer + account signatures
```

The existing `V2OneTxService.IssueAndSubmitV2` and `BuildSignedV2Transaction` use a local Go keyring. They are a protocol reference, not a browser endpoint: server-side account signing would violate this console's wallet boundary. Reuse `CertificateIssuerV2.Issue` behind a small server adapter. Keep issuer secrets and Keycloak access there. Use Alpha's standard account query, CometBFT broadcast, and tx query surfaces; no new Alpha API for UI needs.

## Exact transaction path

1. Connect wallet and confirm Alpha chain ID and subject address. Collect receiver, one base-unit coin, fee coins, gas limit, memo, timeout height. Use integer strings for amounts and uint64 values; JavaScript numbers cannot safely represent all uint64 values.
2. POST proposed fields to issuer API. Server validates, fetches authoritative account number, sequence, and current height, evaluates policy, then returns an issued V2 certificate. The server must not accept a client-supplied policy or issuer selection.
3. Decode certificate bytes. Compare its signed intent with the form, connected address, expected chain, returned account state, fee, gas, memo, and timeout before showing wallet approval. Treat the signed intent as the exact transaction recipe. Abort on any mismatch or expired height; never silently edit bound fields.
4. Construct exactly one direct `/cosmos.bank.v1beta1.MsgSend` with exactly one coin. Put exactly one `Any` with type URL `/alpha.authzattrs.v2.AuthorizationCertificateV2` and the returned protobuf bytes in **critical** `TxBody.extension_options` (field 1023). Leave `non_critical_extension_options` empty. Set one signer, no fee payer/granter or tip, `unordered=false`, no timeout timestamp, and `SIGN_MODE_DIRECT`.
5. Ask wallet to sign the final `TxBody` and `AuthInfo` bytes, including the certificate option. Encode `TxRaw`; check decoded fields still match signed intent and option. Broadcast signed bytes once. Compare returned hash with local SHA-256 of `TxRaw`; poll tx result for inclusion and `code=0`.
6. If sequence is stale, certificate expires, wallet changes account, or a bound field changes, restart issuance. CheckTx acceptance is provisional. FinalizeBlock result is authoritative. Never retry by stripping the V2 option or signing a V1 transaction.

V2 permits only this direct `MsgSend` shape. No multi-send, `MsgExec`, IBC, WASM, multisig, or alternate sign mode. The certificate is height-bound, inclusive at both ends, and sequence-bound; presentation does not consume it. During V1/V2 coexistence, a transaction without V2 option may take the separate V1 route. The console always constructs V2 when using this flow. The exact critical option needs wallet support for signing arbitrary protobuf `SignDoc` bytes; validate this capability before implementation. Do not assume a generic wallet `sendTokens` helper preserves extension options.

## Frontend ownership

Use feature folders: `features/send` owns draft and signing flow; `features/activity` owns transaction result and decision display; `features/wallet` owns wallet connection. Shared `lib/` holds only protocol encoding and RPC helpers used by multiple features. TanStack Query owns issuance mutation, account/height/tx queries, and cache invalidation. Keep form draft and wallet approval state local to the send feature. React Context is only for genuinely app-wide client state if wallet provider needs it; do not mirror server state in Context. Query keys include chain ID and address. Never persist certificates, signatures, tokens, or transaction drafts in local storage.

## Minimum contracts to implement next

These are proposed HTTP shapes, not existing routes. Use Keycloak authorization-code login with PKCE for a public browser client, then validate its access token at the issuer API. The API must check audience and bind the authenticated user to the requested subject under server-side policy. Keycloak admin/service credentials stay server-side. Reject unauthenticated requests. Serve HTTPS and avoid caching certificate responses.

| Surface | Minimum contract |
| --- | --- |
| `POST /api/v2/certificates` | Bearer access token. Request: `subject`, `receiver`, `denom`, `amount`, `timeout_height`, `memo`, `fee_amount: [{denom, amount}]`, `gas_limit`. Decimal integers are strings. No policy, issuer, account number, sequence, or chain ID supplied as authority. |
| Successful response | `certificate_bytes_base64` (serialized `AuthorizationCertificateV2`), `certificate_digest` (lowercase SHA-256 hex), `intent` (signed intent with decimal integer strings), `valid_from_height`, `valid_until_height`, `account_number`, `sequence`, `chain_id`. The bytes remain the authoritative certificate; duplicates in JSON are for comparison and display. |
| Denial/error | HTTP status plus stable `{ code, message }`; policy denial includes existing `reason_code` when available. Never return Keycloak attributes, issuer private material, sign bytes, or raw internal errors. |
| Alpha standard APIs | Account number/sequence and latest height queries for preflight; CometBFT `broadcast_tx_sync` for signed bytes, `tx` for included result/events. RPC transport may be proxied for CORS, without changing consensus behavior. |

Use protocol protobuf definitions as the source of truth for certificate decoding. Do not hand-maintain a second certificate schema. The gateway should validate the exact returned shape and expose a version identifier such as `authz-protocol-v2.0.0` if multiple deployments coexist.

## Observability

On successful included V2 transactions, read Alpha `authz_v2_decision`: `subject`, `msg_type`, `policy_id`, `policy_version`, `issuer_set_id`, `certificate_digest`, `quorum_weight`, `signature_count`, `outcome=ALLOW`, `reason_code=AUTHZ_OK`, `height`. Correlate local digest with event digest and transaction hash. A failed Ante execution has no committed success event; show tx `code`, `codespace`, and stable `AUTHZ_V2_*` reason when available, never invent a DENY event. Issuer logs `v2_policy_evaluated`, `v2_certificate_built`, and `v2_certificate_signed` stay server-side. Existing CLI transaction logs `v2_tx_*` are not a console API. The browser should not receive raw logs, attributes, issuer signatures as separate observability data, or private keys.

## Sources inspected

- `spaghetti-netcode/docs/authz/protocol-v2-draft.md` and `docs/authz/observability-contract.md`
- `spaghetti-netcode/internal/authorization/{certificate_issuer_v2,tx_builder_v2,tx_flow_v2,tx_transport_v2}.go`
- `alpha/proto/alpha/authzattrs/v2/certificate.proto` and `alpha/x/authzattrs/ante/v2_certificate.go`
