# Authz Console UI design

Status: design direction for first V2 send and result flow. No UI implementation yet.

## Direction

Quiet operations console: warm off-white canvas, charcoal text, deep teal actions, restrained amber warnings. Dense facts stay legible; no dashboard decoration, gradients, stock art, or glowing blockchain imagery. Layout follows the transaction lifecycle. Show what user signs, what issuers authorize, and what Alpha confirmed as distinct steps.

## Screens and hierarchy

- **Send:** page title and chain/wallet status; one column transfer form; adjacent summary on wide screens, below form on narrow screens. Show receiver, denomination, base-unit amount, fee, gas, memo, timeout. Label advanced fields clearly. Primary action: **Request certificate**.
- **Review and sign:** show immutable signed intent, policy ID/version, issuer set, certificate digest, validity height window, wallet address, and current chain height. Display expiry and mismatch as text near action. Primary action: **Sign transaction**. Disable signing when wallet, chain, intent, or validity checks fail.
- **Submission:** `Signing`, `Broadcast`, `Included`, `Failed` are separate textual states. Show transaction hash once known. Inclusion requires `code=0`; broadcast acceptance alone is not success. Show certificate digest and any `authz_v2_decision` fields. On stale sequence or expiry, offer **Start new request**.

Never call certificate issuance “transaction approved” before inclusion. Never show a failure as a committed `DENY` event when Ante emitted no event. No key, token, issuer signature, or raw Keycloak attribute display.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| Canvas | `#F5F4EF` | Page background |
| Surface | `#FFFFFF` | Forms, summaries |
| Ink | `#172321` | Primary text |
| Muted ink | `#485752` | Secondary text |
| Action | `#075E50` | Primary buttons and links |
| Warning | `#8A5500` | Expiry and caution text |
| Error | `#A12D2D` | Failed states |
| Line | `#D1D9D3` | Dividers and inputs |

Use semantic CSS custom properties, not hex literals inside components. Body font: `Source Sans 3` with sans-serif fallback. Technical values: `IBM Plex Mono` with monospace fallback. Avoid remote font dependency until needed; system fallbacks must remain readable. Body 16px/1.5, labels at least 14px, headings 24–32px. Use tabular numerals for heights, amounts, and hashes. Keep prose near 65 characters per line; wrap long hashes and addresses without clipping. Spacing follows 4px and 8px increments; controls have at least 44px touch area.

## Interaction and accessibility

Use semantic form fields, visible labels, native keyboard behavior, and visible `:focus-visible` outlines. Connect errors to inputs with `aria-describedby`; announce issuance and transaction status through a polite live region. Pair every color status with text. Check text contrast at WCAG AA: 4.5:1 normal, 3:1 large. At 200% zoom, forms stack and no value is hidden. Keep high-frequency state updates still; use only short, interruptible transitions for occasional panels, and honor `prefers-reduced-motion`. Wallet rejection, API denial, CheckTx rejection, and included failure need distinct actionable copy. Never automatically resubmit a signed transaction.

## Implementation boundary

Feature components own their screens. Local draft stays local. TanStack Query owns remote data. React Context is reserved for truly global client state. Reuse native form controls and existing packages; add visual primitives only when a real screen needs them.
