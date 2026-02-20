export { };

declare global {
    interface Window {
        electron: {
            fileSystem: {
                list: (path: string) => Promise<any[]>;
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
            proxyRequest: (url: string) => Promise<any>;
        };
    }
}
