/**
 * Electron API Types — global declaration for window.electron
 */
export { };

declare global {
    interface Window {
        electron: {
            fileSystem: {
                list: (path: string) => Promise<Array<{ name: string; isDirectory: boolean }>>;
                read: (path: string) => Promise<string>;
                write: (path: string, content: string) => Promise<void>;
                createDir: (path: string) => Promise<void>;
                delete: (path: string) => Promise<void>;
                rename: (oldPath: string, newPath: string) => Promise<void>;
                copy: (src: string, dest: string) => Promise<void>;
                homeDir: () => Promise<string>;
                selectDirectory: () => Promise<string | null>;
                selectFiles: () => Promise<string[]>;
                stat: (path: string) => Promise<{ size: number; isDirectory: boolean; modified: string }>;
            };
            window: {
                minimize: () => void;
                maximize: () => void;
                close: () => void;
            };
            llm: {
                chat: (provider: string, data: any) => Promise<any>;
            };
            shell: {
                exec: (command: string, cwd?: string) => Promise<{
                    stdout: string;
                    stderr: string;
                    code: number;
                    error: string | null;
                }>;
            };
            browser: {
                scrape: (url: string) => Promise<{
                    html: string;
                    text: string;
                    url: string;
                }>;
                openExternal: (url: string) => Promise<void>;
            };
            system: {
                info: () => Promise<{
                    platform: string;
                    arch: string;
                    hostname: string;
                    cpus: number;
                    totalMemory: number;
                    freeMemory: number;
                    uptime: number;
                    homeDir: string;
                    tmpDir: string;
                    nodeVersion: string;
                }>;
                notification: (title: string, body: string) => Promise<boolean>;
            };
            updates: {
                check: () => Promise<void>;
                download: () => Promise<void>;
                install: () => Promise<void>;
                onStatus: (callback: (status: any) => void) => () => void;
            };
            proxyRequest: (url: string) => Promise<any>;
        };
    }
}
