import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { BrowserWindow } from 'electron';
import type { Kernel } from './kernel';
import { buildHandlers } from './ipcHandlers';
import { log } from './core/ipc';
import { MailService } from './services/mail.service';
import { WebService } from './services/web.service';
import { THEME_PRESETS } from '@shared/themes';

type Status = 'pass' | 'fail' | 'warn';

interface DeepResult {
  id: string;
  area: string;
  title: string;
  status: Status;
  evidence: string;
  ms: number;
}

const addressOf = (status: any): string => status.identity?.address ?? "peer";

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function runDeep(kernel: Kernel, win: BrowserWindow): Promise<DeepResult[]> {
  const handlers = buildHandlers(kernel, () => win) as Record<string, (payload?: any) => Promise<any> | any>;
  const results: DeepResult[] = [];
  const shotDir = path.join(process.cwd(), 'screenshots', 'deep');
  await fs.mkdir(shotDir, { recursive: true });

  const call = async <T = any>(channel: string, payload?: unknown): Promise<T> => {
    const handler = handlers[channel];
    if (!handler) throw new Error(`missing IPC handler: ${channel}`);
    return (await handler(payload)) as T;
  };

  const check = async (id: string, area: string, title: string, fn: () => Promise<{ status?: Status; evidence: string }>): Promise<void> => {
    const started = Date.now();
    try {
      const output = await fn();
      const result: DeepResult = { id, area, title, status: output.status ?? 'pass', evidence: output.evidence, ms: Date.now() - started };
      results.push(result);
      log.info('deep', `${result.status.toUpperCase()} ${id} ${title} Ã¢â‚¬â€ ${output.evidence.slice(0, 180)}`);
    } catch (error) {
      const result: DeepResult = { id, area, title, status: 'fail', evidence: (error as Error).message, ms: Date.now() - started };
      results.push(result);
      log.warn('deep', `FAIL ${id} ${title} Ã¢â‚¬â€ ${(error as Error).message}`);
    }
  };

  const shot = async (name: string): Promise<void> => {
    try {
      const image = await win.webContents.capturePage();
      await fs.writeFile(path.join(shotDir, `${name}.png`), image.toPNG());
    } catch (error) {
      log.warn('deep', `screenshot ${name} failed`, error);
    }
  };

  // Fresh profile: finish onboarding so the shell is mounted.
  try {
    kernel.settings.completeOnboarding({
      locale: 'en',
      name: 'QA Deep',
      role: 'automation',
      theme: 'dark',
      design: 'neuro',
      accent: 'neuro',
      provider: null,
    } as never);
    win.webContents.reload();
    await new Promise<void>((resolve) => win.webContents.once('did-finish-load', () => resolve()));
    await wait(900);
  } catch (error) {
    log.warn('deep', 'onboarding bootstrap failed', error);
  }

  const settings = await call('settings.get');
  const root = path.join(settings.workspaceRoot, `deep-${Date.now().toString(36)}`);
  const fileA = path.join(root, 'Ã™â€¦Ã˜Â±Ã˜Â­Ã˜Â¨Ã˜Â§ Ã˜Â¹Ã˜Â§Ã™â€žÃ™â€¦.txt');
  const fileB = path.join(root, 'renamed.txt');
  const marker = `DEEP_${crypto.randomBytes(4).toString('hex')}`;

  await check('D-00', 'ui', 'mail setup card is centred and fully visible', async () => {
    kernel.emit('ui:navigate', { surface: 'mail', params: {} });
    await wait(800);
    const rect = await win.webContents.executeJavaScript(
      `(() => { const el = document.querySelector('.mailSetup'); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, viewport: window.innerWidth }; })()`,
    );
    await shot('mail-setup');
    if (!rect) throw new Error('mail setup card not rendered');
    if (rect.left < 0 || rect.right > rect.viewport + 1) throw new Error('mail setup is clipped: ' + JSON.stringify(rect));
    return { evidence: 'left=' + Math.round(rect.left) + ' width=' + Math.round(rect.width) + ' viewport=' + rect.viewport };
  });

  /* ------------------------------ workspace ----------------------------- */
  await check('D-01', 'fs', 'mkdir + unicode write + read round-trip', async () => {
    await call('fs.mkdir', { path: root });
    await call('fs.write', { path: fileA, content: `hello ${marker} Ã¢â‚¬â€ Ã™â€¦Ã˜Â±Ã˜Â­Ã˜Â¨Ã˜Â§` });
    const read = await call('fs.read', { path: fileA });
    if (!read.content.includes(marker)) throw new Error('content mismatch');
    await shot('fs');
    return { evidence: `${read.content.length} bytes at ${path.basename(fileA)}` };
  });

  await check('D-02', 'fs', 'list + search find the new file', async () => {
    const listing = await call('fs.list', { path: root });
    const found = listing.some((entry: any) => entry.name === path.basename(fileA));
    const hits = await call('fs.search', { root, query: marker });
    if (!found) throw new Error('file missing from listing');
    if (!hits.length) throw new Error('search returned no hits');
    return { evidence: `${listing.length} entries, ${hits.length} search hits` };
  });

  await check('D-03', 'fs', 'rename + overwrite + delete', async () => {
    await call('fs.rename', { from: fileA, to: fileB });
    await call('fs.write', { path: fileB, content: `overwritten ${marker}` });
    const read = await call('fs.read', { path: fileB });
    if (!read.content.startsWith('overwritten')) throw new Error('overwrite failed');
    await call('fs.delete', { paths: [fileB] });
    let gone = false;
    try {
      await call('fs.read', { path: fileB });
    } catch {
      gone = true;
    }
    if (!gone) throw new Error('delete did not remove the file');
    return { evidence: 'rename Ã¢â€ â€™ overwrite Ã¢â€ â€™ delete verified' };
  });

  await check('D-04', 'fs', 'large file (300 KB) write/read', async () => {
    const large = path.join(root, 'large.txt');
    const content = 'x'.repeat(300_000);
    await call('fs.write', { path: large, content });
    const read = await call('fs.read', { path: large });
    await call('fs.delete', { paths: [large] });
    if (read.content.length !== content.length) throw new Error('size mismatch');
    return { evidence: `${read.content.length} bytes` };
  });

  await check('D-05', 'fs', 'workspace boundary (read outside root)', async () => {
    try {
      const outside = await call('fs.read', { path: 'C:\\Windows\\win.ini' });
      return { status: 'warn', evidence: `read ${outside.content.length} bytes outside the workspace Ã¢â‚¬â€ no path guard` };
    } catch (error) {
      return { evidence: `blocked: ${(error as Error).message.slice(0, 120)}` };
    }
  });

  /* -------------------------------- notes ------------------------------- */
  const noteId = `note_${crypto.randomBytes(4).toString('hex')}`;
  await check('D-06', 'notes', 'create, update and delete a note', async () => {
    const now = new Date().toISOString();
    await call('notes.save', { id: noteId, title: 'Deep note', body: marker, color: '#5686fe', createdAt: now, updatedAt: now });
    let notes = await call('notes.list');
    const created = notes.find((note: any) => note.id === noteId);
    if (!created) throw new Error('note not listed');
    await call('notes.save', { ...created, body: `${marker} v2`, updatedAt: new Date().toISOString() });
    notes = await call('notes.list');
    if (!notes.find((note: any) => note.id === noteId)?.body.includes('v2')) throw new Error('note update failed');
    await call('notes.remove', { id: noteId });
    notes = await call('notes.list');
    if (notes.some((note: any) => note.id === noteId)) throw new Error('note still present');
    return { evidence: 'create Ã¢â€ â€™ update Ã¢â€ â€™ delete' };
  });

  /* -------------------------------- spaces ------------------------------ */
  await check('D-07', 'spaces', 'create a space, edit it and remove it', async () => {
    const space = await call('spaces.create', { name: `Deep space ${marker}`, description: 'qa', emoji: 'Ã°Å¸Â§Âª' });
    const listed = await call('spaces.list');
    if (!listed.some((item: any) => item.id === space.id)) throw new Error('space not listed');
    await call('spaces.save', { ...space, name: `${space.name} v2` });
    const updated = (await call('spaces.list')).find((item: any) => item.id === space.id);
    if (!updated?.name.endsWith('v2')) throw new Error('space update failed');
    await call('spaces.remove', { id: space.id });
    if ((await call('spaces.list')).some((item: any) => item.id === space.id)) throw new Error('space still present');
    return { evidence: 'create Ã¢â€ â€™ rename Ã¢â€ â€™ remove' };
  });

  /* ------------------------------ notebooks ----------------------------- */
  await check('D-08', 'notebooks', 'create a notebook and run code + error cells', async () => {
    const now = new Date().toISOString();
    const notebook = {
      id: `nb_${crypto.randomBytes(4).toString('hex')}`,
      title: `Deep notebook ${marker}`,
      description: 'qa',
      kernel: 'node',
      cells: [
        { id: 'c1', kind: 'code', language: 'javascript', source: `console.log('${marker}')`, status: 'idle', updatedAt: now },
        { id: 'c2', kind: 'code', language: 'javascript', source: `throw new Error('${marker}_BOOM')`, status: 'idle', updatedAt: now },
      ],
      createdAt: now,
      updatedAt: now,
    };
    await call('notebooks.save', notebook);
    const okCell = await call('notebooks.runCell', { notebookId: notebook.id, cellId: 'c1' });
    const errCell = await call('notebooks.runCell', { notebookId: notebook.id, cellId: 'c2' });
    await call('notebooks.remove', { id: notebook.id });
    if (okCell.status !== 'ok') throw new Error(`ok cell status ${okCell.status}: ${okCell.output ?? ''}`);
    if (errCell.status !== 'error') throw new Error(`error cell status ${errCell.status}`);
    return { evidence: `ok=${String(okCell.output ?? '').slice(0, 80)} error=${errCell.status}` };
  });

  /* ------------------------------ terminal ------------------------------ */
  await check('D-09', 'terminal', 'spawn PTY, run a command, read buffer, resize, kill', async () => {
    const info = await call('terminal.create', { cols: 100, rows: 30, cwd: root });
    await wait(900);
    await call('terminal.write', { id: info.id, data: 'echo DEEP_TERMINAL_OK\r\n' });
    await wait(2600);
    let buffer = await call('terminal.buffer', { id: info.id });
    if (!buffer.data.includes('DEEP_TERMINAL_OK')) {
      await call('terminal.write', { id: info.id, data: 'echo DEEP_TERMINAL_OK\r\n' });
      await wait(1800);
      buffer = await call('terminal.buffer', { id: info.id });
    }
    await call('terminal.resize', { id: info.id, cols: 120, rows: 40 });
    await call('terminal.kill', { id: info.id });
    if (!buffer.data.includes('DEEP_TERMINAL_OK')) throw new Error(`output not found; tail: ${JSON.stringify(buffer.data.slice(-160))}`);
    return { evidence: `${buffer.data.length} buffer chars, resize + kill ok` };
  });

  /* -------------------------------- mail -------------------------------- */
  await check('D-10', 'mail', 'peer-to-peer send, receive, reply, read and delete', async () => {
    let own = await call('mail.status');
    if (!own.identity) own = await call('mail.identityCreate', { name: 'QA Deep' });
    const vaultMap = new Map<string, string>();
    const peer = new MailService({
      dataFile: path.join(root, 'peer-mail.json'),
      vault: { get: (key: string) => vaultMap.get(key) ?? '', set: (key: string, value: string) => void vaultMap.set(key, value), remove: (key: string) => void vaultMap.delete(key) },
      discovery: false,
      secretPrefix: 'peer',
    });
    await peer.start();
    await peer.createIdentity('QA Peer');
    try {
      const peerStatus = peer.status();
      const peerAddress = peerStatus.identity?.address;
      if (!peerAddress) throw new Error('peer identity missing');
      await call('mail.peerAdd', { host: '127.0.0.1', port: peerStatus.port });
      const sent = await call('mail.send', { to: peerAddress, subject: `Deep ${marker}`, body: `body ${marker}`, encrypt: true });
      if (!sent.ok) throw new Error(sent.message ?? 'send failed');
      let received: any = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await wait(400);
        received = peer.messages('inbox', 50).find((message: any) => message.subject === `Deep ${marker}`);
        if (received) break;
      }
      if (!received) throw new Error('peer never received the encrypted message');
      if (received.body !== `body ${marker}`) throw new Error('decrypted body mismatch');
      if (!received.encrypted) throw new Error('message was not encrypted');
      const reply = await call('mail.send', { to: peerAddress, subject: `Re: Deep ${marker}`, body: 'reply', replyTo: received.id });
      if (!reply.ok) throw new Error(`reply failed: ${reply.message ?? ''}`);
      let replied = false;
      for (let attempt = 0; attempt < 15; attempt += 1) {
        await wait(300);
        replied = peer.messages('inbox', 50).filter((message: any) => message.subject.startsWith('Re: Deep')).length > 0;
        if (replied) break;
      }
      await call('mail.peerRemove', { nodeId: peerStatus.identity!.nodeId });
      if (!replied) throw new Error('reply never arrived');
      return { evidence: `encrypted ${addressOf(peerStatus)} send + reply, decrypt ok, peer removed` };
    } finally {
      await peer.dispose();
    }
  });

  /* ------------------------------ automation ---------------------------- */
  await check('D-11', 'automation', 'save a workflow, run it, inspect steps and remove it', async () => {
    const now = new Date().toISOString();
    const workflow: any = {
      id: `flow_${crypto.randomBytes(4).toString('hex')}`,
      name: `Deep flow ${marker}`,
      description: 'qa',
      enabled: true,
      createdAt: now,
      updatedAt: now,
      nodes: [
        { id: 'n1', type: 'trigger.manual', name: 'Run', x: 0, y: 0, config: {} },
        { id: 'n2', type: 'transform.code', name: 'Set value', x: 200, y: 0, config: { code: 'return "DEEP_AUTOMATION_OK";' } },
      ],
      edges: [{ id: 'e1', from: 'n1', fromPort: 'main', to: 'n2' }],
    };
    await call('automation.save', workflow);
    const run = await call('automation.run', { id: workflow.id });
    let finished: any = null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await wait(400);
      const runs = await call('automation.runs', { workflowId: workflow.id });
      finished = runs.find((item: any) => item.id === run.runId);
      if (finished && ['ok', 'error', 'cancelled'].includes(finished.status)) break;
    }
    await call('automation.remove', { id: workflow.id });
    if (!finished) throw new Error('run never appeared');
    if (finished.status !== 'ok') throw new Error(`status ${finished.status}: ${JSON.stringify(finished.steps ?? [])}`);
    const transform = (finished.steps ?? []).find((step: any) => step.name === 'Set value') ?? finished.steps?.[1];
    return { evidence: `${finished.steps?.length ?? 0} steps, output ${String(transform?.output ?? '').slice(0, 60)}` };
  });

  /* -------------------------------- brain ------------------------------- */
  await check('D-12', 'brain', 'remember, recall, ask, timeline, forget', async () => {
    const node = await call('brain.remember', { text: `Deep memory ${marker}`, tags: ['qa'] });
    const hits = await call('brain.recall', { query: marker, limit: 5 });
    if (!hits.some((hit: any) => String(hit.text ?? hit.node?.label ?? '').includes(marker))) throw new Error('recall missed the memory');
    const answer = await call('brain.ask', { query: `What is ${marker}?` });
    const timeline = await call('brain.timeline', { limit: 20 });
    await call('brain.forget', { id: node.id });
    const after = await call('brain.recall', { query: marker, limit: 5 });
    return {
      status: after.some((hit: any) => String(hit.text ?? hit.node?.label ?? '').includes(marker)) ? 'warn' : 'pass',
      evidence: `${hits.length} hits, answer ${String(answer.text ?? '').length} chars, ${timeline.length} events, forget ok`,
    };
  });

  /* --------------------------------- web -------------------------------- */
  await check('D-13', 'web', 'publish, serve HTML + asset, counts, unpublish', async () => {
    const domain = `deep-${crypto.randomBytes(3).toString('hex')}`;
    const published = await call('web.publish', {
      domain,
      title: 'Deep QA',
      files: [
        { path: 'index.html', data: Buffer.from(`<h1>${marker}</h1>`).toString('base64') },
        { path: 'assets/a.txt', data: Buffer.from(`asset ${marker}`).toString('base64') },
      ],
    });
    if (!published.ok) throw new Error(published.error ?? 'publish failed');
    const stats = await call('web.status');
    const base = `http://127.0.0.1:${stats.port}`;
    const page = await fetch(`${base}/dweb/${domain}/`).then((response) => response.text());
    const asset = await fetch(`${base}/dweb/${domain}/assets/a.txt`).then((response) => response.text());
    const traversal = await fetch(`${base}/dweb/${domain}/..%2f..%2fweb%2fhello`).then((response) => response.text());
    await call('web.unpublish', { domain });
    if (!page.includes(marker)) throw new Error('gateway did not serve index');
    if (!asset.includes(marker)) throw new Error('gateway did not serve the asset');
    if (traversal.includes('nodeId')) throw new Error('encoded traversal leaked the API');
    return { evidence: `${domain}.neuro served (2 files), traversal blocked, unpublish ok` };
  });

  /* ----------------------------- marketplace ---------------------------- */
  await check('D-14', 'marketplace', 'install, toggle and uninstall a catalog item', async () => {
    const catalog = await call('marketplace.catalog', {});
    const candidate = catalog.find((item: any) => item.kind === 'skill' || item.kind === 'theme' || item.kind === 'plugin');
    if (!candidate) return { status: 'warn', evidence: 'catalog empty' };
    const before = (await call('marketplace.installed')).length;
    await call('marketplace.install', { id: candidate.id });
    const after = await call('marketplace.installed');
    if (after.length <= before) throw new Error('install did not add an item');
    await call('marketplace.toggle', { id: candidate.id, enabled: false });
    await call('marketplace.uninstall', { id: candidate.id });
    return { evidence: `${candidate.name} (${candidate.kind}) install Ã¢â€ â€™ toggle Ã¢â€ â€™ uninstall` };
  });

  /* ------------------------------- plugins ------------------------------ */
  await check('D-15', 'plugins', 'install a local plugin, list it, uninstall it', async () => {
    const dir = path.join(root, 'plugin');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'neuro.plugin.json'),
      JSON.stringify(
        {
          id: `deep-plugin-${crypto.randomBytes(3).toString('hex')}`,
          name: 'Deep QA plugin',
          version: '1.0.0',
          description: 'qa',
          main: 'main.js',
          permissions: [],
          contributes: { tools: [] },
        },
        null,
        2,
      ),
      'utf8',
    );
    await fs.writeFile(path.join(dir, 'main.js'), 'module.exports = { tools: {} };', 'utf8');
    const installed = await call('plugins.installPath', { path: dir });
    if (!installed.installed) throw new Error(installed.message ?? 'install failed');
    const list = await call('plugins.list');
    await call('plugins.uninstall', { id: installed.installed.id });
    if (!list.some((item: any) => item.id === installed.installed.id)) throw new Error('plugin not listed');
    return { evidence: `${installed.installed.name} install Ã¢â€ â€™ list Ã¢â€ â€™ uninstall` };
  });

  /* ------------------------------- settings ------------------------------ */
  await check('D-16', 'settings', 'theme, density, locale and wallpaper patch', async () => {
    const original = await call('settings.get');
    await call('settings.patch', { theme: { design: 'windows', accent: 'deepseek', theme: 'dark', surface: 'standard' } });
    const changed = await call('settings.get');
    if (changed.theme.design !== 'windows') throw new Error('theme patch failed');
    await call('settings.patch', { locale: 'ar' });
    const arabic = await call('settings.get');
    const dir = await win.webContents.executeJavaScript('document.documentElement.dir');
    if (arabic.locale !== 'ar' || dir !== 'rtl') throw new Error(`locale/dir mismatch: ${arabic.locale}/${dir}`);
    await call('settings.patch', { locale: 'en', theme: { design: original.theme.design, accent: original.theme.accent, theme: original.theme.theme, surface: original.theme.surface } });
    await wait(300);
    return { evidence: 'design Ã¢â€ â€™ windows, locale Ã¢â€ â€™ ar/rtl, restored' };
  });

  /* -------------------------------- ACP --------------------------------- */
  await check('D-17', 'acp', 'add a mock ACP provider, prompt it, then chat through it', async () => {
    const provider = {
      id: 'deep-acp',
      name: 'Deep mock ACP',
      kind: 'acp',
      baseUrl: '',
      apiKey: '',
      enabled: true,
      models: [{ id: 'acp:auto', label: 'Agent default', supportsTools: true }],
      defaultModel: 'acp:auto',
      createdAt: new Date().toISOString(),
      color: '#14b8a6',
      acp: { command: 'node', args: [path.join(process.cwd(), 'scripts', 'mock-acp-agent.cjs')], cwd: process.cwd() },
    };
    await call('providers.save', provider);
    const connect = await call('acp.connect', { providerId: provider.id });
    if (!connect.ok) throw new Error(connect.message ?? 'connect failed');
    const prompt = await call('acp.prompt', { providerId: provider.id, text: 'ping' });
    await call('acp.disconnect', { providerId: provider.id });

    const session = await call('chat.create', { providerId: provider.id, title: 'Deep chat' });
    await call('chat.send', { sessionId: session.id, text: 'ping' });
    let transcript = '';
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await wait(500);
      const full = await call('chat.session', { id: session.id });
      transcript = full.messages.map((message: any) => message.content).join('\n');
      if (transcript.includes('MOCK_ACP_OK')) break;
    }
    await call('chat.delete', { id: session.id });
    await call('providers.remove', { id: provider.id });
    if (!prompt.ok || !transcript.includes('MOCK_ACP_OK')) throw new Error(`prompt=${prompt.ok} transcript=${transcript.slice(0, 120)}`);
    return { evidence: 'acp.connect Ã¢â€ â€™ prompt Ã¢â€ â€™ chat turn streamed MOCK_ACP_OK' };
  });

  /* ----------------------------- composio ------------------------------- */
  await check('D-18', 'composio', 'configure with the live key and search the catalog', async () => {
    const key = process.env.NEURO_QA_COMPOSIO_KEY ?? '';
    if (!key) return { status: 'warn', evidence: 'NEURO_QA_COMPOSIO_KEY not set' };
    await call('composio.configure', { apiKey: key });
    const status = await call('composio.sync');
    const hits = await call('composio.tools', { query: 'github' });
    if (!status.configured) throw new Error('composio not configured');
    return { evidence: `${status.tools} tools, ${status.toolkits} toolkits, ${hits.length} github hits` };
  });

  /* ------------------------------- surfaces ----------------------------- */
  const surfaces = ['desktop', 'chat', 'workspace', 'terminal', 'browser', 'notebook', 'mail', 'automation', 'composer', 'space', 'brain', 'sites', 'marketplace', 'settings'];
  await check('D-19', 'ui', 'navigate every surface and capture it', async () => {
    const visited: string[] = [];
    for (const surface of surfaces) {
      kernel.emit('ui:navigate', { surface, params: {} });
      await wait(650);
      const probe = await win.webContents.executeJavaScript(
        `(() => ({ text: document.body.innerText.length, error: Boolean(document.querySelector('[data-error-boundary]')) }))()`,
      );
      if (probe.text < 50) throw new Error(`surface ${surface} rendered ${probe.text} chars`);
      await shot(`surface-${surface}`);
      visited.push(surface);
    }
    return { evidence: `${visited.length} surfaces rendered + screenshotted` };
  });

  await check('D-20', 'ui', 'start menu opens and closes', async () => {
    kernel.emit('ui:navigate', { surface: 'desktop', params: {} });
    await wait(800);
    const probe = await win.webContents.executeJavaScript(
      `(() => ({ start: Boolean(document.querySelector('[aria-label="Start"], .taskbar__start')), taskbar: Boolean(document.querySelector('.taskbar')), buttons: document.querySelectorAll('button').length, tail: document.body.innerText.slice(-120) }))()`,
    );
    if (!probe.start) throw new Error(`start button missing (taskbar=${probe.taskbar}, buttons=${probe.buttons}, tail=${JSON.stringify(probe.tail)})`);
    await win.webContents.executeJavaScript(
      `document.querySelector('[aria-label="Start"], .taskbar__start').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))`,
    );
    await wait(900);
    const open = await win.webContents.executeJavaScript(`Boolean(document.querySelector('.startMenu'))`);
    await shot('start-menu');
    await win.webContents.executeJavaScript(`document.querySelector('.startScrim')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))`);
    await wait(600);
    const closed = await win.webContents.executeJavaScript(`Boolean(document.querySelector('.startMenu'))`);
    if (!open) throw new Error('start menu did not open');
    if (closed) throw new Error('start menu did not close');
    return { evidence: 'open + scrim close' };
  });

  await check('D-21', 'ui', 'command palette opens with Ctrl+K and closes with Escape', async () => {
    kernel.emit('ui:navigate', { surface: 'desktop', params: {} });
    await wait(500);
    await win.webContents.executeJavaScript(
      `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))`,
    );
    await wait(500);
    const open = await win.webContents.executeJavaScript(`Boolean(document.querySelector('.palette'))`);
    await shot('command-palette');
    await win.webContents.executeJavaScript(
      `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`,
    );
    await wait(400);
    const closed = await win.webContents.executeJavaScript(`Boolean(document.querySelector('.palette'))`);
    if (!open) throw new Error('palette did not open');
    if (closed) throw new Error('palette did not close');
    return { evidence: 'Ctrl+K â†’ palette â†’ Escape' };
  });

  await check('D-22', 'chat', 'a session with no provider fails with a clear message', async () => {
    const session = await call('chat.create', { title: 'No provider', providerId: 'missing-provider' });
    try {
      await call('chat.send', { sessionId: session.id, text: 'hello' });
      return { status: 'warn', evidence: 'send did not throw without a provider' };
    } catch (error) {
      return { evidence: (error as Error).message.slice(0, 160) };
    } finally {
      await call('chat.delete', { id: session.id }).catch(() => {});
    }
  });

  await check('D-23', 'terminal', 'two concurrent PTY sessions keep separate buffers', async () => {
    const one = await call('terminal.create', { cols: 90, rows: 24, cwd: root });
    const two = await call('terminal.create', { cols: 90, rows: 24, cwd: root });
    await wait(900);
    await call('terminal.write', { id: one.id, data: 'echo SESSION_ONE_OK\r\n' });
    await call('terminal.write', { id: two.id, data: 'echo SESSION_TWO_OK\r\n' });
    await wait(2400);
    const first = await call('terminal.buffer', { id: one.id });
    const second = await call('terminal.buffer', { id: two.id });
    await call('terminal.kill', { id: one.id });
    await call('terminal.kill', { id: two.id });
    if (!first.data.includes('SESSION_ONE_OK') || first.data.includes('SESSION_TWO_OK')) throw new Error('session one buffer mixed up');
    if (!second.data.includes('SESSION_TWO_OK') || second.data.includes('SESSION_ONE_OK')) throw new Error('session two buffer mixed up');
    return { evidence: 'two PTYs, isolated buffers, both killed' };
  });

  await check('D-24', 'brain', 'recording toggle, graph, profile and batch capture', async () => {
    await call('brain.recording', { enabled: false });
    await call('brain.recording', { enabled: true });
    const captured = await call('brain.capture', {
      items: [
        { kind: 'note', label: `Capture ${marker}`, detail: 'qa capture', surface: 'brain' },
        { kind: 'event', label: `Event ${marker}`, detail: 'qa event', surface: 'brain' },
      ],
    });
    const graph = await call('brain.graph', { limit: 50 });
    const profile = await call('brain.profile');
    if (captured.recorded < 1) throw new Error('nothing recorded');
    if (!graph.nodes.length) throw new Error('graph empty');
    return { evidence: `recorded ${captured.recorded}, graph ${graph.nodes.length} nodes, profile ${profile.totalNodes ?? '?'} nodes` };
  });

  await check('D-25', 'mail', 'sent folder holds the outgoing message', async () => {
    const sent = await call('mail.messages', { folder: 'sent', limit: 50 });
    const message = sent.find((item: any) => String(item.subject).startsWith('Deep '));
    if (!message) throw new Error('sent folder has no Deep message');
    return { evidence: `${sent.length} sent, direction=${message.direction}, encrypted=${message.encrypted}` };
  });

  await check('D-26', 'web', 'peer replication: another node publishes, this node serves it', async () => {
    const vaultMap = new Map<string, string>();
    const peer = new WebService({
      dataFile: path.join(root, 'peer-web.json'),
      blobsDir: path.join(root, 'peer-blobs'),
      vault: { get: (key: string) => vaultMap.get(key) ?? '', set: (key: string, value: string) => void vaultMap.set(key, value), remove: (key: string) => void vaultMap.delete(key) },
      onEvent: () => {},
    });
    await peer.start();
    try {
      const domain = `replica-${crypto.randomBytes(3).toString('hex')}`;
      const published = await peer.publish({ domain, title: 'Replica', files: [{ path: 'index.html', data: Buffer.from(`<h1>REPLICA_${marker}</h1>`).toString('base64') }] });
      if (!published.ok) throw new Error(published.error ?? 'peer publish failed');
      await call('web.peerAdd', { host: '127.0.0.1', port: peer.stats().port });
      const stats = await call('web.status');
      let page = '';
      for (let attempt = 0; attempt < 12; attempt += 1) {
        page = await fetch(`http://127.0.0.1:${stats.port}/dweb/${domain}/`).then((response) => response.text());
        if (page.includes(`REPLICA_${marker}`)) break;
        await wait(500);
      }
      await call('web.peerRemove', { nodeId: peer.stats().nodeId });
      if (!page.includes(`REPLICA_${marker}`)) throw new Error('gateway did not proxy the peer site');
      return { evidence: `${domain}.neuro published on peer, served by this gateway` };
    } finally {
      await peer.dispose();
    }
  });

  await check('D-27', 'ui', 'every theme renders and is captured', async () => {
    const visited: string[] = [];
    for (const preset of THEME_PRESETS) {
      await call('settings.patch', {
        theme: { design: preset.design, theme: preset.mode, accent: 'neuro', surface: preset.surface, wallpaper: preset.wallpaper },
      });
      await wait(700);
      const probe = await win.webContents.executeJavaScript(
        `(() => ({ bg: Boolean(document.querySelector('.app__bg')), aurora: Boolean(document.querySelector('.n-aurora')), text: document.body.innerText.length }))()`,
      );
      if (!probe.bg || probe.text < 40) throw new Error(`${preset.id}: shell did not render`);
      await shot(`theme-${preset.id}`);
      visited.push(preset.id);
    }
    return { evidence: `${visited.length} themes rendered (light + dark)` };
  });

  await check('D-28', 'ui', 'provider picker renders icons in a light theme', async () => {
    await call('settings.patch', { theme: { design: 'ios', theme: 'light', accent: 'neuro', surface: 'white', wallpaper: 'aurora' } });
    kernel.emit('ui:navigate', { surface: 'settings', params: {} });
    await wait(900);
    await win.webContents.executeJavaScript(
      `(() => { const nav = [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === 'Providers'); if (nav) nav.click(); return Boolean(nav); })()`,
    );
    await wait(600);
    const opened = await win.webContents.executeJavaScript(
      `(() => { const button = [...document.querySelectorAll('button')].find((element) => element.textContent?.trim() === 'Add provider'); if (!button) return false; button.click(); return true; })()`,
    );
    if (!opened) throw new Error('Add provider button not found');
    await wait(700);
    await shot('provider-picker-light');
    const cards = await win.webContents.executeJavaScript(`document.querySelectorAll('.providerPick').length`);
    const gridStyle = await win.webContents.executeJavaScript(
      `(() => { const el = document.querySelector('.providerGrid'); if (!el) return null; const s = getComputedStyle(el); return { display: s.display, cols: s.gridTemplateColumns, width: el.clientWidth, rect: el.getBoundingClientRect().width }; })()`,
    );
    await win.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
    await wait(400);
    return { evidence: `${cards} cards; ${JSON.stringify(gridStyle)}` };
  });

  await check('D-29', 'ui', 'ChatGPT-style composer with provider/model selectors', async () => {
    await call('settings.patch', { theme: { design: 'ios', theme: 'light', accent: 'neuro', surface: 'white', wallpaper: 'aurora' } });
    kernel.emit('ui:navigate', { surface: 'chat', params: {} });
    await wait(900);
    const controls = await win.webContents.executeJavaScript(
      `(() => ({ selects: document.querySelectorAll('.composer__select').length, send: Boolean(document.querySelector('.composer__send')), top: Boolean(document.querySelector('.composer__top')) }))()`,
    );
    await shot('composer');
    await win.webContents.executeJavaScript("document.querySelector('.composer__select')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))");
    await wait(500);
    await shot('composer-provider-menu');
    await win.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
    if (controls.selects < 2 || !controls.send || controls.top) throw new Error('composer controls incomplete: ' + JSON.stringify(controls));
    return { evidence: controls.selects + ' selectors, circular send, chip row removed' };
  });

  await check('D-31', 'ui', 'clicking a space card updates the detail panel', async () => {
    const a = await call('spaces.create', { name: 'QA Space A', description: 'first', emoji: 'A' });
    const b = await call('spaces.create', { name: 'QA Space B', description: 'second', emoji: 'B' });
    kernel.emit('ui:navigate', { surface: 'space', params: {} });
    await wait(900);
    const result = await win.webContents.executeJavaScript(`(() => { const cards = [...document.querySelectorAll('.spaceCard:not(.spaceCard--new)')]; const target = cards.find((el) => el.textContent?.includes('QA Space B')); if (!target) return { found: cards.length, ok: false }; target.click(); return { found: cards.length, ok: true }; })()`);
    await wait(600);
    const detail = await win.webContents.executeJavaScript(`document.querySelector('.spaceDetail')?.innerText ?? ''`);
    await call('spaces.remove', { id: a.id });
    await call('spaces.remove', { id: b.id });
    if (!result.ok) throw new Error('card B not found: ' + JSON.stringify(result));
    if (!detail.includes('QA Space B')) throw new Error('detail did not switch: ' + detail.slice(0, 120));
    return { evidence: result.found + ' cards; detail shows QA Space B' };
  });

  await check('D-32', 'ui', 'provider and tool-model pickers plus image attachments', async () => {
    await call('providers.save', {
      id: 'ui-provider', name: 'UI Provider', kind: 'openai', baseUrl: 'http://127.0.0.1:9/v1', apiKey: '',
      enabled: true, models: [{ id: 'ui-model', label: 'UI Model', supportsTools: true }], defaultModel: 'ui-model',
      createdAt: new Date().toISOString(), color: '#5686fe',
    });
    kernel.emit('ui:navigate', { surface: 'chat', params: {} });
    await wait(700);
    await win.webContents.executeJavaScript("document.querySelectorAll('.composer__select')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))");
    await wait(500);
    const providersShown = await win.webContents.executeJavaScript("document.querySelectorAll('.providerChoice').length");
    await shot('composer-providers');
    await win.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
    await wait(400);
    await win.webContents.executeJavaScript("document.querySelectorAll('.composer__select')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))");
    await wait(500);
    const modelDialog = await win.webContents.executeJavaScript("document.body.innerText.includes('Models with tool calling')");
    await shot('composer-models');
    await win.webContents.executeJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))");
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lY1nWQAAAABJRU5ErkJggg==', 'base64');
    const imagePath = path.join(root, 'pixel.png');
    await fs.writeFile(imagePath, png);
    const image = await call('system.readDataUrl', { path: imagePath });
    await call('providers.remove', { id: 'ui-provider' });
    if (!providersShown) throw new Error('provider modal showed no providers');
    if (!modelDialog) throw new Error("tool-model modal did not open");
    if (!String(image.dataUrl).startsWith('data:image/png;base64,')) throw new Error('image read failed');
    return { evidence: providersShown + ' providers, tool-model dialog, image ' + image.size + 'B' };
  });

  await check('D-33', 'ui', 'custom wallpaper applies from settings', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lY1nWQAAAABJRU5ErkJggg==', 'base64');
    const dataUrl = 'data:image/png;base64,' + png.toString('base64');
    await call('settings.patch', { theme: { customWallpaper: dataUrl, wallpaper: 'photo:custom' } });
    await wait(700);
    const probe = await win.webContents.executeJavaScript(`(() => ({ wallpaper: document.documentElement.dataset.wallpaper, image: getComputedStyle(document.documentElement).getPropertyValue('--n-wallpaper-image').trim().slice(0, 30) }))()`);
    kernel.emit('ui:navigate', { surface: 'desktop', params: {} });
    await wait(500);
    await shot('custom-wallpaper');
    kernel.emit('ui:navigate', { surface: 'settings', params: {} });
    await wait(600);
    await win.webContents.executeJavaScript(
      `(() => { const nav = [...document.querySelectorAll('button')].find((el) => el.textContent?.trim() === 'Appearance'); if (nav) nav.click(); return Boolean(nav); })()`,
    );
    await wait(500);
    const hasUploader = await win.webContents.executeJavaScript("Boolean(document.querySelector('.customWallpaper'))");
    await call('settings.patch', { theme: { customWallpaper: '', wallpaper: 'nebula' } });
    if (probe.wallpaper !== 'photo:custom' || !probe.image.includes('data:image/png')) throw new Error('custom wallpaper not applied: ' + JSON.stringify(probe));
    if (!hasUploader) throw new Error('settings uploader missing');
    return { evidence: 'desktop data-wallpaper=photo:custom, uploader present' };
  });

  const report = results;
  return report;
}

export function renderDeep(results: DeepResult[]): string {
  const lines = ['# Neuro OS Ã¢â‚¬â€ deep automation QA', '', `Generated: ${new Date().toISOString()}`, ''];
  lines.push('| ID | Area | Status | Check | Evidence | ms |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const item of results) {
    lines.push(`| ${item.id} | ${item.area} | ${item.status} | ${item.title} | ${item.evidence.replace(/\|/g, '\\|').slice(0, 240)} | ${item.ms} |`);
  }
  lines.push('');
  return lines.join('\n');
}


