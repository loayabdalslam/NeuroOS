// @ts-nocheck
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
import os from 'os';

// Configure AutoUpdater
autoUpdater.autoDownload = false; // We want to control when to download
autoUpdater.allowPrerelease = false;

let mainWindow: BrowserWindow | null = null;

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
            webSecurity: false,
            webviewTag: true, // Enable <webview> tag for full browser control
        },
    });

    // LOAD THE APP
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
        // Start update check in production
        autoUpdater.checkForUpdatesAndNotify();
    }

    // Window Controls IPC
    ipcMain.on('window:minimize', () => mainWindow?.minimize());
    ipcMain.on('window:maximize', () => {
        if (mainWindow?.isMaximized()) mainWindow.unmaximize();
        else mainWindow?.maximize();
    });
    ipcMain.on('window:close', () => mainWindow?.close());
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
        return await fs.readFile(filePath, 'utf-8');
    });

    ipcMain.handle('file:write', async (_, filePath, content) => {
        return await fs.writeFile(filePath, content, 'utf-8');
    });

    ipcMain.handle('file:selectDirectory', async () => {
        const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ['openDirectory']
        });
        return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('file:createDir', async (_, dirPath) => {
        await fs.mkdir(dirPath, { recursive: true });
    });

    ipcMain.handle('file:delete', async (_, filePath) => {
        await fs.rm(filePath, { recursive: true, force: true });
    });

    ipcMain.handle('file:rename', async (_, oldPath, newPath) => {
        await fs.rename(oldPath, newPath);
    });

    ipcMain.handle('file:copy', async (_, src, dest) => {
        await fs.copyFile(src, dest);
    });

    ipcMain.handle('file:selectFiles', async () => {
        const result = await dialog.showOpenDialog(mainWindow!, {
            properties: ['openFile', 'multiSelections'],
        });
        return result.canceled ? [] : result.filePaths;
    });

    ipcMain.handle('file:stat', async (_, filePath) => {
        const stat = await fs.stat(filePath);
        return {
            size: stat.size,
            isDirectory: stat.isDirectory(),
            modified: stat.mtime.toISOString(),
        };
    });

    // ─── Shell Execution ──────────────────────────────────────
    ipcMain.handle('shell:exec', async (_, command: string, cwd?: string) => {
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            exec(command, { cwd: cwd || undefined, timeout: 30000, maxBuffer: 1024 * 1024 }, (error: any, stdout: string, stderr: string) => {
                resolve({
                    stdout: stdout || '',
                    stderr: stderr || '',
                    code: error ? error.code || 1 : 0,
                    error: error ? error.message : null
                });
            });
        });
    });

    // ─── Web Scraping (CORS-free) ────────────────────────────
    ipcMain.handle('browser:scrape', async (_, url: string) => {
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'NeuroOS/1.0' }
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

    // ─── Header Stripping + Full Webview Support ─────────────────
    const { session } = require('electron');

    // Real Chrome UA — Google/Facebook check this
    const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    const patchSession = (ses: any) => {
        // 1. Strip restrictive response headers (X-Frame-Options, CSP, etc.)
        ses.webRequest.onHeadersReceived((details: any, callback: any) => {
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

        // 3. Grant all permission requests (media, geolocation, notifications, etc.)
        ses.setPermissionRequestHandler((_wc: any, _permission: string, callback: any) => {
            callback(true);
        });
        ses.setPermissionCheckHandler(() => true);

        // 4. Disable certificate verification errors for webview tabs
        ses.setCertificateVerifyProc((_req: any, callback: any) => {
            callback(0); // 0 = success / allow all
        });
    };

    // Patch the default session (main window)
    patchSession(session.defaultSession);

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
            const response = await fetch(url, { headers: { 'User-Agent': CHROME_UA } });
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

// Ignore all certificate errors globally (important for webviews)
app.on('certificate-error', (_event: any, _webContents: any, _url: string, _error: any, _certificate: any, callback: any) => {
    callback(true); // Trust all certificates
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
