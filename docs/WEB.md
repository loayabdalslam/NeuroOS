# Neuro Web — decentralized domains & hosting

Neuro Web turns the app into a host and a resolver for a peer-to-peer web. There
is no registry, no DNS authority and no hosting provider: a site lives on the
machine that publishes it, and peers replicate it so it survives the publisher
going offline.

Open **Sites** from the desktop/dock, or switch the **Browser** to **Neuro Web**.

---

## 1. Publish from your own machine

Two paths, both real:

1. **Drag & drop** a folder (or a set of files) onto the drop zone in Sites.
   The renderer walks the dropped directory, packages the files and sends them
   to the local node.
2. **Publish a local folder** — opens the native folder picker and reads it in
   the main process (no renderer round-trip, no size guessing).

Pick a domain (`my-site`), an optional title/description, then **Publish to the
mesh**. The node:

1. validates the name (`a-z0-9-`, 2–40 chars) and the file set (`index.html` at
   the root unless an entry is set, ≤300 files, ≤12 MB);
2. stores content-addressed blobs in `state/web-blobs/<sha256>`;
3. signs a manifest with this node's Ed25519 key;
4. records the domain claim locally;
5. announces the manifest + blobs to every known peer.

The site is immediately reachable at `http://127.0.0.1:<port>/dweb/my-site/` and
from any peer that accepted it.

## 2. Resolve & browse

Every node runs an HTTP gateway:

```text
GET  /web/hello           node identity + stats
GET  /web/resolve?domain= manifest (signed) or 404
GET  /web/blob/<sha256>   content
POST /web/announce        manifest + blobs (replication)
GET  /dweb/<domain>/<p>   gateway: resolve + serve with the right MIME type
```

The browser never speaks the mesh protocol. It loads the local gateway, which
resolves the name locally, then through peers (3.5 s timeout each), verifies the
manifest signature and the content hashes, caches the blobs and serves them.
This keeps `.neuro` sites working inside the existing Chromium surface with no
custom protocol handler and no CORS surprises.

### Switching internets

The Browser toolbar has a two-state switch:

- **Web** — the normal internet.
- **Neuro Web** — the decentralized start page, `.neuro` address resolution and
  counters. Typing `my-site.neuro` (or just `my-site`) rewrites to the gateway.

The choice is remembered across sessions (`localStorage`).

## 3. Counters

Sites, peers online, visits served and hosted bytes are live counters fed by
`web:event`. Visits count gateway responses on this node; hosted bytes count the
local blob store.

## 4. Peers & discovery

- **LAN**: a UDP beacon on `47813` advertises `{ nodeId, port, name }` every 7 s.
  Peers appear automatically with source `lan`.
- **Manual**: add `host:port` in the Sites sidebar (source `manual`).
- Peers are pinged by the browser gateway on resolve; a peer is "online" if it
  was seen in the last 45 s.

Replication: when a peer receives `/web/announce`, it verifies the signature and
every blob hash, stores the manifest and blobs (bounded by `MAX_STORE_BYTES`),
and serves the site from then on.

## 5. Domains: how claims work

There is deliberately no global consensus. A domain is bound to the key that
first published it on a node:

- The first signed manifest for `name.neuro` claims it for that public key.
- Later manifests from a different key are rejected (`domain already claimed`).
- The claim is replicated with the manifest, so peers independently reach the
  same conclusion.
- This is a **first-claim** model, not an auction or a blockchain. Two nodes that
  publish the same name while partitioned will conflict when they meet; the
  existing local claim wins and the UI reports the rejection.

If you need collision-resistant naming, use a unique prefix (e.g. your node id).

## 6. Security model

- Manifests are Ed25519-signed; the public key is embedded and the derived node
  id must match `id`.
- Every file is SHA-256 content-addressed; blobs fetched from peers are verified
  before being stored or served.
- Paths are normalised (`..` and absolute paths removed) before lookup, and the
  gateway only serves files declared in the manifest.
- Sites run inside the existing Chromium webview partition; they do not get Node
  access or IPC.
- The gateway listens on all interfaces so peers can fetch content — publish only
  what you are comfortable serving to your network.

## 7. Limits (honest)

- No global discovery or DHT: peers are LAN or manual.
- First-claim domains, no revocation authority; unpublishing removes the claim on
  this node only.
- Text-oriented: files with null bytes are skipped by the folder publisher, and
  the manifest format has no streaming/range requests (no large video hosting).
- Replication is best effort and only happens on publish/announce; no background
  repair loop yet.
- The gateway is HTTP (not HTTPS); use it on trusted networks or front it with a
  reverse proxy.

## 8. Verified by the QA harness

`npm run selftest` starts a second node, publishes `selftest.neuro` on the main
node, resolves it from the peer, fetches it through the peer's gateway and
asserts the marker text, then prints:

```text
web p2p: published=true domain=selftest.neuro resolved=true served=true peerSites=1 hits=1
```
