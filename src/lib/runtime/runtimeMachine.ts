/**
 * NeuroOS Runtime Machine
 * Sandboxed environment for running generated applications
 */

export interface NeuroApp {
    id: string;
    name: string;
    description: string;
    type: 'html' | 'react' | 'node' | 'script';
    code: Record<string, string>; // filename -> content
    createdAt: number;
    lastRun: number | null;
    thumbnail?: string;
    tags: string[];
    author: string;
}

export interface RuntimeConfig {
    timeout: number;       // max execution time in ms
    maxApps: number;       // max concurrent apps
    enableNetwork: boolean;
    sandboxLevel: 'strict' | 'moderate' | 'none';
}

const DEFAULT_CONFIG: RuntimeConfig = {
    timeout: 30000,
    maxApps: 5,
    enableNetwork: false,
    sandboxLevel: 'strict',
};

class RuntimeMachine {
    private apps: Map<string, NeuroApp> = new Map();
    private config: RuntimeConfig;
    private workspacePath: string | null = null;

    constructor(config: Partial<RuntimeConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    setWorkspace(path: string | null) {
        this.workspacePath = path;
    }

    registerApp(app: NeuroApp): { success: boolean; id: string } {
        if (this.apps.size >= this.config.maxApps) {
            // Remove oldest app
            const oldest = Array.from(this.apps.values())
                .sort((a, b) => a.createdAt - b.createdAt)[0];
            if (oldest) this.apps.delete(oldest.id);
        }
        this.apps.set(app.id, app);
        return { success: true, id: app.id };
    }

    getApp(id: string): NeuroApp | undefined {
        return this.apps.get(id);
    }

    listApps(): NeuroApp[] {
        return Array.from(this.apps.values())
            .sort((a, b) => (b.lastRun || b.createdAt) - (a.lastRun || a.createdAt));
    }

    updateApp(id: string, updates: Partial<NeuroApp>): NeuroApp | null {
        const app = this.apps.get(id);
        if (!app) return null;
        const updated = { ...app, ...updates };
        this.apps.set(id, updated);
        return updated;
    }

    deleteApp(id: string): boolean {
        return this.apps.delete(id);
    }

    getAppsByTag(tag: string): NeuroApp[] {
        return this.listApps().filter(app => app.tags.includes(tag));
    }

    searchApps(query: string): NeuroApp[] {
        const q = query.toLowerCase();
        return this.listApps().filter(app =>
            app.name.toLowerCase().includes(q) ||
            app.description.toLowerCase().includes(q) ||
            app.tags.some(t => t.toLowerCase().includes(q))
        );
    }

    generateAppId(): string {
        return `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }

    getStats() {
        return {
            totalApps: this.apps.size,
            maxApps: this.config.maxApps,
            appsByType: Array.from(this.apps.values()).reduce((acc, app) => {
                acc[app.type] = (acc[app.type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
        };
    }
}

export const runtimeMachine = new RuntimeMachine();

export function createAppFromCode(
    name: string,
    description: string,
    files: Record<string, string>,
    type: NeuroApp['type'] = 'html',
    tags: string[] = [],
    author: string = 'AI'
): NeuroApp {
    return {
        id: runtimeMachine.generateAppId(),
        name,
        description,
        type,
        code: files,
        createdAt: Date.now(),
        lastRun: null,
        tags,
        author,
    };
}