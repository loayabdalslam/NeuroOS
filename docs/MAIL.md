# Decentralized mail

Neuro mail has **no central server**. Every running Neuro OS instance is its own
mail node: it holds its own identity, stores its own messages, accepts direct
deliveries from peers and relays messages for peers that are temporarily
offline.

Open it from the desktop **Mail** app, the taskbar envelope, or `Mail` in the
command palette.

---

## 1. Identity

An identity is generated locally on first use:

| Part | Algorithm | Purpose |
| --- | --- | --- |
| Signing key | Ed25519 | Authenticates the sender of every envelope |
| Encryption key | X25519 | Receives E2E-encrypted payloads |

The node id is `sha256(publicKey)` truncated to 16 hex chars, and the address is
derived from it:

```text
name@<nodeId>.neuro      e.g. youssef@4f7c9a1b22e0d3a8.neuro
```

Private keys are encrypted with the OS keychain (DPAPI on Windows) in
`state/vault.json`. The public halves travel in the envelope; the address is
stable across restarts.

---

## 2. Envelope

Every message is one signed JSON envelope:

```jsonc
{
  "v": 1,
  "id": "mail_…",
  "threadId": "thread_…",
  "from": { "address": "…", "name": "…", "nodeId": "…", "publicKey": "PEM", "encPublicKey": "PEM" },
  "to":   { "address": "…", "nodeId": "…" },
  "ts": "2026-…",
  "encrypted": true,
  "payload": "base64(ciphertext)",
  "epk": "PEM (ephemeral X25519 public key)",
  "nonce": "base64(12 bytes)",
  "tag": "base64",
  "ttl": 3,
  "hops": ["nodeId…"],
  "sig": "base64(ed25519 signature over the canonical envelope)"
}
```

- **Signature** covers a stable (sorted-key) serialisation of every field except
  `sig`, so any tampering is detected. The receiver also checks that
  `sha256(publicKey)` equals `from.nodeId`.
- **Encryption** is X25519 ECDH between a fresh ephemeral key and the recipient's
  long-term key, run through HKDF-SHA256, then AES-256-GCM. Because the ephemeral
  key is per message, payloads have forward secrecy.
- **Subject and body** are encrypted together; only routing metadata (from/to
  node ids, timestamp, size) is visible on the wire.
- When the recipient's public key is unknown, the payload is sent signed but
  **not** encrypted and the UI marks it accordingly.

---

## 3. Transport

Each node listens on an HTTP server (random port by default, shown in the Mail
sidebar).

| Endpoint | Purpose |
| --- | --- |
| `GET /mail/hello` | Identity handshake: node id, address, name, public keys, port |
| `POST /mail/deliver` | Accept or relay an envelope |
| `GET /mail/peers` | Share the peer list (used for mesh discovery) |

Delivery is attempted immediately. The result is one of:

| State | Meaning |
| --- | --- |
| `queued` | Stored locally; a retry loop runs every 12 s |
| `delivered` | The recipient's node accepted it (HTTP 200) |
| `relayed` | An intermediate node accepted it for forwarding (HTTP 202) |
| `received` | Inbound message stored on this node |
| `failed` | Reserved for permanent rejection |

Failed or offline deliveries stay queued and are retried; when no direct route
exists, the node forwards the envelope to its other peers with `ttl - 1`, and
each hop appends its node id to `hops` to prevent loops.

---

## 4. Discovery

- **LAN**: a UDP beacon on port `47811` (broadcast + multicast `239.255.42.99`)
  every 6 seconds advertises `{ nodeId, address, name, port, publicKeys }`.
  Peers auto-appear within a few seconds and are marked online for 25 s after
  the last beacon.
- **Manual**: add `host:port` in the Mail sidebar; the client performs the
  `/mail/hello` handshake and stores the public keys.
- **Gossip**: when a message arrives, the sender is added to the peer list so the
  mesh can learn routes even without discovery.

There is deliberately **no global directory**. Two nodes can talk once they know
each other's host (or share a LAN). This is the same trade-off as any
serverless mesh: discovery is local by default, federation is explicit. A team
can run a well-known relay node and add it as a peer to bridge networks.

---

## 5. Storage & privacy

```text
state/mail.json     identity (public), peers, messages (bounded to 2000)
state/vault.json    encrypted signing + encryption private keys
plugins/<id>/…      plugin storage (unrelated)
```

- Messages are plaintext at rest on the receiving device by design — it is your
  machine, protected by your OS account. Encrypting at rest would just move the
  key next to the data.
- Nothing is uploaded anywhere. There is no analytics, no relay operated by
  Neuro, and no account.
- Deleting a message deletes the local copy; peers may still hold their own.

---

## 6. Try it

Two instances on one machine (development):

```bash
# terminal 1
npx electron . --user-data-dir="%TEMP%/neuro-a" --mail-port=47800

# terminal 2
npx electron . --user-data-dir="%TEMP%/neuro-b" --mail-port=47810
```

Then, in each window: **Mail → create identity**, and add the other node via
**+ Add peer** (`127.0.0.1` and the port shown in the other window's sidebar).
Send a message; it appears in the other inbox instantly and is marked
`encrypted`.

On a LAN, both nodes usually discover each other automatically.

---

## 7. Agent integration

The agent gets three tools:

| Tool | Purpose |
| --- | --- |
| `mail.status` | Identity, address, peer count, unread/queued |
| `mail.inbox` | Read recent messages |
| `mail.send` | Send to a peer address (policy-gated) |

Combined with the automation engine, this gives you serverless email workflows:

```text
trigger.mail → agent.run(classify) → condition.if(urgent) → notify / mail.send
```

---

## 8. Limitations (honest)

- No global name system: addresses are key-derived, not human-registered.
- No multi-device sync out of the box: one identity lives on one node. Exporting
  keys is possible but not yet exposed in the UI.
- Attachments are not implemented; the envelope is text-only.
- Corporate networks that block UDP or peer-to-peer HTTP will need a relay
  reachable by both sides.
- A peer that never comes back online means undelivered mail stays queued
  locally; there is no bounce protocol yet.
