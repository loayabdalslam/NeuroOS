import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import dgram from 'node:dgram';
import type { AddressInfo } from 'node:net';
import type { SiteManifest, WebPeer, WebPublishResult, WebStats } from '@shared/types';
import { JsonStore, Paths } from '../core/store';
import { log } from '../core/ipc';

interface SecretStoreLike {
  get: (key: string) => string;
  set: (key: string, value: string) => void;
  remove?: (key: string) => void;
}

interface WebState {
  nodeId: string;
  claims: Record<string, { publicKey: string; nodeId: string; at: string }>;
  sites: SiteManifest[];
  peers: WebPeer[];
  hits: number;
  servedBytes: number;
}

const DEFAULT_STATE: WebState = { nodeId: '', claims: {}, sites: [], peers: [], hits: 0, servedBytes: 0 };
const DISCOVERY_PORT = 47813;
const MAX_SITE_BYTES = 12 * 1024 * 1024;
const MAX_FILES = 300;
const MAX_STORE_BYTES = 256 * 1024 * 1024;

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  txt: 'text/plain; charset=utf-8',
  md: 'text/plain; charset=utf-8',
  woff2: 'font/woff2',
  wasm: 'application/wasm',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

function canonical(manifest: Omit<SiteManifest, 'signature'>): string {
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(manifest).sort()) ordered[key] = (manifest as Record<string, unknown>)[key];
  return JSON.stringify(ordered);
}

function safePath(input: string): string {
  return input
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/');
}

function mimeFor(file: string): string {
  return MIME[file.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

/**
 * Neuro Web — decentralized domains and hosting.
 *
 * Each node publishes signed site manifests and content-addressed blobs, serves
 * them over HTTP, discovers peers on the LAN and replicates sites to peers so a
 * published site stays reachable when the original publisher is offline.
 * The browser talks to the local gateway, which resolves `.neuro` names through
 * the peer network.
 */
export class WebService {
  private store: JsonStore<WebState>;
  private vault: SecretStoreLike;
  private server: http.Server | null = null;
  private udp: dgram.Socket | null = null;
  private beaconTimer?: ReturnType<typeof setInterval>;
  private port = 0;
  private listening = false;
  private disposed = false;
  private blobsDir: string;
  private remoteCache = new Map<string, { manifest: SiteManifest; host: string; port: number }>();

  constructor(options: { dataFile: string; blobsDir?: string; vault: SecretStoreLike; onEvent?: (payload: unknown) => void }) {
    this.store = new JsonStore<WebState>(options.dataFile, DEFAULT_STATE);
    this.vault = options.vault;
    this.blobsDir = options.blobsDir ?? path.join(Paths.state, 'web-blobs');
    this.onEvent = options.onEvent;
    fs.mkdirSync(this.blobsDir, { recursive: true });
    if (!this.store.get().nodeId) {
      this.store.set({ nodeId: crypto.createHash('sha256').update(this.publicKey()).digest('hex').slice(0, 16) });
    }
  }

  private onEvent?: (payload: unknown) => void;

  get nodeId(): string {
    return this.store.get().nodeId;
  }

  private emit(): void {
    this.onEvent?.({ kind: 'stats', stats: this.stats() });
  }

  publicKey(): string {
    let key = this.vault.get('web:sign');
    if (!key) {
      const pair = crypto.generateKeyPairSync('ed25519');
      key = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
      this.vault.set('web:sign', key);
    }
    return crypto.createPublicKey(crypto.createPrivateKey(key)).export({ type: 'spki', format: 'pem' }) as string;
  }

  private sign(data: string): string {
    const key = this.vault.get('web:sign');
    if (!key) throw new Error('web identity missing');
    return crypto.sign(null, Buffer.from(data), crypto.createPrivateKey(key)).toString('base64');
  }

  private verify(data: string, signature: string, publicKey: string): boolean {
    try {
      return crypto.verify(null, Buffer.from(data), crypto.createPublicKey(publicKey), Buffer.from(signature, 'base64'));
    } catch {
      return false;
    }
  }

  private blobPath(hash: string): string {
    return path.join(this.blobsDir, `${hash}.bin`);
  }

  private writeBlob(data: Buffer): string {
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    const file = this.blobPath(hash);
    if (!fs.existsSync(file)) fs.writeFileSync(file, data);
    return hash;
  }

  private readBlob(hash: string): Buffer | null {
    const file = this.blobPath(hash);
    if (!fs.existsSync(file)) return null;
    try {
      return fs.readFileSync(file);
    } catch {
      return null;
    }
  }

  private storeSize(): number {
    try {
      return fs
        .readdirSync(this.blobsDir)
        .reduce((total, name) => {
          try {
            return total + fs.statSync(path.join(this.blobsDir, name)).size;
          } catch {
            return total;
          }
        }, 0);
    } catch {
      return 0;
    }
  }

  stats(): WebStats {
    const state = this.store.get();
    const now = Date.now();
    const online = state.peers.filter((peer) => now - new Date(peer.lastSeen).getTime() < 45_000).length;
    return {
      sites: state.sites.length,
      peers: state.peers.length,
      online,
      hits: state.hits,
      bytes: this.storeSize(),
      port: this.port,
      nodeId: state.nodeId || this.nodeId,
      gateway: this.port ? `http://127.0.0.1:${this.port}` : '',
      publicKey: this.publicKey(),
    };
  }

  list(): SiteManifest[] {
    return [...this.store.get().sites].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  peers(): WebPeer[] {
    return [...this.store.get().peers].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  }

  async start(): Promise<void> {
    if (this.server) return;
    this.server = http.createServer((request, response) => {
      void this.handle(request, response);
    });
    await new Promise<void>((resolve) => this.server!.listen(0, '0.0.0.0', () => resolve()));
    this.port = (this.server!.address() as AddressInfo).port;
    this.listening = true;
    this.store.set({ nodeId: this.store.get().nodeId || this.nodeId });
    this.startDiscovery();
    log.info('web', `node ${this.nodeId} listening on :${this.port}`);
    this.emit();
  }

  private startDiscovery(): void {
    try {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      socket.on('error', (error) => log.debug('web', `udp ${error.message}`));
      socket.bind(DISCOVERY_PORT, () => {
        try {
          socket.setBroadcast(true);
          socket.addMembership('239.255.42.99');
        } catch {
          /* multicast may be unavailable */
        }
      });
      socket.on('message', (message, remote) => {
        try {
          const payload = JSON.parse(message.toString('utf8')) as { nodeId: string; port: number; name?: string };
          if (!payload.nodeId || payload.nodeId === this.nodeId || !payload.port) return;
          this.upsertPeer({ nodeId: payload.nodeId, host: remote.address, port: payload.port, name: payload.name ?? payload.nodeId, lastSeen: new Date().toISOString(), source: 'lan' });
        } catch {
          /* ignore malformed beacons */
        }
      });
      this.udp = socket;
      this.beaconTimer = setInterval(() => {
        if (!this.port || this.disposed) return;
        const payload = Buffer.from(JSON.stringify({ nodeId: this.nodeId, port: this.port, name: 'Neuro Web' }));
        try {
          socket.send(payload, DISCOVERY_PORT, '239.255.42.99');
          socket.send(payload, DISCOVERY_PORT, '255.255.255.255');
        } catch {
          /* ignore */
        }
      }, 7000);
    } catch (error) {
      log.warn('web', 'discovery unavailable', error);
    }
  }

  private upsertPeer(peer: WebPeer): void {
    const peers = [...this.store.get().peers];
    const index = peers.findIndex((item) => item.nodeId === peer.nodeId);
    if (index >= 0) {
      const merged = { ...peers[index], ...peer };
      if (!peer.host && peers[index].host) merged.host = peers[index].host;
      if (!peer.port && peers[index].port) merged.port = peers[index].port;
      peers[index] = merged;
    } else {
      peers.push(peer);
    }
    this.store.set({ peers });
  }

  addPeer(host: string, port: number): WebPeer[] {
    this.upsertPeer({
      nodeId: `manual-${host}:${port}`,
      host,
      port,
      name: `${host}:${port}`,
      lastSeen: new Date().toISOString(),
      source: 'manual',
    });
    return this.peers();
  }

  removePeer(nodeId: string): WebPeer[] {
    this.store.set({ peers: this.store.get().peers.filter((peer) => peer.nodeId !== nodeId) });
    return this.peers();
  }

  private claimDomain(manifest: SiteManifest): { ok: boolean; reason?: string } {
    const claims = { ...this.store.get().claims };
    const existing = claims[manifest.domain];
    if (existing && existing.publicKey !== manifest.publicKey) {
      return { ok: false, reason: `domain already claimed by another node (${existing.nodeId.slice(0, 8)})` };
    }
    if (!existing) claims[manifest.domain] = { publicKey: manifest.publicKey, nodeId: manifest.nodeId, at: manifest.publishedAt };
    this.store.set({ claims });
    return { ok: true };
  }

  async publish(input: {
    domain: string;
    title?: string;
    description?: string;
    entry?: string;
    files: { path: string; data: string }[];
  }): Promise<WebPublishResult> {
    const domain = input.domain.trim().toLowerCase().replace(/\.neuro$/, '');
    if (!/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(domain)) {
      return { ok: false, error: 'Domain must be 2–40 chars: lowercase letters, digits and dashes.' };
    }
    if (!input.files.length) return { ok: false, error: 'No files to publish.' };
    if (input.files.length > MAX_FILES) return { ok: false, error: `Too many files (max ${MAX_FILES}).` };

    const files: SiteManifest['files'] = [];
    let total = 0;
    const blobs: { hash: string; data: Buffer }[] = [];
    for (const file of input.files) {
      const normalized = safePath(file.path);
      if (!normalized) continue;
      const data = Buffer.from(file.data, 'base64');
      total += data.length;
      if (total > MAX_SITE_BYTES) return { ok: false, error: `Site exceeds ${(MAX_SITE_BYTES / 1024 / 1024).toFixed(0)} MB.` };
      const hash = crypto.createHash('sha256').update(data).digest('hex');
      blobs.push({ hash, data });
      files.push({ path: normalized, hash, size: data.length, type: mimeFor(normalized) });
    }
    if (!files.length) return { ok: false, error: 'No usable files.' };
    if (!files.some((file) => file.path === 'index.html') && !input.entry) {
      return { ok: false, error: 'Add an index.html at the root (or set an entry file).' };
    }

    const generated = blobId(this.publicKey());
    const existing = this.store.get().sites.find((site) => site.domain === domain);
    if (existing && existing.publicKey !== this.publicKey()) {
      return { ok: false, error: 'This domain is claimed by another node.' };
    }

    for (const blob of blobs) this.writeBlob(blob.data);

    const manifest: SiteManifest = {
      version: 1,
      domain,
      title: input.title?.trim() || domain,
      description: input.description?.trim() || `${files.length} files hosted from ${this.nodeId.slice(0, 8)}`,
      nodeId: this.nodeId,
      publicKey: this.publicKey(),
      publishedAt: existing?.publishedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      entry: input.entry ?? 'index.html',
      files,
      signature: '',
      id: generated,
    };
    const body = canonical({ ...manifest, signature: undefined } as never);
    manifest.signature = this.sign(body);
    this.claimDomain(manifest);

    const sites = [...this.store.get().sites.filter((site) => site.domain !== domain), manifest];
    this.store.set({ sites });
    this.emit();
    await this.announce(manifest, blobs).catch((error) => log.warn('web', 'announce failed', error));
    log.info('web', `published ${domain}.neuro · ${files.length} files · ${(total / 1024).toFixed(1)} KB`);
    return { ok: true, manifest };
  }

  async publishFolder(folder: string, domain: string, title?: string): Promise<WebPublishResult> {
    const files: { path: string; data: string }[] = [];
    const walk = (dir: string, prefix: string, depth: number): void => {
      if (depth > 6 || files.length > MAX_FILES) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(full, relative, depth + 1);
          continue;
        }
        const info = fs.statSync(full);
        if (info.size > 4 * 1024 * 1024) continue;
        const data = fs.readFileSync(full);
        if (data.includes(0)) continue; // skip binaries we cannot serve meaningfully
        files.push({ path: relative, data: data.toString('base64') });
      }
    };
    walk(folder, '', 0);
    return this.publish({ domain, title, description: `Published from ${folder}`, files });
  }

  private async announce(manifest: SiteManifest, blobs: { hash: string; data: Buffer }[]): Promise<void> {
    const peers = this.store.get().peers.filter((peer) => peer.host && peer.port);
    if (!peers.length) return;
    const payload = JSON.stringify({
      manifest,
      blobs: blobs.map((blob) => ({ hash: blob.hash, data: blob.data.toString('base64') })),
    });
    if (payload.length > 14 * 1024 * 1024) return;
    await Promise.allSettled(
      peers.slice(0, 8).map((peer) =>
        fetch(`http://${peer.host}:${peer.port}/web/announce`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', connection: 'close' },
          body: payload,
          signal: AbortSignal.timeout(6000),
        }),
      ),
    );
  }

  private acceptManifest(manifest: SiteManifest): boolean {
    const body = canonical({ ...manifest, signature: undefined } as never);
    if (!this.verify(body, manifest.signature, manifest.publicKey)) return false;
    if (!/^[a-z0-9-]{2,40}$/.test(manifest.domain)) return false;
    const expectedId = blobId(manifest.publicKey);
    if (expectedId !== manifest.id) return false;
    if (manifest.files.some((file) => !/^[a-f0-9]{64}$/.test(file.hash))) return false;
    const claim = this.claimDomain(manifest);
    if (!claim.ok) return false;
    const sites = [...this.store.get().sites.filter((site) => site.domain !== manifest.domain), manifest];
    this.store.set({ sites });
    this.emit();
    return true;
  }

  async unpublish(domain: string): Promise<SiteManifest[]> {
    const clean = domain.replace(/\.neuro$/, '');
    const sites = this.store.get().sites.filter((site) => site.domain !== clean);
    const claims = { ...this.store.get().claims };
    delete claims[clean];
    this.store.set({ sites, claims });
    this.emit();
    return sites;
  }

  async resolve(domainInput: string): Promise<{ manifest: SiteManifest; host: string; port: number } | null> {
    const domain = domainInput.replace(/\.neuro$/, '').toLowerCase();
    const local = this.store.get().sites.find((site) => site.domain === domain);
    if (local) return { manifest: local, host: '127.0.0.1', port: this.port };
    const cached = this.remoteCache.get(domain);
    if (cached) return { manifest: cached.manifest, host: cached.host, port: cached.port };
    const peers = this.store.get().peers.filter((peer) => peer.host && peer.port).slice(0, 6);
    for (const peer of peers) {
      try {
        const response = await fetch(`http://${peer.host}:${peer.port}/web/resolve?domain=${encodeURIComponent(domain)}`, {
          signal: AbortSignal.timeout(3500),
          headers: { connection: 'close' },
        });
        if (!response.ok) continue;
        const payload = (await response.json()) as { manifest?: SiteManifest };
        if (!payload.manifest) continue;
        if (!this.acceptManifest(payload.manifest)) continue;
        this.remoteCache.set(domain, { manifest: payload.manifest, host: peer.host, port: peer.port });
        log.info('web', `resolved ${domain}.neuro from ${peer.host}:${peer.port}`);
        return { manifest: payload.manifest, host: peer.host, port: peer.port };
      } catch {
        /* try the next peer */
      }
    }
    return null;
  }

  private async contentFor(file: SiteManifest['files'][number], host: string, port: number): Promise<Buffer | null> {
    const local = this.readBlob(file.hash);
    if (local) return local;
    if (host === '127.0.0.1' && port === this.port) return null;
    try {
      const response = await fetch(`http://${host}:${port}/web/blob/${file.hash}`, {
        signal: AbortSignal.timeout(6000),
        headers: { connection: 'close' },
      });
      if (!response.ok) return null;
      const data = Buffer.from(await response.arrayBuffer());
      if (crypto.createHash('sha256').update(data).digest('hex') !== file.hash) return null;
      this.writeBlob(data);
      return data;
    } catch {
      return null;
    }
  }

  private async handle(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    const json = (status: number, body: unknown): void => {
      const payload = JSON.stringify(body);
      response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload), connection: 'close' });
      response.end(payload);
    };
    const binary = (status: number, data: Buffer, type: string): void => {
      response.writeHead(status, { 'content-type': type, 'content-length': data.length, connection: 'close' });
      response.end(data);
    };

    if (url.pathname === '/web/hello') {
      const stats = this.stats();
      return json(200, { nodeId: this.nodeId, port: this.port, name: 'Neuro Web', stats });
    }
    if (url.pathname === '/web/stats') return json(200, this.stats());
    if (url.pathname === '/web/sites') return json(200, { items: this.list() });
    if (url.pathname === '/web/resolve') {
      const domain = (url.searchParams.get('domain') ?? '').toLowerCase();
      const site = this.store.get().sites.find((item) => item.domain === domain);
      if (!site) return json(404, { error: 'not found' });
      return json(200, { manifest: site });
    }
    if (url.pathname.startsWith('/web/blob/')) {
      const hash = url.pathname.split('/').pop() ?? '';
      const data = /^[a-f0-9]{64}$/.test(hash) ? this.readBlob(hash) : null;
      if (!data) return json(404, { error: 'missing blob' });
      return binary(200, data, 'application/octet-stream');
    }
    if (url.pathname === '/web/announce' && request.method === 'POST') {
      let body = '';
      request.on('data', (chunk) => {
        body += chunk;
        if (body.length > 20 * 1024 * 1024) request.destroy();
      });
      request.on('end', () => {
        try {
          const payload = JSON.parse(body) as { manifest?: SiteManifest; blobs?: { hash: string; data: string }[] };
          if (!payload.manifest) return json(400, { error: 'manifest required' });
          let stored = 0;
          for (const blob of payload.blobs ?? []) {
            const data = Buffer.from(blob.data, 'base64');
            if (crypto.createHash('sha256').update(data).digest('hex') !== blob.hash) continue;
            if (this.storeSize() + data.length > MAX_STORE_BYTES) break;
            this.writeBlob(data);
            stored += 1;
          }
          const accepted = this.acceptManifest(payload.manifest);
          this.emit();
          return json(accepted ? 200 : 409, { ok: accepted, stored });
        } catch (error) {
          return json(400, { error: (error as Error).message });
        }
      });
      return;
    }

    if (url.pathname.startsWith('/dweb/')) {
      const segments = url.pathname.split('/').filter(Boolean); // ['dweb', domain, ...path]
      const domain = (segments[1] ?? '').replace(/\.neuro$/, '');
      const relative = safePath(segments.slice(2).join('/')) || 'index.html';
      const resolved = await this.resolve(domain);
      if (!resolved) {
        return binary(404, Buffer.from(notFoundPage(domain), 'utf8'), 'text/html; charset=utf-8');
      }
      const manifest = resolved.manifest;
      const file = manifest.files.find((item) => item.path === relative) ?? manifest.files.find((item) => item.path === manifest.entry) ?? manifest.files.find((item) => item.path === 'index.html');
      if (!file) return binary(404, Buffer.from(notFoundPage(domain), 'utf8'), 'text/html; charset=utf-8');
      const data = await this.contentFor(file, resolved.host, resolved.port);
      if (!data) return binary(502, Buffer.from('<h1>Content unavailable</h1><p>The origin node is offline and no replica has this file.</p>', 'utf8'), 'text/html; charset=utf-8');
      const state = this.store.get();
      this.store.set({ hits: state.hits + 1, servedBytes: state.servedBytes + data.length });
      this.emit();
      return binary(200, data, file.type);
    }

    if (url.pathname === '/') {
      return binary(200, Buffer.from(`<pre>Neuro Web node ${this.nodeId}\n${this.port}\n${this.list().length} sites</pre>`, 'utf8'), 'text/html; charset=utf-8');
    }
    return json(404, { error: 'not found' });
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.beaconTimer) clearInterval(this.beaconTimer);
    this.udp?.close();
    const server = this.server;
    if (server) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    this.server = null;
    this.listening = false;
  }
}

function blobId(publicKey: string): string {
  return crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 16);
}

function notFoundPage(domain: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${domain}.neuro not found</title>
<style>body{margin:0;height:100vh;display:grid;place-items:center;background:#0b0b12;color:#e6e8ef;font-family:system-ui,sans-serif}
.card{max-width:460px;text-align:center;padding:32px}h1{font-size:22px;font-weight:600;margin:16px 0 8px}
p{color:#8b90a0;line-height:1.6;font-size:13px}code{color:#5686fe}</style></head>
<body><div class="card"><div style="font-size:40px">◈</div><h1>${domain}.neuro is not on the mesh</h1>
<p>No peer announced this domain yet. Ask the publisher to keep their node online, or add a peer that hosts it.</p></div></body></html>`;
}
