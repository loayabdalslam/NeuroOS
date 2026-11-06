import fs from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, Menu, nativeTheme, protocol, shell } from 'electron';
import { IpcRouter, log } from './core/ipc';
import { createKernel, type Kernel } from './kernel';
import { buildHandlers } from './ipcHandlers';
import { Paths, ensureProfileDirs } from './core/store';

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
  await wait(1200);
  await screenshot('01-onboarding');

  if (!kernel) return;

  // Fast-forward onboarding so every surface can be captured.
  kernel.settings.completeOnboarding({
    locale: 'en',
    name: 'Youssef',
    role: 'AI systems engineer',
    theme: 'dark',
    accent: 'neuro',
    workspaceRoot: path.join(Paths.workspaces, 'Neuro Demo'),
  });
  await kernel.workspace.ensureDemoWorkspace(path.join(Paths.workspaces, 'Neuro Demo'));
  kernel.content.seedSpaces();
  kernel.content.seedNotebooks();
  kernel.content.seedNotes();
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

  const surfaces: [string, string, Record<string, string>?][] = [
    ['02-desktop', 'desktop'],
    ['03-chat', 'chat'],
    ['04-workspace', 'workspace'],
    ['05-space', 'space'],
    ['06-notebook', 'notebook'],
    ['07-browser', 'browser', { url: 'https://deepseek.com' }],
    ['08-terminal', 'terminal'],
    ['09-marketplace', 'marketplace'],
    ['10-settings', 'settings'],
  ];

  for (const [name, surface, params] of surfaces) {
    router?.emit('ui:navigate', { surface, params: params ?? {} });
    await wait(surface === 'browser' ? 2600 : 900);
    await screenshot(name);
  }

  log.info('selftest', 'complete');
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
