# Neuro OS — red-team report

**Date:** 2026-11-06
**Target:** Neuro OS 1.0 (Electron 33, main-process services)
**Focus:** decentralized domains (Neuro Web) and peer-to-peer mail, plus protocol/plugin/system surfaces.
**Harness:** `src/main/redteam.ts` — boots real `MailService` / `WebService` instances on ephemeral ports with isolated JSON stores and key vaults, then attacks them over HTTP exactly like a hostile peer would.

Run it:

```powershell
npx electron-vite build
.\node_modules\electron\dist\electron.exe . --redteam --user-data-dir="$env:TEMP\neuro-redteam"
# writes redteam-report.md + redteam-report.json
```

## Summary

| | |
| --- | --- |
| Checks executed | **24** |
| Passed | **23** |
| Open failures | **1 critical** (plugin sandbox) |
| Fixed during the audit | **10** (mail relay, rate limit, domain proof, nodeId binding, CSP, blob scoping, origin check, symlink leak, blob GC, remote-claim poisoning, protocol traversal) |

The mail and domain layers held up on the fundamentals — signatures, tamper detection, identity binding, replay on a live node and domain ownership by key — but the audit found real bugs in store-and-forward, domain claiming, blob access, and the plugin sandbox.

## Results

| ID | Area | Severity | Result | Check |
| --- | --- | --- | --- | --- |
| M-01 | mail | low | PASS | Identity address format |
| M-02 | mail | medium | PASS | Hello never exposes private keys |
| M-03 | mail | high | PASS | Valid signed envelope accepted |
| M-04 | mail | critical | PASS | Tampered ciphertext rejected |
| M-05 | mail | critical | PASS | Sender nodeId spoofing rejected |
| M-06 | mail | medium | PASS | Replay ignored on a live node |
| M-08 | mail | high | PASS | Relayed message reaches the final recipient (was broken) |
| M-09 | mail | medium | PASS | Inbound delivery is rate limited (was unlimited) |
| M-10 | mail | medium | PASS | Oversized envelopes rejected, node survives |
| W-01 | web | high | PASS | Published site served through the gateway |
| W-02 | web | high | PASS | HTML is sandboxed against the gateway origin (was not) |
| W-03 | web | high | PASS | Blobs scoped to their manifest (was enumerable) |
| W-04 | web | high | PASS | Manifest nodeId must match signing key (was unchecked) |
| W-05 | web | critical | PASS | Domain claims require content (was free squatting) |
| W-06 | web | medium | PASS | Announce stores only referenced blobs (was junk storage) |
| W-07 | web | high | PASS | Cross-origin announce blocked (was open) |
| W-08 | web | high | PASS | Encoded path traversal does not reach gateway APIs |
| W-09 | web | critical | PASS | Folder publish does not follow junctions/symlinks (was leaking) |
| W-10 | web | medium | PASS | Unpublish garbage-collects blobs (was a leak) |
| W-11 | web | medium | PASS | Remote resolve does not claim domains locally (was poisoning) |
| W-12 | web | medium | PASS | Invalid domains rejected |
| W-13 | web | high | PASS | Claimed domain cannot be taken by another key |
| P-01 | protocol | critical | PASS | `neuro://` cannot escape the resources folder (was traversal) |
| X-01 | plugins | critical | **FAIL** | Plugin VM can reach the host process (open) |

## Fixed during the audit

1. **Mail relay was completely broken.** The relay mutated `ttl`/`hops` (which are signed) and re-signed the envelope with its own key while keeping the sender's public key, so every hop failed signature verification and the recipient never got the message. Relay now forwards the envelope verbatim and uses a relay-id set for loop protection; the target received the message in the retest. *(M-08: target inbox 0 → 1.)*
2. **No inbound rate limit.** A LAN attacker could flood `/mail/deliver` (4 MB per request). Added a per-IP bucket (40 requests/min) → `429`. *(M-09.)*
3. **Domain squatting without data.** `POST /web/announce` accepted a correctly signed manifest with fake hashes and no blobs, permanently claiming the domain. Announce now requires every referenced blob to be present (uploaded or already stored) before a claim is written. *(W-05.)*
4. **nodeId was not bound to the signing key.** A manifest could advertise any `nodeId` while being signed by another key. `verifyManifest` now enforces `nodeId === blobId(publicKey)`. *(W-04.)*
5. **Blob enumeration.** `/web/blob/<hash>` served any blob in the store by hash, regardless of site. It now requires `?domain=` and a manifest of that domain that references the hash. *(W-03.)*
6. **Same-origin gateway.** Every `.neuro` site shared the gateway origin with no CSP, so a malicious site could call `/web/announce` and read other sites. Served HTML now gets `Content-Security-Policy: sandbox allow-scripts …` plus `nosniff`; announce also rejects foreign `Origin` headers. *(W-02, W-07.)*
7. **Junction/symlink leak in folder publishing.** A junction inside a site folder was followed and its target files were published. The walker now `lstat`s every entry and skips symlinks/junctions. *(W-09.)*
8. **Blob GC missing.** `unpublish` removed the manifest but never the content, so storage grew forever. Added reference-counted blob GC. *(W-10.)*
9. **Remote-claim poisoning.** Resolving a hostile `.neuro` site called `acceptManifest`, which added it to the local store and claimed its domain, blocking the real owner. Resolve now verifies signatures and caches the manifest only. *(W-11.)*
10. **`neuro://` path traversal.** `path.join(appPath, 'resources', rel)` allowed `%2e%2e%2f` to escape into `package.json`/app files. The handler resolves and enforces containment under `resources/`. *(P-01.)*

## Open finding

### X-01 — Plugin VM escape (critical)

A plugin can execute `globalThis.constructor.constructor('return process')()` and obtain the main-process `process` object (the harness printed a live PID). Setting `codeGeneration: { strings: false, wasm: false }` is not sufficient: the `neuro` API exposes host-realm functions, and `hostFn.constructor` is the host `Function`.

**Impact:** a malicious or compromised plugin has full main-process privileges — filesystem, vault, network, IPC.

**Why it is open:** Node's `vm` module is explicitly not a security boundary. A real fix is architectural:

- run plugins in an Electron `utilityProcess` (or `child_process.fork`) with a message-passing API allowlist, no `fs`/`net`/`process.env`; or
- embed `isolated-vm` (native, separate isolate with memory limits).

**Interim:** treat plugins as trusted code; only install plugins you have reviewed. A warning banner is shown in the plugin manager; marketplace auto-install should stay off until process isolation lands.

## Residual risks (by design, documented)

- **LAN APIs are unauthenticated HTTP.** `MailService` and `WebService` bind `0.0.0.0`; discovery is UDP broadcast. Any host on the LAN can publish, announce, query peers and flood (now rate-limited). This is the P2P trust model, not a bug, but it means the mesh must not be exposed to an untrusted network without a firewall.
- **First-claim domain ownership, no consensus.** Whoever claims a name first owns it; there is no global registry or revocation. A peer can still claim an unclaimed name before the intended owner connects.
- **Peer-controlled hosts are fetched** (`/web/resolve`, blob fetch, relay), which is an SSRF surface toward the local network. Hosts are only taken from UDP beacons/handshakes; no allowlist exists.
- **Mail is signed and optionally encrypted, without forward secrecy.** Compromise of the X25519 key decrypts recorded ciphertext.
