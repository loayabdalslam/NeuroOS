import { createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes, sign, verify } from 'node:crypto';
import dgram from 'node:dgram';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import type { MailIdentity, MailMessage, MailPeer, MailStatus } from '@shared/types';
import { JsonStore, Paths } from '../core/store';
import { log } from '../core/ipc';
import { newId, nowIso, truncate } from '../core/util';

/**
 * Decentralized, real-time mail.
 *
 * There is no central server. Every node is its own mail server:
 *  · identity = Ed25519 keypair, address = `name@<fingerprint>.neuro`
 *  · transport = direct HTTP POST between nodes, with store-and-forward gossip
 *  · discovery = UDP LAN beacons (plus manual peers)
 *  · privacy = signed envelopes, optional X25519 + AES-256-GCM payload encryption
 *
 * Envelopes carry a TTL and a hop list so any connected node can relay a message
 * for a peer that is temporarily offline. Messages are stored locally in JSON.
 */

/* ------------------------------------------------------------------ */
/* Crypto helpers                                                      */
/* ------------------------------------------------------------------ */

const DISCOVERY_PORT = 47811;
const DISCOVERY_ADDRESS = '239.255.42.99';
const BEACON_INTERVAL = 6000;
const RETRY_INTERVAL = 12000;

interface SecretStoreLike {
  get(key: string): string;
  set(key: string, value: string): void;
  remove?(key: string): void;
}

interface EnvelopeFrom {
  address: string;
  name: string;
  nodeId: string;
  publicKey: string;
  encPublicKey: string;
}

interface Envelope {
  v: 1;
  id: string;
  threadId: string;
  from: EnvelopeFrom;
  to: { address: string; nodeId: string };
  ts: string;
  encrypted: boolean;
  payload: string;
  epk?: string;
  nonce?: string;
  tag?: string;
  ttl: number;
  hops: string[];
  sig: string;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

const fingerprint = (publicKey: string): string => createHash('sha256').update(publicKey).digest('hex').slice(0, 16);

const slug = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24) || 'you';

function encryptPayload(
  plaintext: string,
  recipientEncPublicKey: string,
): { payload: string; epk: string; nonce: string; tag: string } {
  const recipient = createPublicKey(recipientEncPublicKey);
  const ephemeral = generateKeyPairSync('x25519');
  const shared = diffieHellman({ privateKey: ephemeral.privateKey, publicKey: recipient });
  const key = Buffer.from(hkdfSync('sha256', shared, Buffer.from('neuro-mail-v1'), Buffer.from('payload'), 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    payload: ciphertext.toString('base64'),
    epk: ephemeral.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    nonce: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decryptPayload(envelope: Envelope, recipientEncPrivateKey: string): string {
  if (!envelope.epk || !envelope.nonce || !envelope.tag) throw new Error('Encrypted envelope is missing parameters');
  const ephemeral = createPublicKey(envelope.epk);
  const shared = diffieHellman({ privateKey: createPrivateKey(recipientEncPrivateKey), publicKey: ephemeral });
  const key = Buffer.from(hkdfSync('sha256', shared, Buffer.from('neuro-mail-v1'), Buffer.from('payload'), 32));
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.payload, 'base64')), decipher.final()]).toString('utf8');
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

interface MailState {
  identity: MailIdentity | null;
  encryptionPublicKey: string;
  peers: MailPeer[];
  messages: MailMessage[];
  discovery: boolean;
}

const DEFAULT_STATE: MailState = { identity: null, encryptionPublicKey: '', peers: [], messages: [], discovery: true };

export interface MailServiceOptions {
  dataFile?: string;
  vault?: SecretStoreLike;
  port?: number;
  discovery?: boolean;
  secretPrefix?: string;
  onEvent?: (event: { kind: 'message' | 'peer' | 'status' | 'delivery'; message?: MailMessage; peer?: MailPeer; status?: MailStatus }) => void;
}

export class MailService {
  private store: JsonStore<MailState>;
  private vault: SecretStoreLike;
  private prefix: string;
  private server: http.Server | null = null;
  private udp: dgram.Socket | null = null;
  private beaconTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private port = 0;
  private listening = false;
  private seen = new Set<string>();
  private onEvent: MailServiceOptions['onEvent'];
  private disposed = false;
  private explicitDiscovery: boolean | undefined;
  private requestedPort: number | undefined;

  constructor(options: MailServiceOptions = {}) {
    this.store = new JsonStore<MailState>(options.dataFile ?? Paths.stateFile('mail'), DEFAULT_STATE, (error) =>
      log.error('mail', 'persist failed', error),
    );
    this.vault = options.vault ?? { get: () => '', set: () => {}, remove: () => {} };
    this.prefix = options.secretPrefix ?? 'mail';
    this.onEvent = options.onEvent;
    this.requestedPort = options.port;
    this.explicitDiscovery = options.discovery;
  }

  /* ------------------------------ lifecycle ------------------------------ */

  async start(): Promise<void> {
    if (this.store.get().identity) await this.ensureServer();
    this.retryTimer = setInterval(() => void this.retryQueued(), RETRY_INTERVAL);
    log.info('mail', `service started (${this.store.get().identity?.address ?? 'no identity'})`);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    if (this.beaconTimer) clearInterval(this.beaconTimer);
    if (this.retryTimer) clearInterval(this.retryTimer);
    this.udp?.close();
    const server = this.server;
    if (server) {
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    this.udp = null;
    this.server = null;
    this.listening = false;
  }

  status(): MailStatus {
    const state = this.store.get();
    return {
      identity: state.identity,
      peers: this.peers(),
      port: this.port,
      listening: this.listening,
      discovery: state.discovery,
      pending: state.messages.filter((message) => message.direction === 'out' && message.delivery === 'queued').length,
      unread: state.messages.filter((message) => message.direction === 'in' && !message.read).length,
    };
  }

  /** Drop the identity, peers and mailbox, then stop listening. */
  async resetIdentity(): Promise<void> {
    this.stopDiscovery();
    if (this.server) {
      const server = this.server;
      server.closeAllConnections?.();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      this.server = null;
    }
    this.listening = false;
    this.port = 0;
    this.seen.clear();
    this.vault.remove?.(`${this.prefix}:sign`);
    this.vault.remove?.(`${this.prefix}:enc`);
    const discovery = this.store.get().discovery;
    this.store.replace({ ...DEFAULT_STATE, discovery });
  }

  /* ------------------------------ identity ------------------------------- */

  async createIdentity(name: string): Promise<MailStatus> {
    if (this.store.get().identity) throw new Error('This node already has a mail identity');
    const signing = generateKeyPairSync('ed25519');
    const encryption = generateKeyPairSync('x25519');
    const publicKey = signing.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const encryptionPublicKey = encryption.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const nodeId = fingerprint(publicKey);
    const cleanName = name.trim() || 'Explorer';
    const identity: MailIdentity = {
      address: `${slug(cleanName)}@${nodeId}.neuro`,
      nodeId,
      name: cleanName,
      publicKey,
      createdAt: nowIso(),
    };
    this.vault.set(`${this.prefix}:sign`, signing.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
    this.vault.set(`${this.prefix}:enc`, encryption.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString());
    this.store.set({ identity, encryptionPublicKey, discovery: this.explicitDiscovery ?? true });
    await this.ensureServer();
    this.emit({ kind: 'status', status: this.status() });
    log.info('mail', `identity created: ${identity.address}`);
    return this.status();
  }

  private identity(): MailIdentity {
    const identity = this.store.get().identity;
    if (!identity) throw new Error('Create a mail identity first');
    return identity;
  }

  private signKey(): string {
    return this.vault.get(`${this.prefix}:sign`);
  }

  private encKey(): string {
    return this.vault.get(`${this.prefix}:enc`);
  }

  /* -------------------------------- peers -------------------------------- */

  peers(): MailPeer[] {
    const now = Date.now();
    return [...this.store.get().peers]
      .map((peer) => ({ ...peer, online: now - new Date(peer.lastSeen).getTime() < 25_000 }))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
  }

  async addPeer(host: string, port: number): Promise<MailPeer[]> {
    const info = await this.handshake(host, port);
    this.upsertPeer({
      nodeId: info.nodeId,
      address: info.address,
      name: info.name,
      host,
      port,
      publicKey: info.publicKey,
      encPublicKey: info.encPublicKey,
      lastSeen: nowIso(),
      source: 'manual',
      online: true,
    });
    this.emit({ kind: 'status', status: this.status() });
    return this.peers();
  }

  removePeer(nodeId: string): MailPeer[] {
    this.store.set({ peers: this.store.get().peers.filter((peer) => peer.nodeId !== nodeId) });
    this.emit({ kind: 'status', status: this.status() });
    return this.peers();
  }

  setDiscovery(enabled: boolean): MailStatus {
    this.store.set({ discovery: enabled });
    if (enabled) this.startDiscovery();
    else this.stopDiscovery();
    this.emit({ kind: 'status', status: this.status() });
    return this.status();
  }

  private upsertPeer(peer: MailPeer): void {
    const peers = [...this.store.get().peers];
    const index = peers.findIndex((item) => item.nodeId === peer.nodeId);
    const merged: MailPeer = index >= 0 ? { ...peers[index], ...peer } : peer;
    if (index >= 0) {
      // Gossip should never erase a working host/port discovered earlier.
      if (!peer.host && peers[index].host) {
        merged.host = peers[index].host;
        merged.port = peers[index].port;
      }
      if (!peer.publicKey && peers[index].publicKey) merged.publicKey = peers[index].publicKey;
      if (!peer.encPublicKey && peers[index].encPublicKey) merged.encPublicKey = peers[index].encPublicKey;
      peers[index] = merged;
    } else {
      peers.push(merged);
    }
    this.store.set({ peers });
    if (index < 0) this.emit({ kind: 'peer', peer: merged });
  }

  private handshake(host: string, port: number): Promise<EnvelopeFrom & { port: number }> {
    return new Promise((resolve, reject) => {
      const url = `http://${host}:${port}/mail/hello`;
      const timer = setTimeout(() => reject(new Error(`Handshake timed out: ${host}:${port}`)), 6000);
      const request = http.get(url, { agent: false, headers: { connection: 'close' } }, (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => (body += chunk));
        response.on('end', () => {
          clearTimeout(timer);
          try {
            const parsed = JSON.parse(body) as EnvelopeFrom & { port: number };
            if (!parsed.nodeId || !parsed.publicKey) throw new Error('Invalid peer handshake');
            resolve(parsed);
          } catch (error) {
            reject(error as Error);
          }
        });
      });
      request.on('error', (error) => {
        clearTimeout(timer);
        reject(new Error(`Cannot reach ${host}:${port} — ${error.message}`));
      });
    });
  }

  /* ------------------------------- delivery ------------------------------ */

  async send(input: { to: string; subject: string; body: string; encrypt?: boolean; replyTo?: string }): Promise<MailMessage> {
    const identity = this.identity();
    const peer = this.peers().find(
      (item) => item.address.toLowerCase() === input.to.toLowerCase() || item.nodeId === input.to || item.address.split('@')[0] === input.to,
    );
    if (!peer) throw new Error(`Unknown recipient "${input.to}". Add the peer first (or wait for LAN discovery).`);
    const now = nowIso();
    const threadId = input.replyTo ? this.store.get().messages.find((message) => message.id === input.replyTo)?.threadId ?? newId('thread') : newId('thread');
    const plaintext = JSON.stringify({ subject: input.subject, body: input.body });
    const recipientKey = peer.encPublicKey;
    const shouldEncrypt = input.encrypt !== false && Boolean(recipientKey);
    const sealed = shouldEncrypt && recipientKey ? encryptPayload(plaintext, recipientKey) : null;

    const envelope: Envelope = {
      v: 1,
      id: newId('mail'),
      threadId,
      from: {
        address: identity.address,
        name: identity.name,
        nodeId: identity.nodeId,
        publicKey: identity.publicKey,
        encPublicKey: this.store.get().encryptionPublicKey,
      },
      to: { address: peer.address, nodeId: peer.nodeId },
      ts: now,
      encrypted: Boolean(sealed),
      payload: sealed ? sealed.payload : Buffer.from(plaintext, 'utf8').toString('base64'),
      epk: sealed?.epk,
      nonce: sealed?.nonce,
      tag: sealed?.tag,
      ttl: 3,
      hops: [],
      sig: '',
    };
    envelope.sig = this.signEnvelope(envelope);

    const message: MailMessage = {
      id: envelope.id,
      threadId,
      from: { address: identity.address, name: identity.name, nodeId: identity.nodeId },
      to: { address: peer.address, name: peer.name, nodeId: peer.nodeId },
      subject: input.subject,
      body: input.body,
      createdAt: now,
      direction: 'out',
      read: true,
      encrypted: envelope.encrypted,
      signed: true,
      verified: true,
      delivery: 'queued',
      hops: 0,
      replyTo: input.replyTo,
    };
    this.saveMessage(message);
    this.emit({ kind: 'message', message });

    const delivered = await this.deliver(envelope, peer);
    this.updateDelivery(message.id, delivered ? 'delivered' : 'queued');
    return { ...message, delivery: delivered ? 'delivered' : 'queued' };
  }

  private signEnvelope(envelope: Envelope): string {
    const { sig, ...unsigned } = envelope;
    void sig;
    return sign(null, Buffer.from(stableStringify(unsigned)), createPrivateKey(this.signKey())).toString('base64');
  }

  private verifyEnvelope(envelope: Envelope): boolean {
    try {
      const { sig, ...unsigned } = envelope;
      if (fingerprint(envelope.from.publicKey) !== envelope.from.nodeId) return false;
      return verify(null, Buffer.from(stableStringify(unsigned)), createPublicKey(envelope.from.publicKey), Buffer.from(sig, 'base64'));
    } catch {
      return false;
    }
  }

  private async deliver(envelope: Envelope, peer: MailPeer): Promise<boolean> {
    const body = JSON.stringify(envelope);
    return new Promise((resolve) => {
      const request = http.request(
        {
          host: peer.host,
          port: peer.port,
          path: '/mail/deliver',
          method: 'POST',
          agent: false,
          headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), connection: 'close' },
          timeout: 8000,
        },
        (response) => {
          response.resume();
          resolve(response.statusCode === 200 || response.statusCode === 202);
        },
      );
      request.on('error', () => resolve(false));
      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });
      request.end(body);
    });
  }

  private updateDelivery(id: string, delivery: MailMessage['delivery'], error?: string): void {
    const messages = this.store.get().messages.map((message) =>
      message.id === id ? { ...message, delivery, error: error ?? message.error } : message,
    );
    this.store.set({ messages });
    const message = messages.find((item) => item.id === id);
    if (message) this.emit({ kind: 'delivery', message });
  }

  private async retryQueued(): Promise<void> {
    if (this.disposed) return;
    const pending = this.store.get().messages.filter((message) => message.direction === 'out' && message.delivery === 'queued');
    for (const message of pending.slice(0, 8)) {
      const peer = this.peers().find((item) => item.nodeId === message.to.nodeId);
      if (!peer) continue;
      const envelope = this.buildEnvelopeForRetry(message, peer);
      if (!envelope) continue;
      const ok = await this.deliver(envelope, peer);
      if (ok) this.updateDelivery(message.id, 'delivered');
    }
  }

  private buildEnvelopeForRetry(message: MailMessage, peer: MailPeer): Envelope | null {
    const identity = this.store.get().identity;
    if (!identity) return null;
    const plaintext = JSON.stringify({ subject: message.subject, body: message.body });
    const recipientKey = peer.encPublicKey;
    const sealed = recipientKey ? encryptPayload(plaintext, recipientKey) : null;
    const envelope: Envelope = {
      v: 1,
      id: message.id,
      threadId: message.threadId,
      from: {
        address: identity.address,
        name: identity.name,
        nodeId: identity.nodeId,
        publicKey: identity.publicKey,
        encPublicKey: this.store.get().encryptionPublicKey,
      },
      to: { address: peer.address, nodeId: peer.nodeId },
      ts: message.createdAt,
      encrypted: Boolean(sealed),
      payload: sealed ? sealed.payload : Buffer.from(plaintext, 'utf8').toString('base64'),
      epk: sealed?.epk,
      nonce: sealed?.nonce,
      tag: sealed?.tag,
      ttl: 3,
      hops: [],
      sig: '',
    };
    envelope.sig = this.signEnvelope(envelope);
    return envelope;
  }

  /* -------------------------------- inbox -------------------------------- */

  messages(folder: 'inbox' | 'sent' = 'inbox', limit = 200): MailMessage[] {
    const messages = this.store.get().messages
      .filter((message) => (folder === 'inbox' ? message.direction === 'in' : message.direction === 'out'))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return messages.slice(0, limit);
  }

  markRead(id: string): boolean {
    let changed = false;
    const messages = this.store.get().messages.map((message) => {
      if (message.id !== id || message.direction !== 'in' || message.read) return message;
      changed = true;
      return { ...message, read: true };
    });
    if (changed) {
      this.store.set({ messages });
      this.emit({ kind: 'status', status: this.status() });
    }
    return changed;
  }

  deleteMessage(id: string): boolean {
    const before = this.store.get().messages.length;
    this.store.set({ messages: this.store.get().messages.filter((message) => message.id !== id) });
    return this.store.get().messages.length !== before;
  }

  private saveMessage(message: MailMessage): void {
    const messages = [message, ...this.store.get().messages].slice(0, 2000);
    this.store.set({ messages });
  }

  /* ------------------------------ transport ------------------------------ */

  private async ensureServer(): Promise<void> {
    if (this.server) return;
    this.server = http.createServer((request, response) => this.handleRequest(request, response));
    await new Promise<void>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException): void => reject(error);
      this.server!.once('error', onError);
      this.server!.listen(this.requestedPort ?? 0, '0.0.0.0', () => {
        this.server!.off('error', onError);
        this.port = (this.server!.address() as AddressInfo).port;
        this.listening = true;
        resolve();
      });
    });
    const discovery = this.store.get().discovery;
    if (discovery) this.startDiscovery();
    log.info('mail', `node listening on :${this.port}`);
  }

  private handleRequest(request: http.IncomingMessage, response: http.ServerResponse): void {
    const send = (status: number, payload: unknown): void => {
      const body = JSON.stringify(payload);
      response.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
      response.end(body);
    };

    if (request.method === 'GET' && request.url === '/mail/hello') {
      const identity = this.store.get().identity;
      if (!identity) return send(503, { error: 'no identity' });
      return send(200, {
        nodeId: identity.nodeId,
        address: identity.address,
        name: identity.name,
        publicKey: identity.publicKey,
        encPublicKey: this.store.get().encryptionPublicKey,
        port: this.port,
      });
    }

    if (request.method === 'GET' && request.url === '/mail/peers') {
      return send(200, {
        peers: this.peers().map((peer) => ({
          nodeId: peer.nodeId,
          address: peer.address,
          name: peer.name,
          host: peer.host,
          port: peer.port,
          publicKey: peer.publicKey,
          encPublicKey: peer.encPublicKey,
        })),
      });
    }

    if (request.method === 'POST' && request.url === '/mail/deliver') {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => {
        body += chunk;
        if (body.length > 4_000_000) request.destroy();
      });
      request.on('end', () => {
        void (async () => {
          let envelope: Envelope;
          try {
            envelope = JSON.parse(body) as Envelope;
          } catch {
            return send(400, { error: 'invalid json' });
          }
          if (!this.verifyEnvelope(envelope)) return send(400, { error: 'invalid signature' });
          const identity = this.store.get().identity;
          if (!identity) return send(503, { error: 'no identity' });

          if (envelope.to.nodeId === identity.nodeId) {
            this.acceptEnvelope(envelope);
            return send(200, { ok: true, delivered: true });
          }

          // Store-and-forward: relay for other nodes without a central server.
          if (envelope.ttl > 0 && !envelope.hops.includes(identity.nodeId)) {
            const relayed = await this.relay(envelope, identity.nodeId);
            return send(202, { ok: true, relayed });
          }
          return send(410, { error: 'ttl expired' });
        })();
      });
      return;
    }

    send(404, { error: 'not found' });
  }

  private acceptEnvelope(envelope: Envelope): void {
    if (this.seen.has(envelope.id)) return;
    this.seen.add(envelope.id);
    let subject = '(encrypted)';
    let body = '';
    try {
      const decoded = envelope.encrypted ? decryptPayload(envelope, this.encKey()) : Buffer.from(envelope.payload, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded) as { subject: string; body: string };
      subject = truncate(String(parsed.subject ?? '(no subject)'), 200);
      body = String(parsed.body ?? '');
    } catch (error) {
      log.warn('mail', 'could not decrypt message', error);
      body = 'This message could not be decrypted on this device.';
    }

    const message: MailMessage = {
      id: envelope.id,
      threadId: envelope.threadId,
      from: { address: envelope.from.address, name: envelope.from.name, nodeId: envelope.from.nodeId },
      to: { address: this.identity().address, name: this.identity().name, nodeId: this.identity().nodeId },
      subject,
      body,
      createdAt: envelope.ts,
      direction: 'in',
      read: false,
      encrypted: envelope.encrypted,
      signed: true,
      verified: true,
      delivery: 'received',
      hops: envelope.hops.length,
    };
    this.saveMessage(message);
    this.emit({ kind: 'message', message });
    this.emit({ kind: 'status', status: this.status() });
    log.info('mail', `received ${message.id} from ${message.from.address}`);

    // Gossip the sender to our peers so the mesh learns routes.
    this.upsertPeer({
      nodeId: envelope.from.nodeId,
      address: envelope.from.address,
      name: envelope.from.name,
      host: '',
      port: 0,
      publicKey: envelope.from.publicKey,
      encPublicKey: envelope.from.encPublicKey,
      lastSeen: nowIso(),
      source: 'gossip',
      online: false,
    });
  }

  private async relay(envelope: Envelope, myNodeId: string): Promise<number> {
    const forwarded: Envelope = { ...envelope, ttl: envelope.ttl - 1, hops: [...envelope.hops, myNodeId], sig: '' };
    forwarded.sig = this.signEnvelope(forwarded);
    let count = 0;
    for (const peer of this.peers()) {
      if (peer.nodeId === envelope.from.nodeId || peer.nodeId === envelope.to.nodeId) continue;
      if (!peer.port) continue;
      const ok = await this.deliver(forwarded, peer);
      if (ok) count += 1;
    }
    return count;
  }

  /* ------------------------------ discovery ----------------------------- */

  private startDiscovery(): void {
    if (this.udp || !this.store.get().identity) return;
    try {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      this.udp = socket;
      socket.on('error', (error) => log.warn('mail', 'discovery socket error', error));
      socket.on('message', (buffer, rinfo) => {
        try {
          const beacon = JSON.parse(buffer.toString('utf8')) as {
            nodeId: string;
            address: string;
            name: string;
            port: number;
            publicKey: string;
            encPublicKey: string;
          };
          if (!beacon.nodeId || beacon.nodeId === this.store.get().identity?.nodeId) return;
          this.upsertPeer({
            nodeId: beacon.nodeId,
            address: beacon.address,
            name: beacon.name,
            host: rinfo.address,
            port: beacon.port,
            publicKey: beacon.publicKey,
            encPublicKey: beacon.encPublicKey,
            lastSeen: nowIso(),
            source: 'lan',
            online: true,
          });
          this.emit({ kind: 'status', status: this.status() });
        } catch {
          /* ignore malformed beacons */
        }
      });
      socket.bind(DISCOVERY_PORT, () => {
        try {
          socket.setBroadcast(true);
          socket.addMembership(DISCOVERY_ADDRESS);
        } catch {
          /* multicast may be unavailable; broadcast still works */
        }
        this.beaconTimer = setInterval(() => this.beacon(), BEACON_INTERVAL);
        this.beacon();
      });
      log.info('mail', 'LAN discovery enabled');
    } catch (error) {
      log.warn('mail', 'discovery failed to start', error);
    }
  }

  private stopDiscovery(): void {
    if (this.beaconTimer) clearInterval(this.beaconTimer);
    this.beaconTimer = null;
    try {
      this.udp?.close();
    } catch {
      /* ignore */
    }
    this.udp = null;
  }

  private beacon(): void {
    const identity = this.store.get().identity;
    if (!identity || !this.udp) return;
    const payload = Buffer.from(
      JSON.stringify({
        nodeId: identity.nodeId,
        address: identity.address,
        name: identity.name,
        port: this.port,
        publicKey: identity.publicKey,
        encPublicKey: this.store.get().encryptionPublicKey,
      }),
    );
    this.udp.send(payload, DISCOVERY_PORT, '255.255.255.255', (error) => {
      if (error) log.debug('mail', 'beacon failed', error);
    });
    try {
      this.udp.send(payload, DISCOVERY_PORT, DISCOVERY_ADDRESS);
    } catch {
      /* ignore */
    }
  }

  private emit(event: { kind: 'message' | 'peer' | 'status' | 'delivery'; message?: MailMessage; peer?: MailPeer; status?: MailStatus }): void {
    try {
      this.onEvent?.(event);
    } catch (error) {
      log.warn('mail', 'event handler failed', error);
    }
  }

  async sync(): Promise<void> {
    for (const peer of this.peers().filter((item) => item.host)) {
      try {
        const info = await this.handshake(peer.host, peer.port);
        this.upsertPeer({ ...peer, name: info.name, address: info.address, publicKey: info.publicKey, lastSeen: nowIso(), online: true });
      } catch {
        /* offline peers are expected */
      }
    }
  }

  hostName(): string {
    return os.hostname();
  }
}
