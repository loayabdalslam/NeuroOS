const fs = require('fs');

const apply = (file, replacements) => {
  let c = fs.readFileSync(file, 'utf8');
  let applied = 0;
  for (const [from, to] of replacements) {
    if (!c.includes(from)) {
      console.log('MISS', file, '::', String(from).slice(0, 70).replace(/\n/g, ' '));
      continue;
    }
    c = c.replace(from, to);
    applied += 1;
  }
  fs.writeFileSync(file, c, 'utf8');
  console.log(file, 'applied', applied, '/', replacements.length);
};

/* harness: web hello has no publicKey */
{
  const p = 'src/main/redteam.ts';
  let c = fs.readFileSync(p, 'utf8');
  c = c.split('attackerHello.publicKey').join('attackerManifest.publicKey');
  fs.writeFileSync(p, c, 'utf8');
}

/* protocol traversal */
apply('src/main/index.ts', [
  [
    `      const file = path.join(app.getAppPath(), 'resources', rel);
      const data = await fs.promises.readFile(file);`,
    `      const resourceRoot = path.join(app.getAppPath(), 'resources');
      const file = path.resolve(resourceRoot, rel);
      if (!file.startsWith(resourceRoot + path.sep)) return new Response('not found', { status: 404 });
      const data = await fs.promises.readFile(file);`,
  ],
]);

/* plugin vm hardening */
{
  const p = 'src/main/services/plugins.service.ts';
  let c = fs.readFileSync(p, 'utf8');
  const start = c.indexOf('const context = vm.createContext({');
  if (start > -1) {
    const end = c.indexOf('\n    });', start);
    if (end > -1) {
      c = c.slice(0, end) + '\n    }, { codeGeneration: { strings: false, wasm: false } });' + c.slice(end + '\n    });'.length);
      fs.writeFileSync(p, c, 'utf8');
      console.log('plugin vm hardened');
    } else console.log('plugin vm end not found');
  } else console.log('plugin vm start not found');
}

/* ---------------- web ---------------- */
apply('src/main/services/web.service.ts', [
  // verifyManifest + nodeId binding
  [
    `  private acceptManifest(manifest: SiteManifest): boolean {
    const body = canonical({ ...manifest, signature: undefined } as never);
    if (!this.verify(body, manifest.signature, manifest.publicKey)) return false;
    if (!/^[a-z0-9-]{2,40}$/.test(manifest.domain)) return false;
    const expectedId = blobId(manifest.publicKey);
    if (expectedId !== manifest.id) return false;
    if (manifest.files.some((file) => !/^[a-f0-9]{64}$/.test(file.hash))) return false;
    const claim = this.claimDomain(manifest);`,
    `  private verifyManifest(manifest: SiteManifest): boolean {
    const body = canonical({ ...manifest, signature: undefined } as never);
    if (!this.verify(body, manifest.signature, manifest.publicKey)) return false;
    if (!/^[a-z0-9-]{2,40}$/.test(manifest.domain)) return false;
    const expectedId = blobId(manifest.publicKey);
    if (expectedId !== manifest.id) return false;
    if (expectedId !== manifest.nodeId) return false;
    if (!Array.isArray(manifest.files) || manifest.files.length > MAX_FILES) return false;
    if (manifest.files.some((file) => !/^[a-f0-9]{64}$/.test(file.hash))) return false;
    return true;
  }

  private acceptManifest(manifest: SiteManifest): boolean {
    if (!this.verifyManifest(manifest)) return false;
    const claim = this.claimDomain(manifest);`,
  ],
  // resolve: verify + cache only, never claim on behalf of a peer
  [
    `        if (!payload.manifest) continue;
        if (!this.acceptManifest(payload.manifest)) continue;
        this.remoteCache.set(domain, { manifest: payload.manifest, host: peer.host, port: peer.port });`,
    `        if (!payload.manifest) continue;
        if (payload.manifest.domain !== domain) continue;
        if (!this.verifyManifest(payload.manifest)) continue;
        this.remoteCache.set(domain, { manifest: payload.manifest, host: peer.host, port: peer.port });`,
  ],
  // symlink/junction skip
  [
    `        const full = path.join(dir, entry.name);
        const relative = prefix ? \`\${prefix}/\${entry.name}\` : entry.name;
        if (entry.isDirectory()) {`,
    `        const full = path.join(dir, entry.name);
        const relative = prefix ? \`\${prefix}/\${entry.name}\` : entry.name;
        try {
          if (fs.lstatSync(full).isSymbolicLink()) continue;
        } catch {
          continue;
        }
        if (entry.isDirectory()) {`,
  ],
  // domain-scoped blob fetch
  [
    `  private async contentFor(file: SiteManifest['files'][number], host: string, port: number): Promise<Buffer | null> {`,
    `  private async contentFor(file: SiteManifest['files'][number], host: string, port: number, domain: string): Promise<Buffer | null> {`,
  ],
  [
    'const response = await fetch(`http://${host}:${port}/web/blob/${file.hash}`, {',
    'const response = await fetch(`http://${host}:${port}/web/blob/${file.hash}?domain=${encodeURIComponent(domain)}`, {',
  ],
  // blob endpoint requires a manifest reference
  [
    `    if (url.pathname.startsWith('/web/blob/')) {
      const hash = url.pathname.split('/').pop() ?? '';
      const data = /^[a-f0-9]{64}$/.test(hash) ? this.readBlob(hash) : null;
      if (!data) return json(404, { error: 'missing blob' });
      return binary(200, data, 'application/octet-stream');
    }`,
    `    if (url.pathname.startsWith('/web/blob/')) {
      const hash = url.pathname.split('/').pop() ?? '';
      const domain = (url.searchParams.get('domain') ?? '').toLowerCase();
      const owner = this.store.get().sites.find((site) => site.domain === domain && site.files.some((file) => file.hash === hash));
      const data = owner && /^[a-f0-9]{64}$/.test(hash) ? this.readBlob(hash) : null;
      if (!data) return json(404, { error: 'missing blob' });
      return binary(200, data, 'application/octet-stream');
    }`,
  ],
  // announce: origin check, proof of content, store only referenced blobs
  [
    `    if (url.pathname === '/web/announce' && request.method === 'POST') {
      let body = '';`,
    `    if (url.pathname === '/web/announce' && request.method === 'POST') {
      const origin = request.headers.origin;
      if (origin && !/^http:\\/\\/(127\\.0\\.0\\.1|localhost)(:\\d+)?$/.test(origin)) {
        return json(403, { error: 'cross-origin announce blocked' });
      }
      let body = '';`,
  ],
  [
    `          if (!payload.manifest) return json(400, { error: 'manifest required' });
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
          return json(accepted ? 200 : 409, { ok: accepted, stored });`,
    `          if (!payload.manifest) return json(400, { error: 'manifest required' });
          if (!this.verifyManifest(payload.manifest)) return json(409, { error: 'invalid manifest' });
          const wanted = new Set(payload.manifest.files.map((file) => file.hash));
          const provided = new Map<string, Buffer>();
          for (const blob of (payload.blobs ?? []).slice(0, MAX_FILES)) {
            const data = Buffer.from(blob.data, 'base64');
            if (!wanted.has(blob.hash)) continue;
            if (crypto.createHash('sha256').update(data).digest('hex') !== blob.hash) continue;
            provided.set(blob.hash, data);
          }
          const missing = [...wanted].filter((hash) => !provided.has(hash) && !this.readBlob(hash));
          if (missing.length) return json(409, { error: 'proof of content required', missing: missing.length });
          let stored = 0;
          for (const [hash, data] of provided) {
            if (this.storeSize() + data.length > MAX_STORE_BYTES) break;
            this.writeBlob(data);
            stored += 1;
            void hash;
          }
          const accepted = this.acceptManifest(payload.manifest);
          this.emit();
          return json(accepted ? 200 : 409, { ok: accepted, stored });`,
  ],
  // binary: security headers for HTML
  [
    `    const binary = (status: number, data: Buffer, type: string): void => {
      response.writeHead(status, { 'content-type': type, 'content-length': data.length, connection: 'close' });
      response.end(data);
    };`,
    `    const binary = (status: number, data: Buffer, type: string): void => {
      const headers: Record<string, string | number> = {
        'content-type': type,
        'content-length': data.length,
        connection: 'close',
        'x-content-type-options': 'nosniff',
      };
      if (type.includes('text/html')) {
        headers['content-security-policy'] =
          "sandbox allow-scripts allow-forms allow-popups allow-modals; default-src 'self' data: blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';";
      }
      response.writeHead(status, headers);
      response.end(data);
    };`,
  ],
  // pass domain when fetching content
  [
    'const data = await this.contentFor(file, resolved.host, resolved.port);',
    'const data = await this.contentFor(file, resolved.host, resolved.port, domain);',
  ],
  // gc on unpublish
  [
    `    this.store.set({ sites, claims });
    this.emit();
    return sites;`,
    `    this.store.set({ sites, claims });
    this.gcBlobs();
    this.emit();
    return sites;`,
  ],
]);

// append gc method before dispose
{
  const p = 'src/main/services/web.service.ts';
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes('private gcBlobs()')) {
    c = c.replace(
      '  async dispose(): Promise<void> {',
      `  private gcBlobs(): void {
    try {
      const used = new Set(this.store.get().sites.flatMap((site) => site.files.map((file) => file.hash)));
      for (const entry of fs.readdirSync(this.blobsDir)) {
        if (!used.has(entry)) fs.rmSync(path.join(this.blobsDir, entry), { force: true });
      }
    } catch (error) {
      log.warn('web', 'blob gc failed', error);
    }
  }

  async dispose(): Promise<void> {`,
    );
    fs.writeFileSync(p, c, 'utf8');
    console.log('gcBlobs added');
  }
}

/* ---------------- mail ---------------- */
apply('src/main/services/mail.service.ts', [
  [
    '  private seen = new Set<string>();',
    '  private seen = new Set<string>();\n  private relayed = new Set<string>();\n  private hits = new Map<string, { count: number; reset: number }>();',
  ],
  [
    `        void (async () => {
          let envelope: Envelope;`,
    `        void (async () => {
          const ip = request.socket.remoteAddress ?? 'unknown';
          const now = Date.now();
          const bucket = this.hits.get(ip) ?? { count: 0, reset: now + 60_000 };
          if (now > bucket.reset) {
            bucket.count = 0;
            bucket.reset = now + 60_000;
          }
          bucket.count += 1;
          this.hits.set(ip, bucket);
          if (bucket.count > 50) return send(429, { error: 'rate limited' });
          let envelope: Envelope;`,
  ],
  [
    `  private async relay(envelope: Envelope, myNodeId: string): Promise<number> {
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
  }`,
    `  private async relay(envelope: Envelope, myNodeId: string): Promise<number> {
    void myNodeId;
    // The envelope is signed end-to-end. Mutating ttl/hops or re-signing it with
    // this node's key invalidates the sender's signature, so forward it verbatim
    // and dedupe relays by id instead (loop protection without breaking auth).
    if (this.relayed.has(envelope.id)) return 0;
    this.relayed.add(envelope.id);
    if (this.relayed.size > 5000) {
      const oldest = this.relayed.values().next().value;
      if (oldest) this.relayed.delete(oldest);
    }
    let count = 0;
    for (const peer of this.peers().slice(0, 16)) {
      if (peer.nodeId === envelope.from.nodeId || peer.nodeId === envelope.to.nodeId) continue;
      if (!peer.port) continue;
      const ok = await this.deliver(envelope, peer);
      if (ok) count += 1;
    }
    return count;
  }`,
  ],
]);
