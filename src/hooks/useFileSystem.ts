import { useCallback } from 'react';

export const useFileSystem = () => {
    const isElectron = typeof window !== 'undefined' && !!window.electron;

    const listFiles = useCallback(async (path: string) => {
        if (!isElectron) return [];
        return await window.electron!.fileSystem.list(path);
    }, [isElectron]);

    const readFile = useCallback(async (path: string) => {
        if (!isElectron) return '';
        return await window.electron!.fileSystem.read(path);
    }, [isElectron]);

    const writeFile = useCallback(async (path: string, content: string) => {
        if (!isElectron) return;
        await window.electron!.fileSystem.write(path, content);
    }, [isElectron]);

    const createDir = useCallback(async (path: string) => {
        if (!isElectron) return;
        await window.electron!.fileSystem.createDir(path);
    }, [isElectron]);

    const deleteFile = useCallback(async (path: string) => {
        if (!isElectron) return;
        await window.electron!.fileSystem.delete(path);
    }, [isElectron]);

    const renameFile = useCallback(async (oldPath: string, newPath: string) => {
        if (!isElectron) return;
        await window.electron!.fileSystem.rename(oldPath, newPath);
    }, [isElectron]);

    const copyFile = useCallback(async (src: string, dest: string) => {
        if (!isElectron) return;
        await window.electron!.fileSystem.copy(src, dest);
    }, [isElectron]);

    const getHomeDir = useCallback(async () => {
        if (!isElectron) return '/';
        return await window.electron!.fileSystem.homeDir();
    }, [isElectron]);

    const selectDirectory = useCallback(async () => {
        if (!isElectron) return null;
        return await window.electron!.fileSystem.selectDirectory();
    }, [isElectron]);

    const selectFiles = useCallback(async () => {
        if (!isElectron) return [];
        return await window.electron!.fileSystem.selectFiles();
    }, [isElectron]);

    const statFile = useCallback(async (path: string) => {
        if (!isElectron) return null;
        return await window.electron!.fileSystem.stat(path);
    }, [isElectron]);

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
