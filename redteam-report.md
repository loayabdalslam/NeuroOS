# Neuro OS Ã¢â‚¬â€ red team report

Generated: 2026-11-08T15:01:32.715Z

Checks: **24** Ã‚Â· passed **24** Ã‚Â· failed **0**

## CRITICAL (0)

_none_
## HIGH (0)

_none_
## MEDIUM (0)

_none_
## LOW (0)

_none_
## All checks

| ID | Area | Severity | Result | Title |
| --- | --- | --- | --- | --- |
| M-01 | mail | low | PASS | Identity address format |
| M-02 | mail | medium | PASS | Hello endpoint never exposes private keys |
| M-03 | mail | high | PASS | Valid signed envelope is accepted |
| M-04 | mail | critical | PASS | Tampered ciphertext is rejected |
| M-05 | mail | critical | PASS | Sender nodeId spoofing is rejected |
| M-06 | mail | medium | PASS | Replay of the same envelope is ignored |
| M-08 | mail | high | PASS | Relayed message is delivered to the final recipient |
| M-09 | mail | medium | PASS | Inbound delivery is rate limited |
| M-10 | mail | medium | PASS | Oversized envelopes are rejected without killing the node |
| W-01 | web | high | PASS | Published site is served through the gateway |
| W-02 | web | high | PASS | Served HTML is sandboxed against the gateway origin |
| W-03 | web | high | PASS | Blobs are scoped to their manifest (no unauthenticated enumeration) |
| W-04 | web | high | PASS | Manifest nodeId must match the signing key |
| W-05 | web | critical | PASS | Domain claims require possession of the content |
| W-06 | web | medium | PASS | Announce only stores blobs referenced by the manifest |
| W-07 | web | high | PASS | Cross-origin announce is blocked |
| W-08 | web | high | PASS | Gateway blocks encoded path traversal |
| W-09 | web | critical | PASS | Folder publishing does not follow symlinks/junctions |
| W-10 | web | medium | PASS | Unpublish garbage-collects its blobs |
| W-11 | web | medium | PASS | Remote resolve does not claim domains locally |
| W-12 | web | medium | PASS | Invalid domains are rejected |
| W-13 | web | high | PASS | A claimed domain cannot be taken by another key |
| P-01 | protocol | critical | PASS | neuro:// asset protocol cannot escape the resources folder |
| X-01 | plugins | critical | PASS | Plugin vm cannot reach the host process |
