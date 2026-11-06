import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, Menu, nativeTheme, protocol, shell } from 'electron';
import { IpcRouter, log } from './core/ipc';
import { createKernel, type Kernel } from './kernel';
import { buildHandlers } from './ipcHandlers';
import { Paths, ensureProfileDirs } from './core/store';
import { startMockProvider } from './selftest/mockProvider';

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
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
  const screenshot = async (name: string): Promise<void> => {
    await wait(700);
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
  await screenshot('01-onboarding');

  // Walk to the appearance step (welcome → language → profile → appearance).
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
  await kernel.workspace.ensureDemoWorkspace(path.join(Paths.workspaces, 'Neuro Demo'));
  kernel.content.seedSpaces();
  kernel.content.seedNotebooks();
  kernel.content.seedNotes();

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
  router?.emit('settings:changed', kernel.settings.public());
  await wait(1600);

  // Exercise the real agent loop against the sandbox endpoint: streaming,
  // a tool call, the tool result round-trip and persistence.
  const session = await kernel.agent.createSession({ title: 'Sandbox · system check' });
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

  const surfaces: [string, string, Record<string, string>?][] = [
    ['02-desktop', 'desktop'],
    ['03-chat', 'chat'],
    ['04-workspace', 'workspace'],
    ['05-space', 'space'],
    ['06-notebook', 'notebook'],
    ['07-browser', 'browser'],
    ['08-terminal', 'terminal'],
    ['09-marketplace', 'marketplace'],
    ['10-settings', 'settings'],
  ];

  for (const [name, surface, params] of surfaces) {
    router?.emit('ui:navigate', { surface, params: params ?? {} });
    await wait(surface === 'browser' ? 1800 : 900);
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
    log.info('selftest', `webview ${url} → ${probe}`);
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

  log.info('selftest', 'complete');
  await mock.close();
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
    // Permissions are granted per-origin; the in-app browser is the only consumer.
    protocol.handle('neuro', async (request) => {
      const rel = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '');
      const file = path.join(app.getAppPath(), 'resources', rel);
      const data = await fs.promises.readFile(file);
      return new Response(new Uint8Array(data));
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
