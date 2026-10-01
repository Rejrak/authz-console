# V2 security matrix, phase 1

`/security` separates expected enforcement from observed results. All scenarios start
`NOT_RUN`. The five client checks run `verifyCertificate` against a synthetic local
fixture. They make no wallet, middleware, or Alpha request. The fixture does not
prove issuer signatures or quorum.

| Security property | Expected layer | Planned test mechanism |
| --- | --- | --- |
| Keycloak subject equals certificate subject | Middleware | Use a controlled public-client identity whose bound address differs; record the HTTP denial. |
| Receiver, amount, memo, gas, fee match certified intent | Client; Alpha CheckTx/Ante if bypassed | Run the local certificate guard with one modified draft field at a time. Later submit separately controlled invalid transactions to Alpha. |
| Sequence cannot replay | Alpha CheckTx/Ante | Reuse a previously consumed sequence in an isolated account test. |
| Certificate height window holds | Alpha CheckTx/Ante | Submit after `valid_until_height` in an isolated test. |
| Issuer signature is valid | Alpha CheckTx/Ante | Corrupt a test certificate signature, then submit in an isolated test. |
| Issuer quorum is sufficient | Alpha CheckTx/Ante | Submit a test certificate below the configured weight threshold. |
| Issuer is known and active | Alpha CheckTx/Ante | Use an unknown or inactive test issuer. |
| Policy ID, version, hash match | Alpha CheckTx/Ante | Vary each metadata field independently in isolated tests. |
| V2 extension is valid and unique | Alpha CheckTx/Ante | Test malformed bytes and two critical V2 options independently. |

Expected Alpha outcome is `CHECKTX_REJECTED`. A transaction that passes CheckTx
but fails after inclusion must be recorded as `INCLUDED_FAILED` at FinalizeBlock,
with its actual code and height. Only included code `0` is `INCLUDED_SUCCESS`.
No Alpha or middleware rejection is claimed until observed. Ante rejection may
have no `authz_v2_decision` event; never synthesize a `DENY` event.
