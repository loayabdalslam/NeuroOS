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

    // Proxy Request
    proxyRequest: (url: string) => ipcRenderer.invoke('proxy-request', url),
});
