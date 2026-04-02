// @ts-nocheck
// NOTE: This file has partial type coverage. Full types needed for production.
const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog } = electron;
const { autoUpdater } = require('electron-updater');
console.log('ENV CHECK:', {
    node: process.version,
    electron: process.versions.electron,
    isElectron: 'electron' in process.versions
});
import path from 'path';
import fs from 'fs/promises';
import http from 'http';
import os from 'os';

// Configure AutoUpdater
autoUpdater.autoDownload = false; // We want to control when to download
autoUpdater.allowPrerelease = false;

let mainWindow: BrowserWindow | null = null;
let appTray: any = null;

// ─── Single Instance Lock ──────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// ─── Path Validation Utility ───────────────────────────────────────
const isPathSafe = (userPath: string): boolean => {
    try {
        const resolvedPath = path.resolve(userPath);
        const homeDir = os.homedir();
        const appDir = path.resolve(__dirname, '../..'); // Project root

        // Allow paths within home directory
        if (resolvedPath.startsWith(homeDir)) {
            return true;
        }

        // Allow paths within the app directory
        if (resolvedPath.startsWith(appDir)) {
            return true;
        }

        // Allow common workspace directories on Windows
        const allowedRoots = ['E:\\chatit.cloud', 'C:\\Users', 'D:\\', 'E:\\'];
        for (const root of allowedRoots) {
            if (resolvedPath.startsWith(root)) {
                return true;
            }
        }

        // Allow drives like C:\, D:\, E:\ etc
        if (/^[A-Z]:[\\/]/i.test(resolvedPath)) {
            return true;
        }

        return false;
    } catch (error) {
        return false;
    }
};

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        transparent: true,
        icon: path.join(__dirname, '../build/icon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            webviewTag: true, // Enable <webview> tag for full browser control
        },
    });

    // LOAD THE APP
    const loadURL = async () => {
        if (process.env.VITE_DEV_SERVER_URL) {
            const devUrl = process.env.VITE_DEV_SERVER_URL;


            const checkServer = () => {
                const req = http.get(devUrl, (res) => {
                    let data = '';
                    res.on('data', chunk => { data += chunk; });
                    res.on('end', () => {
                        // Check if it's a valid Vite page (contains "vite" or "client")
                        if (res.statusCode === 200 && (data.includes('vite') || data.includes('client') || data.includes('/src/main.tsx'))) {

                            mainWindow!.loadURL(devUrl).catch(e => {
                                console.error('LOAD ERROR:', e);
                                setTimeout(checkServer, 1000);
                            });
                        } else {

                            setTimeout(checkServer, 1000);
                        }
                    });
                });

                req.on('error', () => {

                    setTimeout(checkServer, 1000);
                });
            };

            checkServer();
            mainWindow!.webContents.openDevTools();
        } else {
            mainWindow!.loadFile(path.join(__dirname, '../dist/index.html'));
            autoUpdater.checkForUpdatesAndNotify();
        }
    };

    loadURL();

    // Window Controls IPC
    ipcMain.on('window:minimize', () => mainWindow?.minimize());
    ipcMain.on('window:maximize', () => {
        if (mainWindow?.isMaximized()) mainWindow.unmaximize();
        else mainWindow?.maximize();
    });
    ipcMain.on('window:close', () => mainWindow?.close());

    // ─── System Tray ───────────────────────────────────────────────
    const { Tray, Menu } = require('electron');
    appTray = new Tray(path.join(__dirname, '../build/icon.ico'));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show',
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
            }
        },
        {
            label: 'Hide',
            click: () => {
                mainWindow?.hide();
            }
        },
        {
            type: 'separator'
        },
        {
            label: 'Quit',
            click: () => {
                app.quit();
            }
        }
    ]);
    appTray.setContextMenu(contextMenu);
    appTray.on('double-click', () => {
        if (mainWindow?.isVisible()) {
            mainWindow?.hide();
        } else {
            mainWindow?.show();
            mainWindow?.focus();
        }
    });
};

app.on('ready', () => {
    createWindow();

    // ─── Auto-Updater IPC & Events ────────────────────────────

    autoUpdater.on('checking-for-update', () => {
        mainWindow?.webContents.send('update:status', { state: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
        mainWindow?.webContents.send('update:status', { state: 'available', info });
    });

    autoUpdater.on('update-not-available', (info) => {
        mainWindow?.webContents.send('update:status', { state: 'up-to-date', info });
    });

    autoUpdater.on('error', (err) => {
        mainWindow?.webContents.send('update:status', { state: 'error', error: err.message });
    });

    autoUpdater.on('download-progress', (progressObj) => {
        mainWindow?.webContents.send('update:status', { state: 'downloading', progress: progressObj });
    });

    autoUpdater.on('update-downloaded', (info) => {
        mainWindow?.webContents.send('update:status', { state: 'downloaded', info });
    });

    ipcMain.handle('update:check', () => autoUpdater.checkForUpdates());
    ipcMain.handle('update:download', () => autoUpdater.downloadUpdate());
    ipcMain.handle('update:install', () => autoUpdater.quitAndInstall());

    // File System IPC Handlers
    ipcMain.handle('file:homeDir', () => os.homedir());

    ipcMain.handle('file:list', async (_, dirPath) => {
        try {
            if (!isPathSafe(dirPath)) {
                throw new Error('Access denied: path is outside home directory');
            }
            const dirents = await fs.readdir(dirPath, { withFileTypes: true });
            return dirents.map(dirent => ({
                name: dirent.name,
                isDirectory: dirent.isDirectory(),
                path: path.join(dirPath, dirent.name)
            }));
        } catch (error) {
            console.error('File list error:', error);
            throw error;
        }
    });

    ipcMain.handle('file:read', async (_, filePath) => {
        if (!isPathSafe(filePath)) {
            throw new Error('Access denied: path is outside home directory');
        }
        return await fs.readFile(filePath, 'utf-8');
    });

    ipcMain.handle('file:write', async (_, filePath, content) => {
        if (!isPathSafe(filePath)) {
            throw new Error('Access denied: path is outside home directory');
        }
        return await fs.writeFile(filePath, content, 'utf-8');
    });

    ipcMain.handle('file:selectDirectory', async () => {
        const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ['openDirectory']
        });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('file:createDir', async (_, dirPath) => {
        if (!isPathSafe(dirPath)) {
            throw new Error('Access denied: path is outside home directory');
        }
        await fs.mkdir(dirPath, { recursive: true });
    });

    ipcMain.handle('file:delete', async (_, filePath) => {
        if (!isPathSafe(filePath)) {
            throw new Error('Access denied: path is outside home directory');
        }
        await fs.rm(filePath, { recursive: true, force: true });
    });

    ipcMain.handle('file:rename', async (_, oldPath, newPath) => {
        if (!isPathSafe(oldPath) || !isPathSafe(newPath)) {
            throw new Error('Access denied: path is outside home directory');
        }
        await fs.rename(oldPath, newPath);
    });

    ipcMain.handle('file:copy', async (_, src, dest) => {
        if (!isPathSafe(src) || !isPathSafe(dest)) {
            throw new Error('Access denied: path is outside home directory');
        }
        await fs.copyFile(src, dest);
    });

    ipcMain.handle('file:selectFiles', async () => {
        const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ['openFile', 'multiSelections'],
        });
        return result.canceled ? [] : result.filePaths;
    });

    ipcMain.handle('file:stat', async (_, filePath) => {
        if (!isPathSafe(filePath)) {
            throw new Error('Access denied: path is outside home directory');
        }
        const stat = await fs.stat(filePath);
        return {
            size: stat.size,
            isDirectory: stat.isDirectory(),
            modified: stat.mtime.toISOString(),
        };
    });

    // ─── Shell Execution ──────────────────────────────────────
    ipcMain.handle('shell:exec', async (_, command: string) => {
        return new Promise((resolve) => {
            const { spawn } = require('child_process');
            const proc = spawn(process.platform === 'win32' ? 'cmd.exe' : 'sh',
                [process.platform === 'win32' ? '/c' : '-c', command],
                { cwd: os.homedir(), maxBuffer: 64 * 1024 }
            );

            let stdout = '';
            let stderr = '';

            proc.stdout?.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            proc.stderr?.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            const timeout = setTimeout(() => {
                proc.kill();
                resolve({
                    stdout: stdout.slice(0, 64000) + '\n... (output truncated)',
                    stderr: stderr.slice(0, 4000),
                    code: -1,
                    error: 'Command timeout (30s)'
                });
            }, 30000);

            proc.on('close', (code: number) => {
                clearTimeout(timeout);
                resolve({
                    stdout: stdout.slice(0, 64000),
                    stderr: stderr.slice(0, 4000),
                    code
                });
            });

            proc.on('error', (err: Error) => {
                clearTimeout(timeout);
                resolve({
                    stdout,
                    stderr: err.message,
                    code: -1,
                    error: err.message
                });
            });
        });
    });
    
    // ─── LLM Bridge (for CORS-free API calls) ─────────────────
    ipcMain.handle('llm:chat', async (_, provider: string, data: { 
        baseUrl: string; 
        apiKey?: string; 
        model: string; 
        messages: Array<{role: string; content: string}>;
        stream?: boolean;
    }) => {
        try {
            const { baseUrl, apiKey, model, messages, stream } = data;
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }
            
            if (provider === 'anthropic') {
                headers['x-api-key'] = apiKey || '';
                headers['anthropic-version'] = '2023-06-01';
            }
            
            const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model,
                    messages,
                    stream: stream || false,
                }),
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(`LLM API Error ${response.status}: ${JSON.stringify(errorData)}`);
            }
            
            if (stream) {
                // Return the stream response for client-side handling
                return { stream: true, body: response.body };
            }
            
            const result = await response.json();
            return {
                content: result.choices?.[0]?.message?.content || '',
                usage: result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            };
        } catch (error: any) {
            console.error('LLM Bridge Error:', error);
            throw new Error(`LLM request failed: ${error.message}`);
        }
    });

    // ─── Web Scraping (CORS-free) ────────────────────────────
    ipcMain.handle('browser:scrape', async (_, url: string) => {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': CHROME_UA,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://www.google.com/',
                }
            });
            const html = await response.text();
            // Strip scripts and styles, extract text
            const text = html
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return { html: html.slice(0, 50000), text: text.slice(0, 20000), url };
        } catch (error: any) {
            throw new Error(`Scrape failed: ${error.message}`);
        }
    });

    // ─── Open External URL ───────────────────────────────────
    ipcMain.handle('browser:openExternal', async (_, url: string) => {
        const { shell } = require('electron');
        await shell.openExternal(url);
    });

    // ─── System Info ─────────────────────────────────────────
    ipcMain.handle('system:info', async () => {
        const os = require('os');
        return {
            platform: os.platform(),
            arch: os.arch(),
            hostname: os.hostname(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            uptime: os.uptime(),
            homeDir: os.homedir(),
            tmpDir: os.tmpdir(),
            nodeVersion: process.version
        };
    });

    // ─── Native Notification ─────────────────────────────────
    ipcMain.handle('system:notification', async (_, title: string, body: string) => {
        const { Notification: ElectronNotification } = require('electron');
        if (ElectronNotification.isSupported()) {
            const notif = new ElectronNotification({ title, body });
            notif.show();
            return true;
        }
        return false;
    });

    // ─── Auto Launch ───────────────────────────────────────────
    ipcMain.handle('system:getAutoLaunch', async () => {
        return app.getLoginItemSettings().openAtLogin;
    });

    ipcMain.handle('system:setAutoLaunch', async (_, enable: boolean) => {
        app.setLoginItemSettings({
            openAtLogin: enable,
            openAsHidden: true
        });
        return app.getLoginItemSettings().openAtLogin;
    });

    // ─── Header Stripping + Full Webview Support ─────────────────
    const { session } = require('electron');

    // Real Chrome UA — Google/Facebook check this
    const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    const patchSession = (ses: any) => {
        // 1. Strip restrictive response headers (X-Frame-Options, CSP, etc.)
        ses.webRequest.onHeadersReceived((details: any, callback: any) => {
            // Skip patching for local dev server to avoid issues
            if (details.url.startsWith('http://localhost') || details.url.startsWith('http://127.0.0.1')) {
                return callback({ cancel: false });
            }
            const h = { ...details.responseHeaders };
            delete h['x-frame-options'];
            delete h['X-Frame-Options'];
            delete h['content-security-policy'];
            delete h['Content-Security-Policy'];
            delete h['x-content-type-options'];
            delete h['X-Content-Type-Options'];
            callback({ cancel: false, responseHeaders: h });
        });

        // 2. Spoof request headers — send real Chrome UA so sites don't block webview
        ses.webRequest.onBeforeSendHeaders((details: any, callback: any) => {
            const h = { ...details.requestHeaders };
            h['User-Agent'] = CHROME_UA;
            h['Accept-Language'] = 'en-US,en;q=0.9';
            h['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
            // Remove Electron/webview identifying headers
            delete h['X-Electron-Version'];
            callback({ cancel: false, requestHeaders: h });
        });

        // 3. Handle permission requests with explicit allow list
        ses.setPermissionRequestHandler((_wc: any, permission: string, callback: any) => {
            // Allow camera, microphone, and geolocation in webview
            const allowedPermissions = ['media', 'camera', 'microphone', 'geolocation'];
            if (allowedPermissions.includes(permission)) {
                callback(true);
            } else {
                callback(false);
            }
        });
        ses.setPermissionCheckHandler((wc: any, permission: string) => {
            const allowedPermissions = ['media', 'camera', 'microphone', 'geolocation'];
            return allowedPermissions.includes(permission);
        });

        // 4. Do NOT disable certificate verification — enforce TLS checks
        // Certificate errors will be handled by the 'certificate-error' event below
    };

    // Patch the default session (main window) - ONLY in production to avoid interfering with Vite HMR
    if (!process.env.VITE_DEV_SERVER_URL) {
        patchSession(session.defaultSession);
    }

    // 5. Also patch any new webview sessions (they may use a different partition)
    app.on('web-contents-created', (_event: any, contents: any) => {
        if (contents.getType() === 'webview') {
            // Fix navigation errors: don't crash on ERR_ABORTED
            contents.on('did-fail-load', (
                _e: any,
                errorCode: number,
                _errorDescription: string,
                validatedURL: string,
                isMainFrame: boolean
            ) => {
                // ERR_ABORTED (-3) is normal for redirects — ignore it
                if (errorCode === -3) return;
                if (isMainFrame) {
                    console.warn(`[webview] Failed to load: ${validatedURL} (code: ${errorCode})`);
                }
            });

            // Allow navigation to any URL in webview
            contents.on('will-navigate', (_e: any, _url: string) => {
                // Allow all navigations — don't block them
            });

            // Open DevTools on Ctrl+Shift+I for any focused webview
            contents.on('before-input-event', (_e: any, input: any) => {
                if (input.type === 'keyDown' && input.control && input.shift && input.key === 'I') {
                    if (contents.isDevToolsOpened()) contents.closeDevTools();
                    else contents.openDevTools();
                }
            });
        }
    });

    // ─── Proxy Request for CORS bypassing ───────────────────────
    ipcMain.handle('proxy-request', async (_: any, url: string) => {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': CHROME_UA,
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            return await response.text();
        } catch (error) {
            console.error('Proxy request error:', error);
            throw error;
        }
    });
});

// Allow certificate errors only in development mode
app.on('certificate-error', (_event: any, webContents: any, _url: string, _error: any, _certificate: any, callback: any) => {
    // Only allow for webview (not main window) in dev mode
    if (!process.env.VITE_DEV_SERVER_URL && webContents.getType() !== 'webview') {
        callback(false); // Reject in production for main window
    } else {
        callback(true); // Allow in dev or for webviews
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
