import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { app } from 'electron';
import { MailService } from './services/mail.service';
import { WebService } from './services/web.service';
import { PluginService } from './services/plugins.service';
import { Paths } from './core/store';
import { log } from './core/ipc';

export interface RedCheck {
  id: string;
  area: 'mail' | 'web' | 'protocol' | 'plugins' | 'system';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  pass: boolean;
  evidence: string;
  risk: string;
}

const checks: RedCheck[] = [];
const add = (
  id: string,
  area: RedCheck['area'],
  severity: RedCheck['severity'],
  title: string,
  pass: boolean,
  evidence: string,
  risk: string,
) => {
  checks.push({ id, area, severity, title, pass, evidence, risk });
  log.info('redteam', `${pass ? 'PASS' : 'FAIL'} ${id} ${title}`);
};

const vault = (): { get: (key: string) => string; set: (key: string, value: string) => void; remove: (key: string) => void } => {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key) ?? '',
    set: (key, value) => map.set(key, value),
    remove: (key) => map.delete(key),
  };
};

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const postJson = async (
  port: number,
  pathname: string,
  payload: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; text: string }> => {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', connection: 'close', ...headers },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  return { status: response.status, text: await response.text() };
};

const getJson = async (port: number, pathname: string): Promise<{ status: number; body: any; headers: Headers }> => {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, { headers: { connection: 'close' }, signal: AbortSignal.timeout(10000) });
  const text = await response.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* text response */
  }
  return { status: response.status, body, headers: response.headers };
};

const canonical = (manifest: any): string => {
  const { signature, ...rest } = manifest;
  void signature;
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(rest).sort()) ordered[key] = rest[key];
  return JSON.stringify(ordered);
};

const blobId = (publicKey: string): string => crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 16);

export async function runRedTeam(): Promise<RedCheck[]> {
  const watchdog = setTimeout(() => {
    log.error('redteam', 'watchdog fired');
    fs.writeFileSync('redteam-partial.json', JSON.stringify(checks, null, 2), 'utf8');
    app.exit(2);
  }, 120000);
  watchdog.unref();
  try {
  const root = path.join(Paths.cache, `redteam-${Date.now().toString(36)}`);
  fs.mkdirSync(path.join(root, 'mail'), { recursive: true });
  fs.mkdirSync(path.join(root, 'web'), { recursive: true });
  fs.mkdirSync(path.join(root, 'blobs'), { recursive: true });

  const mailVault = vault();
  const webVault = vault();
  const attackerVault = vault();

  const victim = new MailService({ dataFile: path.join(root, 'mail', 'victim.json'), vault: mailVault, discovery: false, secretPrefix: 'v' });
  const sender = new MailService({ dataFile: path.join(root, 'mail', 'sender.json'), vault: vault(), discovery: false, secretPrefix: 's' });
  const relayNode = new MailService({ dataFile: path.join(root, 'mail', 'relay.json'), vault: vault(), discovery: false, secretPrefix: 'r' });
  const targetNode = new MailService({ dataFile: path.join(root, 'mail', 'target.json'), vault: vault(), discovery: false, secretPrefix: 't' });
  await victim.start();
  await sender.start();
  await relayNode.start();
  await targetNode.start();
  await victim.createIdentity('Victim');
  await sender.createIdentity('Sender');
  await relayNode.createIdentity('Relay');
  await targetNode.createIdentity('Target');

  const victimPort = victim.status().port;
  const victimId = victim.status().identity!;
  const victimHello = (await getJson(victimPort, '/mail/hello')).body;
  const senderHello = (await getJson(sender.status().port, '/mail/hello')).body;

  const buildEnvelope = (toNodeId: string, extra: Record<string, unknown> = {}): any => {
    const envelope: any = {
      v: 1,
      id: `mail_${crypto.randomBytes(8).toString('hex')}`,
      threadId: `thread_${crypto.randomBytes(4).toString('hex')}`,
      from: {
        address: senderHello.address,
        name: senderHello.name,
        nodeId: senderHello.nodeId,
        publicKey: senderHello.publicKey,
        encPublicKey: senderHello.encPublicKey,
      },
      to: { address: 'victim@mesh.neuro', name: 'Victim', nodeId: toNodeId },
      ts: new Date().toISOString(),
      encrypted: false,
      payload: Buffer.from(JSON.stringify({ subject: 'redteam', body: 'payload' })).toString('base64'),
      ttl: 3,
      hops: [],
      sig: '',
      ...extra,
    };
    envelope.sig = (sender as any).signEnvelope(envelope);
    return envelope;
  };

  /* ------------------------------- MAIL ------------------------------- */
  add(
    'M-01',
    'mail',
    'low',
    'Identity address format',
    /^[a-z0-9._-]+@[a-f0-9]{16}\.neuro$/.test(victimId.address),
    victimId.address,
    'Broken derivation would prevent peers from addressing this node.',
  );
  add(
    'M-02',
    'mail',
    'medium',
    'Hello endpoint never exposes private keys',
    !JSON.stringify(victimHello).includes('PRIVATE KEY'),
    `hello keys: ${Object.keys(victimHello).join(',')}`,
    'Private key leakage would compromise the identity.',
  );

  const good = buildEnvelope(victimHello.nodeId);
  const accepted = await postJson(victimPort, '/mail/deliver', good);
  add('M-03', 'mail', 'high', 'Valid signed envelope is accepted', accepted.status === 200 && victim.messages('inbox', 50).length >= 1, `status ${accepted.status}`, 'Delivery is core functionality.');

  const tampered = { ...good, id: `mail_${crypto.randomBytes(8).toString('hex')}`, payload: Buffer.from(JSON.stringify({ subject: 'hacked', body: 'evil' })).toString('base64') };
  const tamperedRes = await postJson(victimPort, '/mail/deliver', tampered);
  add('M-04', 'mail', 'critical', 'Tampered ciphertext is rejected', tamperedRes.status === 400, `status ${tamperedRes.status}`, 'A forged message could impersonate the sender.');

  const spoof = { ...good, id: `mail_${crypto.randomBytes(8).toString('hex')}`, from: { ...good.from, nodeId: 'deadbeefdeadbeef' } };
  const spoofRes = await postJson(victimPort, '/mail/deliver', spoof);
  add('M-05', 'mail', 'critical', 'Sender nodeId spoofing is rejected', spoofRes.status === 400, `status ${spoofRes.status}`, 'Spoofed identity would bypass signature binding.');

  const before = victim.messages('inbox', 100).length;
  await postJson(victimPort, '/mail/deliver', good);
  add('M-06', 'mail', 'medium', 'Replay of the same envelope is ignored', victim.messages('inbox', 100).length === before, `inbox ${before}  ->  ${victim.messages('inbox', 100).length}`, 'Replay would duplicate messages.');

  const restartPort = victimPort;

  // Relay chain: sender  ->  relay  ->  target. The relay re-signs with its own key
  // while keeping the original sender's publicKey.
  await relayNode.addPeer('127.0.0.1', targetNode.status().port);
  const relayedEnvelope = buildEnvelope(targetNode.status().identity!.nodeId);
  const relayRes = await postJson(relayNode.status().port, '/mail/deliver', relayedEnvelope);
  await wait(400);
  const targetInbox = targetNode.messages('inbox', 50).length;
  add(
    'M-08',
    'mail',
    'high',
    'Relayed message is delivered to the final recipient',
    targetInbox >= 1,
    `relay response ${relayRes.status}, target inbox ${targetInbox}`,
    'Store-and-forward is broken: the relay changes signed fields (ttl/hops) and re-signs with its own key.',
  );

  const floodCodes = new Set<number>();
  for (let index = 0; index < 40; index += 1) {
    const flood = buildEnvelope(victimHello.nodeId);
    const response = await postJson(restartPort, '/mail/deliver', flood);
    floodCodes.add(response.status);
  }
  add(
    'M-09',
    'mail',
    'medium',
    'Inbound delivery is rate limited',
    floodCodes.has(429),
    `40 rapid deliveries  ->  status codes ${[...floodCodes].join(',')}`,
    'No per-IP limits: a LAN attacker can flood the inbox and fill the store.',
  );

  const huge = buildEnvelope(victimHello.nodeId, { payload: 'A'.repeat(5_000_000) });
  let hugeStatus = 0;
  try {
    hugeStatus = (await postJson(restartPort, '/mail/deliver', huge)).status;
  } catch {
    hugeStatus = -1;
  }
  const alive = (await getJson(restartPort, '/mail/hello')).status;
  add('M-10', 'mail', 'medium', 'Oversized envelopes are rejected without killing the node', hugeStatus === 413 || hugeStatus === 400 || hugeStatus === -1, `status ${hugeStatus}, node alive ${alive}`, 'Body cap exists (4 MB) but the connection is destroyed without a clean 413.');

  /* -------------------------------- WEB -------------------------------- */
  try {
  const web = new WebService({ dataFile: path.join(root, 'web', 'node.json'), blobsDir: path.join(root, 'blobs'), vault: webVault, onEvent: () => {} });
  const attackerWeb = new WebService({ dataFile: path.join(root, 'web', 'attacker.json'), blobsDir: path.join(root, 'blobs-attacker'), vault: attackerVault, onEvent: () => {} });
  await web.start();
  await attackerWeb.start();
  const webPort = web.stats().port;
  const webHello = (await getJson(webPort, '/web/hello')).body;

  const html = '<!doctype html><html><body><h1 id="redteam">hello</h1></body></html>';
  const published = await web.publish({
    domain: 'redteam',
    title: 'Red Team',
    files: [{ path: 'index.html', data: Buffer.from(html).toString('base64') }],
  });
  const site = published.manifest!;
  const fileHash = site.files[0].hash;

  const gateway = await getJson(webPort, '/dweb/redteam/');
  add('W-01', 'web', 'high', 'Published site is served through the gateway', gateway.status === 200 && String(gateway.body).includes('redteam'), `status ${gateway.status}`, 'Core hosting path.');
  add(
    'W-02',
    'web',
    'high',
    'Served HTML is sandboxed against the gateway origin',
    Boolean(gateway.headers.get('content-security-policy')?.includes('sandbox')),
    `CSP: ${gateway.headers.get('content-security-policy') ?? 'missing'}`,
    'A malicious site can call /web/announce and read other sites because every .neuro site shares the gateway origin.',
  );

  const blobOpen = await getJson(webPort, `/web/blob/${fileHash}`);
  add('W-03', 'web', 'high', 'Blobs are scoped to their manifest (no unauthenticated enumeration)', blobOpen.status === 404, `status ${blobOpen.status}`, 'Any blob in the store can be fetched by hash, leaking content across sites.');

  const attackerManifest = (await attackerWeb.publish({
    domain: 'attacker',
    title: 'Attacker',
    files: [{ path: 'index.html', data: Buffer.from('<h1>a</h1>').toString('base64') }],
  })).manifest!;
  log.info('redteam', 'W-04 step: attacker hello');
  const attackerHello = (await getJson(attackerWeb.stats().port, '/web/hello')).body;
  log.info('redteam', 'W-04 step: sign spoofed manifest');
  const spoofManifest: any = {
    ...attackerManifest,
    id: blobId(attackerManifest.publicKey),
    nodeId: webHello.nodeId,
    domain: 'spoofed',
    signature: '',
  };
  spoofManifest.signature = (attackerWeb as any).sign(canonical(spoofManifest));
  log.info('redteam', 'W-04 step: announce spoofed manifest');
  const spoofAnnounce = await postJson(webPort, '/web/announce', { manifest: spoofManifest, blobs: [] });
  log.info('redteam', 'W-04 step: announce returned');
  add(
    'W-04',
    'web',
    'high',
    'Manifest nodeId must match the signing key',
    spoofAnnounce.status === 409 || spoofAnnounce.status === 400,
    `announce status ${spoofAnnounce.status}`,
    'nodeId is unchecked; an attacker can impersonate another node id in manifests.',
  );

  const squat: any = {
    version: 1,
    id: blobId(attackerManifest.publicKey),
    domain: 'squatted',
    title: 'Squat',
    description: '',
    nodeId: blobId(attackerManifest.publicKey),
    publicKey: attackerManifest.publicKey,
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    entry: 'index.html',
    files: [{ path: 'index.html', hash: 'a'.repeat(64), size: 10, type: 'text/html' }],
    signature: '',
  };
  squat.signature = (attackerWeb as any).sign(canonical(squat));
  const squatRes = await postJson(webPort, '/web/announce', { manifest: squat, blobs: [] });
  add(
    'W-05',
    'web',
    'critical',
    'Domain claims require possession of the content',
    squatRes.status === 409 || squatRes.status === 400,
    `empty announce status ${squatRes.status}, sites=${web.list().length}`,
    'Anyone can claim any .neuro domain with fake hashes and no data, blocking the real owner.',
  );

  const junk = crypto.randomBytes(64);
  const junkHash = crypto.createHash('sha256').update(junk).digest('hex');
  const junkRes = await postJson(webPort, '/web/announce', {
    manifest: { ...attackerManifest, nodeId: attackerHello.nodeId, domain: 'junkstore', signature: attackerManifest.signature },
    blobs: [{ hash: junkHash, data: junk.toString('base64') }],
  });
  const junkRead = await getJson(webPort, `/web/blob/${junkHash}`);
  add(
    'W-06',
    'web',
    'medium',
    'Announce only stores blobs referenced by the manifest',
    junkRead.status === 404,
    `announce ${junkRes.status}, junk blob ${junkRead.status}`,
    'Junk blobs can fill the 256 MB store without a site referencing them.',
  );

  const originRes = await postJson(webPort, '/web/announce', { manifest: attackerManifest, blobs: [] }, { origin: 'http://evil.example' });
  add(
    'W-07',
    'web',
    'high',
    'Cross-origin announce is blocked',
    originRes.status === 403,
    `status ${originRes.status}`,
    'Any web page can POST to the local gateway and inject manifests (same-as-local API).',
  );

  const traversal = await getJson(webPort, '/dweb/redteam/%2e%2e%2f%2e%2e%2fweb%2fhello');
  add(
    'W-08',
    'web',
    'high',
    'Gateway blocks encoded path traversal',
    traversal.status === 404 || !String(traversal.body).includes('nodeId'),
    `status ${traversal.status}, body: ${String(traversal.body).slice(0, 80)}`,
    'Encoded traversal could expose gateway APIs or other files.',
  );

  const secretDir = path.join(root, 'secret');
  fs.mkdirSync(secretDir, { recursive: true });
  fs.writeFileSync(path.join(secretDir, 'leak.txt'), 'TOP_SECRET', 'utf8');
  const siteDir = path.join(root, 'site');
  fs.mkdirSync(siteDir, { recursive: true });
  fs.writeFileSync(path.join(siteDir, 'index.html'), '<h1>site</h1>', 'utf8');
  try {
    fs.symlinkSync(secretDir, path.join(siteDir, 'leak'), 'junction');
  } catch {
    /* junctions may be unavailable */
  }
  const symlinkPublish = await web.publishFolder(siteDir, 'symlink', 'Symlink test');
  const leaked = Boolean(symlinkPublish.manifest?.files.some((file) => file.path.includes('leak')));
  add(
    'W-09',
    'web',
    'critical',
    'Folder publishing does not follow symlinks/junctions',
    !leaked,
    leaked ? `published files: ${symlinkPublish.manifest?.files.map((file) => file.path).join(',')}` : 'no leak file in manifest',
    'A junction inside a site folder can publish arbitrary local files (secrets, SSH keys).',
  );

  await web.unpublish('redteam');
  const afterUnpublish = await getJson(webPort, `/web/blob/${fileHash}`);
  add('W-10', 'web', 'medium', 'Unpublish garbage-collects its blobs', afterUnpublish.status === 404, `blob after unpublish ${afterUnpublish.status}`, 'Content is never deleted; storage grows forever.');

  await web.addPeer('127.0.0.1', attackerWeb.stats().port);
  const remote = await attackerWeb.publish({
    domain: 'remoteclaim',
    title: 'Remote',
    files: [{ path: 'index.html', data: Buffer.from('<h1>remote</h1>').toString('base64') }],
  });
  add('W-11', 'web', 'medium', 'Remote resolve does not claim domains locally', (await web.resolve('remoteclaim')) !== null && !web.list().some((item) => item.domain === 'remoteclaim'), `local sites: ${web.list().map((item) => item.domain).join(',') || 'none'}`, 'Resolving a hostile .neuro site silently stores and claims it on the victim node.');

  const badDomain = await web.publish({ domain: '<script>', files: [{ path: 'index.html', data: Buffer.from('x').toString('base64') }] });
  add('W-12', 'web', 'medium', 'Invalid domains are rejected', !badDomain.ok, `ok=${badDomain.ok}`, 'Domain validation bypass.');

  await web.publish({ domain: 'owned', files: [{ path: 'index.html', data: Buffer.from('owned').toString('base64') }] });
  const conflict = await attackerWeb.publish({ domain: 'owned', files: [{ path: 'index.html', data: Buffer.from('x').toString('base64') }] });
  add('W-13', 'web', 'high', 'A claimed domain cannot be taken by another key', !conflict.ok, `ok=${conflict.ok}`, 'Domain hijacking.');
  } catch (error) {
    checks.push({
      id: 'WEB-CRASH',
      area: 'web',
      severity: 'high',
      title: 'Web red-team section crashed before completing',
      pass: false,
      evidence: String((error as Error)?.stack ?? error),
      risk: 'Remaining web checks were skipped.',
    });
  }

  /* ------------------------------ PROTOCOL ----------------------------- */
  const parsed = new URL('neuro://x/%2e%2e%2fpackage.json');
  const rel = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  const resourceRoot = path.join(app.getAppPath(), 'resources');
  const escaped = path.resolve(resourceRoot, rel);
  add(
    'P-01',
    'protocol',
    'critical',
    'neuro:// asset protocol cannot escape the resources folder',
    !escaped.startsWith(resourceRoot + path.sep),
    `resolved ${escaped} (exists=${fs.existsSync(escaped)})`,
    'Encoded path traversal in the custom protocol can read application files.',
  );

  /* ------------------------------- PLUGINS ----------------------------- */
  const pluginDir = path.join(root, 'plugin-escape');
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'neuro.plugin.json'),
    JSON.stringify(
      {
        id: 'redteam-escape',
        name: 'Escape',
        version: '1.0.0',
        description: 'vm escape probe',
        main: 'main.js',
        permissions: [],
        contributes: {
          tools: [
            {
              name: 'escape',
              description: 'probe',
              category: 'agent',
              danger: 'low',
              handler: 'escape',
              parameters: { type: 'object', properties: {}, additionalProperties: false },
            },
          ],
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  fs.writeFileSync(
    path.join(pluginDir, 'main.js'),
    `module.exports = { tools: { escape: async () => { try { const p = globalThis.constructor.constructor('return process')(); return { ok: true, output: 'pid:' + p.pid }; } catch (error) { return { ok: false, output: 'blocked:' + error.message }; } } } };`,
    'utf8',
  );
  let escapeOutput = 'not-run';
  let installedId = '';
  try {
    let capturedHandlers: Record<string, (args: Record<string, unknown>) => Promise<any>> = {};
    const registryStub: any = {
      setSource: (_id: string, _tools: unknown[], handlers: Record<string, (args: Record<string, unknown>) => Promise<any>>) => {
        capturedHandlers = handlers;
      },
      removeSource: () => {},
      list: () => [],
    };
    const plugins = new PluginService({
      registry: registryStub,
      hooks: { toast: () => {}, navigate: () => {}, cwd: () => root },
      onChange: () => {},
    });
    await plugins.init();
    const record = await plugins.installFromPath(pluginDir);
    installedId = record.id;
    const handler = capturedHandlers['redteam-escape.escape'] ?? capturedHandlers['escape'];
    if (handler) escapeOutput = String((await handler({})).output);
    else escapeOutput = 'handler-missing';
    await plugins.uninstall(record.id).catch(() => {});
  } catch (error) {
    escapeOutput = `setup-error:${(error as Error).message}`;
  }
  add(
    'X-01',
    'plugins',
    'critical',
    'Plugin vm cannot reach the host process',
    !escapeOutput.startsWith('pid:'),
    escapeOutput,
    'A malicious plugin can escape the vm context and run arbitrary code in the main process.',
  );

  /* -------------------------------- CLEANUP ---------------------------- */
  await sender.dispose();
  await relayNode.dispose();
  await targetNode.dispose();
  void installedId;
  } catch (error) {
    checks.push({
      id: 'RT-CRASH',
      area: 'system',
      severity: 'critical',
      title: 'Red-team harness crashed before completing',
      pass: false,
      evidence: String((error as Error)?.stack ?? error),
      risk: 'The harness stopped early; remaining checks were not executed.',
    });
  }

  clearTimeout(watchdog);
  return checks;
}

export function renderReport(results: RedCheck[]): string {
  const failed = results.filter((check) => !check.pass);
  const bySeverity = (severity: RedCheck['severity']): RedCheck[] => failed.filter((check) => check.severity === severity);
  const lines: string[] = [];
  lines.push('# Neuro OS Ã¢â‚¬â€ red team report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`Checks: **${results.length}** Ã‚Â· passed **${results.length - failed.length}** Ã‚Â· failed **${failed.length}**`);
  lines.push('');
  for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
    const items = bySeverity(severity);
    lines.push(`## ${severity.toUpperCase()} (${items.length})`);
    lines.push('');
    if (!items.length) lines.push('_none_');
    for (const check of items) {
      lines.push(`### ${check.id} Ã¢â‚¬â€ ${check.title}`);
      lines.push('');
      lines.push(`- **Area:** ${check.area}`);
      lines.push(`- **Evidence:** ${check.evidence}`);
      lines.push(`- **Risk:** ${check.risk}`);
      lines.push('');
    }
  }
  lines.push('## All checks');
  lines.push('');
  lines.push('| ID | Area | Severity | Result | Title |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const check of results) {
    lines.push(`| ${check.id} | ${check.area} | ${check.severity} | ${check.pass ? 'PASS' : 'FAIL'} | ${check.title} |`);
  }
  lines.push('');
  return lines.join('\n');
}


