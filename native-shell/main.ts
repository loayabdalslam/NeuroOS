// @ts-nocheck
const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog } = electron;
console.log('ENV CHECK:', {
    node: process.version,
    electron: process.versions.electron,
    isElectron: 'electron' in process.versions
});
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// electron-squirrel-startup is handled by electron-builder for this project.


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
