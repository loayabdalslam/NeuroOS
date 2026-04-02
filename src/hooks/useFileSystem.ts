import { useCallback } from 'react';
import { useWorkspaceStore } from '../stores/workspaceStore';

// Virtual file system for browser mode
const virtualFS: Record<string, Record<string, string>> = {};

export const useFileSystem = () => {
    const isElectron = typeof window !== 'undefined' && !!(window as any).electron;
    const { workspacePath } = useWorkspaceStore.getState();

    const getVirtualPath = (path: string) => {
        const root = workspacePath || 'workspace';
        if (!virtualFS[root]) virtualFS[root] = {};
        return { root, relative: path.replace(root, '').replace(/^[/\\]/, '') || '' };
    };

    const listFiles = useCallback(async (path: string) => {
        if (isElectron) return await (window as any).electron!.fileSystem.list(path);
        // Browser mode - return virtual files
        const { root } = getVirtualPath(path);
        const store = virtualFS[root] || {};
        return Object.keys(store).map(name => ({
            name,
            path: `${path}/${name}`,
            isDirectory: false,
            size: store[name].length
        }));
    }, [isElectron, workspacePath]);

    const readFile = useCallback(async (path: string) => {
        if (isElectron) return await (window as any).electron!.fileSystem.read(path);
        const { root, relative } = getVirtualPath(path);
        return virtualFS[root]?.[relative] || '';
    }, [isElectron, workspacePath]);

    const writeFile = useCallback(async (path: string, content: string) => {
        if (isElectron) return await (window as any).electron!.fileSystem.write(path, content);
        const { root, relative } = getVirtualPath(path);
        if (!virtualFS[root]) virtualFS[root] = {};
        virtualFS[root][relative] = content;
    }, [isElectron, workspacePath]);

    const createDir = useCallback(async (path: string) => {
        if (isElectron) return await (window as any).electron!.fileSystem.createDir(path);
        // Virtual FS doesn't need explicit dirs
    }, [isElectron]);

    const deleteFile = useCallback(async (path: string) => {
        if (isElectron) return await (window as any).electron!.fileSystem.delete(path);
        const { root, relative } = getVirtualPath(path);
        delete virtualFS[root]?.[relative];
    }, [isElectron, workspacePath]);

    const renameFile = useCallback(async (oldPath: string, newPath: string) => {
        if (isElectron) return await (window as any).electron!.fileSystem.rename(oldPath, newPath);
        const { root, relative: oldRel } = getVirtualPath(oldPath);
        const { relative: newRel } = getVirtualPath(newPath);
        if (virtualFS[root]?.[oldRel]) {
            virtualFS[root][newRel] = virtualFS[root][oldRel];
            delete virtualFS[root][oldRel];
        }
    }, [isElectron, workspacePath]);

    const copyFile = useCallback(async (src: string, dest: string) => {
        if (isElectron) return await (window as any).electron!.fileSystem.copy(src, dest);
        const content = await readFile(src);
        await writeFile(dest, content);
    }, [isElectron, readFile, writeFile]);

    const getHomeDir = useCallback(async () => {
        if (isElectron) return await (window as any).electron!.fileSystem.homeDir();
        return '/workspace';
    }, [isElectron]);

    const selectDirectory = useCallback(async () => {
        if (isElectron) return await (window as any).electron!.fileSystem.selectDirectory();
        // Browser mode - return a virtual path
        const name = `workspace-${Date.now()}`;
        return `/virtual/${name}`;
    }, [isElectron]);

    const selectFiles = useCallback(async () => {
        if (isElectron) return await (window as any).electron!.fileSystem.selectFiles();
        // Browser mode - use file input
        return new Promise<string[]>((resolve) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.onchange = () => {
                const files = Array.from(input.files || []);
                // Read files and store in virtual FS
                files.forEach(file => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const { root } = getVirtualPath('upload');
                        if (!virtualFS[root]) virtualFS[root] = {};
                        virtualFS[root][file.name] = reader.result as string;
                    };
                    reader.readAsText(file);
                });
                resolve(files.map(f => f.name));
            };
            input.click();
        });
    }, [isElectron, workspacePath]);

    const statFile = useCallback(async (path: string) => {
        if (isElectron) return await (window as any).electron!.fileSystem.stat(path);
        const { root, relative } = getVirtualPath(path);
        const content = virtualFS[root]?.[relative];
        if (content !== undefined) return { exists: true, size: content.length, isDirectory: false };
        return { exists: false, size: 0, isDirectory: false };
    }, [isElectron, workspacePath]);

    return {
        isElectron,
        listFiles,
        readFile,
        writeFile,
        createDir,
        deleteFile,
        renameFile,
        copyFile,
        getHomeDir,
        selectDirectory,
        selectFiles,
        statFile,
    };
};
