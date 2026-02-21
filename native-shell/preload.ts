const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    // File System Operations
    fileSystem: {
        list: (path: string) => ipcRenderer.invoke('file:list', path),
        read: (path: string) => ipcRenderer.invoke('file:read', path),
        write: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
        createDir: (path: string) => ipcRenderer.invoke('file:createDir', path),
        delete: (path: string) => ipcRenderer.invoke('file:delete', path),
        rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('file:rename', oldPath, newPath),
        copy: (src: string, dest: string) => ipcRenderer.invoke('file:copy', src, dest),
        homeDir: () => ipcRenderer.invoke('file:homeDir'),
        selectDirectory: () => ipcRenderer.invoke('file:selectDirectory'),
        selectFiles: () => ipcRenderer.invoke('file:selectFiles'),
        stat: (path: string) => ipcRenderer.invoke('file:stat', path),
    },

    // OS Controls
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
    },

    // LLM Bridge (optional if direct HTTP calls fail due to CORS)
    llm: {
        chat: (provider: string, data: any) => ipcRenderer.invoke('llm:chat', provider, data),
    },

    // Shell Execution
    shell: {
        exec: (command: string, cwd?: string) => ipcRenderer.invoke('shell:exec', command, cwd),
    },

    // Browser / Web
    browser: {
        scrape: (url: string) => ipcRenderer.invoke('browser:scrape', url),
        openExternal: (url: string) => ipcRenderer.invoke('browser:openExternal', url),
        onFrameNavigate: (callback: (url: string, title?: string) => void) => {
            const listener = (_: any, url: string, titleFromMain?: string) => {
                // Ignore the initial dev server URL and data URLs
                if (url.startsWith('http://localhost:517') || url.startsWith('data:')) return;

                // Clean up title from URL if not provided
                let displayTitle = titleFromMain;
                if (!displayTitle || displayTitle === 'Browser View' || displayTitle === 'Loading...') {
                    const domain = url.split('/')[2]?.replace('www.', '') || '';
                    displayTitle = domain
                        ? domain.charAt(0).toUpperCase() + domain.slice(1)
                        : undefined; // Fallback to undefined if no domain and no meaningful title
                }
                callback(url, displayTitle);
            };
            ipcRenderer.on('browser:frame-navigate', listener as any); // Cast to any to satisfy linting if needed
            return () => ipcRenderer.removeListener('browser:frame-navigate', listener as any);
        },
        onTitleUpdated: (callback: (title: string) => void) => {
            const listener = (_: any, title: string) => {
                // Ignore generic/loading titles
                if (title === 'Browser View' || title === 'Loading...' || !title) return;
                callback(title);
            };
            ipcRenderer.on('browser:title-updated', listener);
            return () => ipcRenderer.removeListener('browser:title-updated', listener);
        }
    },

    // System Info & Notifications
    system: {
        info: () => ipcRenderer.invoke('system:info'),
        notification: (title: string, body: string) => ipcRenderer.invoke('system:notification', title, body),
    },

    // Proxy Request
    proxyRequest: (url: string) => ipcRenderer.invoke('proxy-request', url),

    // Auto-Updater
    updates: {
        check: () => ipcRenderer.invoke('update:check'),
        download: () => ipcRenderer.invoke('update:download'),
        install: () => ipcRenderer.invoke('update:install'),
        onStatus: (callback: (data: any) => void) => {
            const listener = (_: any, data: any) => callback(data);
            ipcRenderer.on('update:status', listener);
            return () => ipcRenderer.removeListener('update:status', listener);
        }
    }
});
