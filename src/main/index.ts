import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, Menu, nativeTheme, protocol, shell } from 'electron';
import { IpcRouter, log } from './core/ipc';
import { createKernel, type Kernel } from './kernel';
import { buildHandlers } from './ipcHandlers';
import { Paths, ensureProfileDirs } from './core/store';
import { startMockProvider } from './selftest/mockProvider';
import { startMockComposio } from './selftest/mockComposio';
import { MailService } from './services/mail.service';
import { WebService } from './services/web.service';

const isDev = !app.isPackaged;
const isSelftest = process.argv.includes('--selftest');
const SHOTS_DIR = path.join(process.cwd(), 'screenshots');

app.setName('Neuro OS');
if (process.platform === 'win32') app.setAppUserModelId('ai.neuro.os');

// A stable compositor makes `capturePage` deterministic for the design harness.
app.commandLine.appendSwitch('force-color-profile', 'srgb');

let mainWindow: BrowserWindow | null = null;
let kernel: Kernel | null = null;
let router: IpcRouter | null = null;
let statsTimer: NodeJS.Timeout | null = null;

const getWindow = (): BrowserWindow | null => mainWindow;

function loadRenderer(win: BrowserWindow): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (isDev && devUrl) void win.loadURL(devUrl);
  else void win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function createWindow(onLoaded?: () => void): BrowserWindow {
  const settings = kernel?.settings.public();
  const bounds = settings?.window ?? { width: 1480, height: 940, maximized: false };
  const win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    frame: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#151517' : '#f9fafb',
    title: 'Neuro OS',
    icon: path.join(app.getAppPath(), 'resources', 'brand', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      spellcheck: true,
    },
  });

  if (bounds.maximized && !isSelftest) win.maximize();
  win.setMenuBarVisibility(false);
  Menu.setApplicationMenu(null);

  win.once('ready-to-show', () => {
    win.show();
    if (isDev && !isSelftest) win.webContents.openDevTools({ mode: 'detach' });
  });

  const broadcastState = (): void => {
    router?.emit('window:state', { maximized: win.isMaximized(), focused: win.isFocused(), fullscreen: win.isFullScreen() });
  };
  win.on('maximize', broadcastState);
  win.on('unmaximize', broadcastState);
  win.on('focus', broadcastState);
  win.on('blur', broadcastState);
  win.on('enter-full-screen', broadcastState);
  win.on('leave-full-screen', broadcastState);

  win.on('close', () => {
    if (!kernel) return;
    const b = win.getNormalBounds();
    kernel.settings.patch({ window: { width: b.width, height: b.height, x: b.x, y: b.y, maximized: win.isMaximized() } });
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-attach-webview', (_event, webPreferences) => {
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.preload = undefined;
  });

  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    log.error('window', `renderer failed to load (${code} ${description}) ${url}`);
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('window', 'renderer crashed', details);
  });

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) log.warn('renderer', `${message} (${sourceId}:${line})`);
    else log.debug('renderer', message);
  });

  if (onLoaded) win.webContents.once('did-finish-load', onLoaded);

  loadRenderer(win);
  return win;
}

async function startStatsLoop(): Promise<void> {
  if (!kernel || !router) return;
  const tick = (): void => {
    try {
      router?.emit('system:stats', kernel!.system.stats());
    } catch (error) {
      log.warn('system', 'stats tick failed', error);
    }
  };
  tick();
  statsTimer = setInterval(tick, 2500);
}

async function runSelfTest(win: BrowserWindow): Promise<void> {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const watchdog = setTimeout(() => {
    log.error('selftest', 'watchdog timeout ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â exiting');
    app.exit(2);
  }, 180_000);
  watchdog.unref();
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
  const screenshot = async (name: string): Promise<void> => {
    await wait(700);
    // Force two composited frames: capturePage can otherwise return the previous
    // surface's frame when the window is not focused (headless harness).
    await win.webContents
      .executeJavaScript('Promise.race([new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))), new Promise((resolve) => setTimeout(() => resolve(false), 500))])')
      .catch(() => {});
    await wait(160);
    const image = await win.webContents.capturePage();
    const file = path.join(SHOTS_DIR, `${name}.png`);
    fs.writeFileSync(file, image.toPNG());
    log.info('selftest', `captured ${file}`);
  };

  // Wait for the renderer to signal first paint.
  for (let i = 0; i < 100; i += 1) {
    const ready = await win.webContents.executeJavaScript('document.body.dataset.neuroReady === "1"').catch(() => false);
    if (ready) break;
    await wait(200);
  }

  if (!kernel) return;

  const mock = await startMockProvider();

  // Force a clean first-run experience so the harness is deterministic.
  kernel.settings.reset();
  for (const existing of kernel.agent.listSessions()) await kernel.agent.deleteSession(existing.id);
  router?.emit('settings:changed', kernel.settings.public());
  await wait(1400);
  await win.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('neuro:story'))`).catch(() => {});
  await wait(13500);
  await screenshot('00-story');
  const storyQuote = await win.webContents
    .executeJavaScript(
      `JSON.stringify({ chars: document.querySelector('.story__quote')?.textContent?.trim().length ?? 0, scroll: document.querySelector('.story__quote')?.scrollHeight ?? 0, client: document.querySelector('.story__quote')?.clientHeight ?? 0, persona: document.querySelector('.story__name')?.textContent?.trim() ?? '' })`,
    )
    .catch((error) => String(error));
  log.info('selftest', `story quote ${storyQuote}`);
  const storySkip = await win.webContents
    .executeJavaScript(`(() => { const button = document.querySelector('.story__skipCorner'); if (!button) return 'missing'; button.click(); return 'clicked'; })()`)
    .catch((error) => String(error));
  log.info('selftest', `story intro: ${storySkip}`);
  await wait(900);
  await screenshot('01-onboarding');

  // Walk to the appearance step (welcome ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ language ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ profile ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ appearance).
  for (let i = 0; i < 3; i += 1) {
    const clicked = await win.webContents
      .executeJavaScript(`(() => {
        const nameInput = document.querySelector('.onboard__fields input');
        if (nameInput && !nameInput.value) {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(nameInput, 'Youssef');
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const btn = document.querySelector('.onboard__footRight .n-btn--primary');
        if (!btn) return 'no-button';
        if (btn.disabled) return 'disabled';
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return 'clicked';
      })()`)
      .catch((error) => `js-error: ${String(error)}`);
    log.info('selftest', `onboarding step click ${i + 1}: ${clicked}`);
    await wait(900);
    if (i === 0) {
      const pickLanguage = async (label: string): Promise<string> =>
        win.webContents
          .executeJavaScript(
            `(() => { const card = [...document.querySelectorAll('.langcard')].find((element) => element.textContent?.includes(${JSON.stringify(label)})); if (!card) return 'missing'; card.click(); return 'clicked'; })()`,
          )
          .catch((error) => String(error));
      const pickedArabic = await pickLanguage('العربية');
      await wait(800);
      await screenshot('01c-onboarding-arabic');
      const liveLocale = await win.webContents
        .executeJavaScript(
          `JSON.stringify({ dir: document.documentElement.dir, lang: document.documentElement.lang, heading: document.querySelector('.onboard__title')?.textContent?.trim() ?? '', next: document.querySelector('.onboard__footRight .n-btn--primary')?.textContent?.trim() ?? '' })`,
        )
        .catch((error) => String(error));
      log.info('selftest', `live locale: ${pickedArabic} ${liveLocale}`);
      await pickLanguage('English');
      await wait(700);
    }
  }
  await screenshot('01b-onboarding-appearance');

  // Fast-forward onboarding so every surface can be captured.
  kernel.settings.completeOnboarding({
    locale: 'en',
    name: 'Youssef',
    role: 'AI systems engineer',
    theme: 'dark',
    accent: 'neuro',
    design: 'neuro',
    surface: 'standard',
    workspaceRoot: path.join(Paths.workspaces, 'Neuro Demo'),
    provider: {
      id: 'sandbox',
      name: 'Neuro Sandbox',
      kind: 'openai',
      baseUrl: `${mock.url}/v1`,
      apiKey: 'sandbox',
      enabled: true,
      models: [{ id: 'neuro-sandbox', label: 'Neuro Sandbox', supportsTools: true, contextWindow: 128000 }],
      defaultModel: 'neuro-sandbox',
      color: '#22c55e',
      createdAt: new Date().toISOString(),
    },
  });
  log.info('selftest', 'onboarding completed');
  await kernel.workspace.ensureDemoWorkspace(path.join(Paths.workspaces, 'Neuro Demo'));
  log.info('selftest', 'workspace ready');
  kernel.content.seedSpaces();
  kernel.content.seedNotebooks();
  kernel.content.seedNotes();
  log.info('selftest', 'content seeded');

  // Seed the Anchor exactly as the real onboarding IPC does.
  const demoRoot = kernel.settings.public().workspaceRoot;
  const firstNote = kernel.content.notes()[0];
  const basePins = kernel.settings.public().anchor.pins;
  if (!basePins.length) {
    kernel.settings.patch({
      anchor: {
        ...kernel.settings.public().anchor,
        pins: [
          { id: 'pin_selftest_ws', kind: 'file', ref: demoRoot, label: path.basename(demoRoot), subtitle: 'workspace root', order: 0 },
          ...(firstNote
            ? [{ id: 'pin_selftest_note', kind: 'note' as const, ref: firstNote.id, label: firstNote.title, subtitle: firstNote.body.slice(0, 60), order: 1 }]
            : []),
        ],
      },
    });
  }
  try {
    await kernel.marketplace.install('deep-research');
    await kernel.marketplace.install('git-nexus');
    await kernel.marketplace.install('code-review');
    await kernel.marketplace.install('sysprobe');
  } catch (error) {
    log.warn('selftest', 'seed install failed', error);
  }
  log.info('selftest', 'marketplace seeded');
  router?.emit('settings:changed', kernel.settings.public());
  log.info('selftest', 'shell emitted');
  await wait(1600);

  // Exercise the real agent loop against the sandbox endpoint: streaming,
  // a tool call, the tool result round-trip and persistence.
  const session = await kernel.agent.createSession({ title: 'Sandbox Ãƒâ€šÃ‚Â· system check' });
  await kernel.agent.send(session.id, 'Check this machine and summarise it in one line.');
  await wait(5200);
  const transcript = await kernel.agent.getSession(session.id);
  const assistant = [...transcript.messages].reverse().find((message) => message.role === 'assistant');
  log.info(
    'selftest',
    `chat turn: messages=${transcript.messages.length} chars=${assistant?.content.length ?? 0} tools=${
      assistant?.toolCalls?.map((call) => `${call.name}:${call.status}`).join(',') ?? 'none'
    }`,
  );

  // Filesystem round-trip (real disk I/O inside the demo workspace).
  const root = kernel.settings.public().workspaceRoot;
  const probeFile = path.join(root, 'selftest-probe.md');
  await kernel.workspace.write(probeFile, '# Probe\n\nWritten by the selftest harness.\n');
  const read = await kernel.workspace.read(probeFile);
  const hits = await kernel.workspace.search(root, 'selftest harness');
  await kernel.workspace.remove([probeFile]);
  log.info('selftest', `fs round-trip: bytes=${read.content.length} searchHits=${hits.length}`);

  // Notebook kernel.
  const notebook = kernel.content.notebooks()[0];
  const codeCell = notebook?.cells.find((cell) => cell.kind === 'code');
  if (notebook && codeCell) {
    const ran = await kernel.content.runCell(notebook.id, codeCell.id);
    log.info('selftest', `notebook: status=${ran.status} output=${(ran.output ?? '').slice(0, 80).replace(/\n/g, ' ')}`);
  }

  // Tool bus through the real registry.
  const shellTool = await kernel.tools.invoke('shell.exec', { command: 'echo neuro-tool-bus' });
  log.info('selftest', `tool shell.exec: ${shellTool.status} ${(shellTool.output ?? '').slice(0, 60).replace(/\n/g, ' ')}`);

  /* ---------------------- decentralized mail (two nodes) ---------------------- */
  const inboxBefore = kernel.mail.status().unread;
  let peerNode: MailService | null = null;
  try {
    await kernel.mail.resetIdentity();
    const peerMailFile = path.join(Paths.cache, 'selftest-peer-mail.json');
    try {
      fs.rmSync(peerMailFile, { force: true });
    } catch {
      /* ignore */
    }
    const peerVault = (() => {
      const map = new Map<string, string>();
      return { get: (key: string) => map.get(key) ?? '', set: (key: string, value: string) => map.set(key, value) };
    })();
    peerNode = new MailService({
      dataFile: peerMailFile,
      vault: peerVault,
      discovery: false,
      secretPrefix: 'peer',
    });
    await peerNode.start();
    log.info('selftest', `mail identity: main=${kernel.mail.status().identity ? 'exists' : 'none'} peer=${peerNode.status().identity ? 'exists' : 'none'}`);
    if (!kernel.mail.status().identity) await kernel.mail.createIdentity('Youssef');
    if (!peerNode.status().identity) await peerNode.createIdentity('Ada');
    const myMail = kernel.mail.status();
    const peerMail = peerNode.status();
    await kernel.mail.addPeer('127.0.0.1', peerMail.port);
    await peerNode.addPeer('127.0.0.1', myMail.port);
    await peerNode.send({
      to: myMail.identity!.address,
      subject: 'Welcome to the mesh',
      body: 'This message travelled directly between two nodes ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â no server in between.',
    });
    await wait(1400);
    const inbox = kernel.mail.messages('inbox', 5);
    const received = inbox.find((message) => message.subject === 'Welcome to the mesh');
    log.info(
      'selftest',
      `mail p2p: peers=${kernel.mail.status().peers.length} inbox=${inbox.length} unread=${inboxBefore}ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢${kernel.mail.status().unread} encrypted=${received?.encrypted} verified=${received?.verified}`,
    );
  } catch (error) {
    log.error('selftest', `mail test failed: ${(error as Error).message}`);
  }

  /* ---------------------------- plugin lifecycle ----------------------------- */
  const examplesRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'examples')
    : path.join(app.getAppPath(), 'examples');
  const helloPlugin = path.join(examplesRoot, 'plugins', 'hello-neuro');
  if (fs.existsSync(helloPlugin)) {
    const installed = await kernel.plugins.installFromPath(helloPlugin);
    const pluginTool = await kernel.tools.invoke('hello-neuro.greet', { name: 'Youssef' });
    const pluginThemes = kernel.plugins.themes().length;
    await kernel.plugins.uninstall(installed.id);
    log.info(
      'selftest',
      `plugin: installed=${installed.name}@${installed.version} tool=${pluginTool.status} "${(pluginTool.output ?? '').slice(0, 40)}" themes=${pluginThemes} uninstalled=${kernel.plugins.list().length === 0}`,
    );
  } else {
    log.warn('selftest', `plugin example not found at ${helloPlugin}`);
  }

  /* ------------------------------- automation -------------------------------- */
  const nowStamp = new Date().toISOString();
  const workflow = {
    id: 'flow_selftest',
    name: 'Selftest pipeline',
    description: 'trigger ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ transform ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ notify',
    nodes: [
      { id: 'n1', type: 'trigger.manual' as const, name: 'Start', x: 60, y: 80, config: {} },
      { id: 'n2', type: 'transform.code' as const, name: 'Uppercase', x: 330, y: 80, config: { code: 'return input.toUpperCase();' } },
      { id: 'n3', type: 'notify.toast' as const, name: 'Notify', x: 600, y: 80, config: { title: 'Selftest', message: '{{input}}' } },
    ],
    edges: [
      { id: 'e1', from: 'n1', fromPort: 'main' as const, to: 'n2' },
      { id: 'e2', from: 'n2', fromPort: 'main' as const, to: 'n3' },
    ],
    enabled: true,
    createdAt: nowStamp,
    updatedAt: nowStamp,
  };
  await kernel.automation.save(workflow);
  const automationRun = await kernel.automation.run(workflow.id, 'manual', 'hello automation');
  await wait(900);
  const finishedRun = kernel.automation.runs(workflow.id).find((run) => run.id === automationRun.runId);
  log.info('selftest', `automation: status=${finishedRun?.status} steps=${finishedRun?.steps.length} last="${(finishedRun?.steps.at(-1)?.output ?? '').slice(0, 32)}"`);

  /* ------------------------- agent composition ------------------------------- */
  const composition = {
    id: 'comp_selftest',
    name: 'Selftest composition',
    description: '',
    steps: [{ id: 's1', name: 'Respond', agentId: 'neuro', prompt: 'Repeat this input verbatim, then add the word DONE: {{input}}', usePrevious: false }],
    createdAt: nowStamp,
    updatedAt: nowStamp,
  };
  kernel.compositions.save(composition);
  const composed = await kernel.compositions.runInline(composition.id, 'neuro composition test');
  log.info('selftest', `composition: chars=${composed.length} "${composed.slice(0, 46).replace(/\n/g, ' ')}"`);

  /* ------------------------------ composio ---------------------------------- */
  const mockComposio = await startMockComposio();
  try {
    kernel.composio.configure({ apiKey: 'comp_selftest', baseUrl: mockComposio.url, userId: 'neuro-selftest' });
    const synced = await kernel.composio.sync();
    await kernel.composio.refreshAccounts();
    await kernel.composio.toggle('GITHUB_CREATE_ISSUE', true);
    const action = await kernel.tools.invoke('composio.github_create_issue', { owner: 'octo', repo: 'neuro', title: 'Hello from the harness' });
    const search = await kernel.tools.invoke('composio.search', { query: 'email' });
    log.info(
      'selftest',
      `composio: tools=${synced.tools} toolkits=${synced.toolkits} accounts=${kernel.composio.accounts().length} enabled=${synced.enabled} action=${action.status} "${(action.output ?? '').slice(0, 38).replace(/\n/g, ' ')}" search=${search.status}`,
    );
  } catch (error) {
    log.error('selftest', `composio test failed: ${(error as Error).message}`);
  }

  /* --------------------- decentralized web (two nodes) ---------------------- */
  const peerWebFile = path.join(Paths.cache, 'selftest-web-peer.json');
  try {
    fs.rmSync(peerWebFile, { force: true });
  } catch {
    /* ignore */
  }
  const peerWebVault = (() => {
    const map = new Map<string, string>();
    return { get: (key: string) => map.get(key) ?? '', set: (key: string, value: string) => map.set(key, value) };
  })();
  const peerWeb = new WebService({ dataFile: peerWebFile, vault: peerWebVault, onEvent: () => {} });
  await peerWeb.start();
  kernel.web.addPeer('127.0.0.1', peerWeb.stats().port);
  peerWeb.addPeer('127.0.0.1', kernel.web.stats().port);
  const siteHtml = '<!doctype html><html><head><title>Selftest</title></head><body><h1 id="neuro-web-ok">Hello from the mesh</h1></body></html>';
  const published = await kernel.web.publish({
    domain: 'selftest',
    title: 'Selftest site',
    description: 'Hosted by the QA harness',
    files: [{ path: 'index.html', data: Buffer.from(siteHtml).toString('base64') }],
  });
  await wait(700);
  const resolvedSite = await peerWeb.resolve('selftest');
  const served = resolvedSite
    ? await fetch(`http://127.0.0.1:${peerWeb.stats().port}/dweb/selftest/`)
        .then((response) => response.text())
        .catch((error) => `ERR ${(error as Error).message}`)
    : 'NO_RESOLVE';
  log.info(
    'selftest',
    `web p2p: published=${published.ok} domain=${published.manifest?.domain}.neuro resolved=${Boolean(resolvedSite)} served=${served.includes('neuro-web-ok')} peerSites=${peerWeb.stats().sites} hits=${peerWeb.stats().hits} bytes=${kernel.web.stats().bytes}`,
  );

  /* ------------------------------- brain ----------------------------------- */
  const seed: { kind: string; label: string; surface?: string; app?: string; detail?: string; tags?: string[] }[] = [
    { kind: 'app', label: 'chat', surface: 'chat', app: 'chat' },
    { kind: 'chat', label: 'Asked Neuro: summarise my mail', surface: 'chat', app: 'chat', detail: 'summarise my mail', tags: ['mail'] },
    { kind: 'chat', label: 'Asked Neuro: build a workflow', surface: 'chat', app: 'chat', detail: 'build a workflow', tags: ['automation'] },
    { kind: 'navigate', label: 'Settings page', surface: 'settings', app: 'settings' },
    { kind: 'click', label: 'Appearance', surface: 'settings', app: 'settings' },
    { kind: 'click', label: 'Providers', surface: 'settings', app: 'settings' },
    { kind: 'navigate', label: 'Mail page', surface: 'mail', app: 'mail' },
    { kind: 'mail', label: 'ada@selftest.neuro', surface: 'mail', app: 'mail', detail: 'Welcome to the mesh', tags: ['mail'] },
    { kind: 'mail', label: 'youssef@selftest.neuro', surface: 'mail', app: 'mail', detail: 'Re: mesh', tags: ['mail'] },
    { kind: 'navigate', label: 'Sites page', surface: 'sites', app: 'sites' },
    { kind: 'site', label: 'selftest.neuro', surface: 'sites', app: 'sites', detail: 'Selftest site', tags: ['site'] },
    { kind: 'click', label: 'Publish to the mesh', surface: 'sites', app: 'sites' },
    { kind: 'navigate', label: 'Automation page', surface: 'automation', app: 'automation' },
    { kind: 'workflow', label: 'Selftest pipeline', surface: 'automation', app: 'automation', detail: 'manual run' },
    { kind: 'navigate', label: 'Terminal page', surface: 'terminal', app: 'terminal' },
    { kind: 'tool', label: 'shell.exec', surface: 'terminal', app: 'terminal', detail: 'echo neuro-tool-bus' },
    { kind: 'navigate', label: 'Workspace page', surface: 'workspace', app: 'workspace' },
    { kind: 'click', label: 'Save file', surface: 'workspace', app: 'workspace' },
    { kind: 'memory', label: 'Prefers concise answers', detail: 'Prefers concise answers with no filler', tags: ['memory', 'preference'] },
    { kind: 'query', label: 'Asked memory: what did I do with mail', surface: 'brain', app: 'brain', detail: 'what did I do with mail' },
  ];
  kernel.brain.capture(seed);
  await win.webContents.executeJavaScript(`document.querySelector('.dock__collapse')?.click()`).catch(() => {});
  await wait(2200);
  await win.webContents.executeJavaScript(`document.querySelector('.dock__collapse')?.click()`).catch(() => {});
  const brainTool = await kernel.tools.invoke('brain.recall', { query: 'settings' });
  const brainStats = kernel.brain.stats();
  const brainHits = kernel.brain.recall('settings', 5);
  const brainAnswer = kernel.brain.ask('mail');
  log.info(
    'selftest',
    `brain tool=${brainTool.status} brain: nodes=${brainStats.nodes} edges=${brainStats.edges} events=${brainStats.events} indexed=${brainStats.indexed} recall=${brainHits.length} top="${brainHits[0]?.node.label ?? '-'}" ask="${brainAnswer.text.slice(0, 52).replace(/\n/g, ' ')}"`,
  );

  const surfaces: [string, string, Record<string, string>?][] = [
    ['02-desktop', 'desktop'],
    ['03-chat', 'chat'],
    ['04-workspace', 'workspace'],
    ['05-space', 'space'],
    ['06-notebook', 'notebook'],
    ['07-browser', 'browser'],
    ['08-terminal', 'terminal'],
    ['09-marketplace', 'marketplace'],
    ['09b-extensions', 'marketplace', { tab: 'plugins' }],
    ['10-settings', 'settings'],
    ['21-integrations', 'settings', { section: 'integrations' }],
    ['22-sites', 'sites'],
    ['23-neuroweb', 'browser', { mode: 'dweb' }],
    ['25-brain', 'brain'],
    ['17-mail', 'mail'],
    ['18-automation', 'automation'],
    ['19-composer', 'composer'],
  ];

  for (const [name, surface, params] of surfaces) {
    router?.emit('ui:navigate', { surface, params: params ?? {} });
    if (surface === 'desktop') {
      await wait(400);
      router?.emit('os:open', { appId: 'chat' });
      await wait(300);
      router?.emit('os:open', { appId: 'terminal' });
      await wait(300);
      router?.emit('os:open', { appId: 'mail' });
    }
    await wait(surface === 'browser' ? 1800 : surface === 'settings' ? 1800 : 1000);
    await screenshot(name);
  }

  // Guest-webview verification: capturePage cannot composite guest surfaces, so
  // assert the loaded page title and URL instead of a screenshot.
  for (const url of ['https://example.com', 'https://en.wikipedia.org/wiki/Operating_system']) {
    router?.emit('ui:navigate', { surface: 'browser', params: { url } });
    await wait(4200);
    const probe = await win.webContents
      .executeJavaScript(
        `(() => { const w = document.querySelector('webview'); try { return JSON.stringify({ title: w.getTitle(), url: w.getURL(), loading: w.isLoading() }); } catch (e) { return 'probe error: ' + e.message; } })()`,
      )
      .catch((error) => `probe failed: ${String(error)}`);
    log.info('selftest', `webview ${url} ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ ${probe}`);
  }
  router?.emit('ui:navigate', { surface: 'browser', params: {} });
  await wait(600);

  // Theme gallery verification: render the desktop under each design language.
  const themes: [string, Record<string, unknown>, Record<string, unknown>][] = [
    ['13-theme-windows', { design: 'windows', mode: 'light', surface: 'standard', accent: 'deepseek', radius: 8, wallpaper: 'mica-light', transparency: true, glow: false }, { position: 'bottom' }],
    ['14-theme-ubuntu', { design: 'ubuntu', mode: 'dark', surface: 'standard', accent: 'amber', radius: 10, wallpaper: 'aubergine', transparency: false, glow: false }, { position: 'top' }],
    ['15-theme-ios', { design: 'ios', mode: 'light', surface: 'white', accent: 'neuro', radius: 20, wallpaper: 'aurora', transparency: true, glow: false }, { position: 'bottom' }],
    ['16-theme-white', { design: 'neuro', mode: 'light', surface: 'white', accent: 'deepseek', radius: 14, wallpaper: 'paper', transparency: true, glow: false }, { position: 'bottom' }],
  ];
  for (const [name, theme, taskbar] of themes) {
    kernel.settings.patch({ theme: { ...(theme as object) } as never, taskbar: taskbar as never });
    router?.emit('settings:changed', kernel.settings.public());
    router?.emit('ui:navigate', { surface: 'desktop', params: {} });
    await wait(700);
    await win.webContents.executeJavaScript("document.querySelector('.desk__scroll')?.scrollTo(0,0)").catch(() => {});
    await wait(400);
    await screenshot(name);
  }
  kernel.settings.patch({
    theme: { design: 'neuro', mode: 'dark', surface: 'standard', accent: 'neuro', radius: 14, wallpaper: 'nebula', transparency: true, glow: true },
    taskbar: { position: 'bottom' },
  });
  router?.emit('settings:changed', kernel.settings.public());

  // Interaction states: Anchor rail and the command palette.
  await win.webContents.executeJavaScript(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true }))`,
  );
  await wait(900);
  await screenshot('11-anchor');

  await win.webContents.executeJavaScript(
    `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))`,
  );
  await wait(700);
  await screenshot('12-command-palette');
  await win.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);

  // Start menu.
  await wait(300);
  await win.webContents.executeJavaScript(`document.querySelector('.taskbar__start')?.click()`).catch(() => {});
  await wait(700);
  await screenshot('20-start-menu');
  await win.webContents.executeJavaScript(`document.querySelector('.startScrim')?.click()`).catch(() => {});
  await wait(400);
  const sidebarClick = await win.webContents
    .executeJavaScript(`(() => { const button = document.querySelector('.dock__collapse'); if (!button) return 'missing'; button.click(); return 'clicked'; })()`)
    .catch((error) => String(error));
  await wait(900);
  const dockProbe = await win.webContents
    .executeJavaScript(
      `JSON.stringify({ className: document.querySelector('.dock')?.className, width: Math.round(document.querySelector('.dock')?.getBoundingClientRect().width ?? 0), labels: [...document.querySelectorAll('.dock__label')].map((node) => node.textContent?.trim()).filter(Boolean) })`,
    )
    .catch((error) => String(error));
  log.info('selftest', `sidebar ${sidebarClick} ${dockProbe}`);
  await screenshot('24-sidebar');
  const previousTheme = kernel.settings.public().theme;
  kernel.settings.patch({ theme: { ...previousTheme, wallpaper: 'photo:blue-marble' } });
  router?.emit('settings:changed', kernel.settings.public());
  router?.emit('ui:navigate', { surface: 'desktop', params: {} });
  await wait(900);
  await win.webContents
    .executeJavaScript(
      `(() => { document.querySelector('.startScrim')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); [...document.querySelectorAll('.oswindow__close')].forEach((button) => button.click()); return 'cleared'; })()`,
    )
    .catch(() => {});
  await wait(1400);
  await screenshot('26-wallpaper');
  kernel.settings.patch({ theme: { ...previousTheme, wallpaper: previousTheme.wallpaper } });
  router?.emit('settings:changed', kernel.settings.public());
  await win.webContents.executeJavaScript(`document.querySelector('.dock__collapse')?.click()`).catch(() => {});
  await win.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`).catch(() => {});

  // Settings / integrations probe.
  router?.emit('ui:navigate', { surface: 'settings', params: { section: 'integrations' } });
  await wait(1800);
  const probe = await win.webContents
    .executeJavaScript(
      `JSON.stringify({
        settings: !!document.querySelector('.settings'),
        composio: !!document.querySelector('.composio'),
        market: !!document.querySelector('.mkt'),
        surfaceError: document.querySelector('.surfaceError')?.textContent?.slice(0, 120) ?? null,
        active: [...document.querySelectorAll('.pageTab')].map((b) => b.textContent?.trim() + (b.getAttribute('data-active') === 'true' ? '*' : '')).filter(Boolean).join(' | '),
        main: document.querySelector('.app__main')?.firstElementChild?.className ?? null
      })`,
    )
    .catch((error) => `probe failed: ${String(error)}`);
  log.info('selftest', `settings probe ${probe}`);

  log.info('selftest', 'complete');
  clearTimeout(watchdog);
  await kernel.composio.toggle('GITHUB_CREATE_ISSUE', false).catch(() => undefined);
  kernel.composio.configure({ apiKey: '', baseUrl: 'https://backend.composio.dev/api/v3.1' });
  await mockComposio.close();
  await peerWeb.dispose();
  await mock.close();
  await peerNode?.dispose();
  await kernel.dispose();
  app.exit(0);
}

function bootstrap(): void {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock && !isSelftest) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    await ensureProfileDirs();
    if (process.argv.includes('--redteam')) {
      const { runRedTeam, renderReport } = await import('./redteam');
      log.info('redteam', 'starting red-team suite');
      const results = await runRedTeam();
      const report = renderReport(results);
      fs.writeFileSync(path.join(process.cwd(), 'redteam-report.md'), report, 'utf8');
      fs.writeFileSync(path.join(process.cwd(), 'redteam-report.json'), JSON.stringify(results, null, 2), 'utf8');
      log.info('redteam', `${results.filter((item) => !item.pass).length}/${results.length} checks failed`);
      app.exit(0);
      return;
    }
    // Permissions are granted per-origin; the in-app browser is the only consumer.
    protocol.handle('neuro', async (request) => {
      const parsed = new URL(request.url);
      const rel = decodeURIComponent(parsed.hostname + parsed.pathname).replace(/^\/+/, '');
      const resourceRoot = path.join(app.getAppPath(), 'resources');
      const file = path.resolve(resourceRoot, rel);
      if (!file.startsWith(resourceRoot + path.sep)) return new Response('not found', { status: 404 });
      const data = await fs.promises.readFile(file);
      const type = file.endsWith('.png')
        ? 'image/png'
        : file.endsWith('.jpg') || file.endsWith('.jpeg')
          ? 'image/jpeg'
          : file.endsWith('.svg')
            ? 'image/svg+xml'
            : file.endsWith('.webp')
              ? 'image/webp'
              : file.endsWith('.woff2')
                ? 'font/woff2'
                : 'application/octet-stream';
      return new Response(new Uint8Array(data), { headers: { 'content-type': type, 'cache-control': 'max-age=31536000' } });
    });

    router = new IpcRouter(getWindow);

    kernel = createKernel((channel, payload) => router?.emit(channel, payload));
    router.register(buildHandlers(kernel, getWindow));
    router.attach();

    mainWindow = createWindow(() => {
      log.info('window', 'renderer loaded');
      if (isSelftest) setTimeout(() => void runSelfTest(mainWindow!), 400);
    });

    void startStatsLoop();

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    nativeTheme.on('updated', () => {
      router?.emit('settings:changed', kernel!.settings.public());
    });

    log.info('app', `Neuro OS ${app.getVersion()} starting (${isDev ? 'development' : 'production'})`);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', async () => {
    if (statsTimer) clearInterval(statsTimer);
    await kernel?.dispose();
  });
}

bootstrap();








