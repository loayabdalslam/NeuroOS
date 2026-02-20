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
        frame: false, // Custom titlebar
        transparent: true, // For rounded corners if needed
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false // Allow local files (be careful in prod)
        },
    });

    // Load the app
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

    // Proxy Request for CORS bypassing
    ipcMain.handle('proxy-request', async (_, url) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            }
            return await response.text();
        } catch (error) {
            console.error('Proxy request error:', error);
            throw error;
        }
    });
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
