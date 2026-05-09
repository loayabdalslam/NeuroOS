/**
 * Composio Client for NeuroOS
 * Routes all API calls through Electron's main-process IPC to use composio-core natively.
 */

interface ComposioTool {
    id: string;
    name: string;
    description: string;
    appId: string;
    appName: string;
    requiresAuth: boolean;
    isAuthed: boolean;
    params: Record<string, any>;
    category?: string;
    tags?: string[];
}

interface ComposioAppConnection {
    appId: string;
    appName: string;
    status: 'connected' | 'disconnected' | 'pending';
    authUrl?: string;
    isActive: boolean;
    connectedAt?: number;
    id?: string;
}

interface ComposioApp {
    id: string;
    name: string;
    description: string;
    logo?: string;
    categories: string[];
    toolCount: number;
}

interface ComposioAuth {
    apiKey: string;
    userId: string;
}

function openInSystemBrowser(url: string) {
    const electron = (window as any).electron;
    if (electron?.browser?.openExternal) {
        electron.browser.openExternal(url);
    } else {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

class ComposioClient {
    private apiKey: string = '';
    private userId: string = '';
    private connections: Map<string, ComposioAppConnection> = new Map();
    private tools: Map<string, ComposioTool> = new Map();
    private apps: Map<string, ComposioApp> = new Map();

    private get ipc() {
        return (window as any).electron?.composio;
    }

    constructor() {
        this.loadAuthFromStorage();
    }

    // ─── Storage ─────────────────────────────────────────────────

    private loadAuthFromStorage(): void {
        try {
            const stored = localStorage.getItem('composio_auth');
            if (stored) {
                const auth: ComposioAuth = JSON.parse(stored);
                this.apiKey = auth.apiKey;
                this.userId = auth.userId;

                // We need to initialize the main process client if we have a key
                if (this.ipc && this.apiKey) {
                    this.ipc.init(this.apiKey).catch(console.error);
                }
            }
        } catch (e) {
            console.warn('Failed to load Composio auth from storage');
        }
    }

    private getStableEntityId(): string {
        if (this.userId && this.userId !== '') return this.userId;
        let stored = localStorage.getItem('composio_entity_id');
        if (!stored) {
            stored = 'default';
            localStorage.setItem('composio_entity_id', stored);
        }
        return stored;
    }

    // ─── Authentication ──────────────────────────────────────────

    async initializeAuth(apiKey: string): Promise<boolean> {
        this.apiKey = apiKey;

        try {
            if (!this.ipc) throw new Error('Electron IPC composio handler not found');
            const success = await this.ipc.init(apiKey);
            if (!success) throw new Error('Failed to initialize SDK');

            this.userId = this.getStableEntityId();

            localStorage.setItem('composio_auth', JSON.stringify({
                apiKey,
                userId: this.userId,
            }));
            localStorage.setItem('composio_entity_id', this.userId);

            return true;
        } catch (e: any) {
            console.error('Composio auth failed:', e);
            this.apiKey = '';
            this.userId = '';
            throw e;
        }
    }

    // ─── Connection Flow ─────────────────────────────────────────

    async initiateConnection(appId: string): Promise<{ redirectUrl: string; connectionId?: string }> {
        if (!this.apiKey) throw new Error('Composio API key not set.');
        if (!this.ipc) throw new Error('IPC not found');

        const entityId = this.getStableEntityId();
        const data = await this.ipc.initiateConnection(appId.toLowerCase(), entityId);

        const redirectUrl = data?.redirectUrl || data?.redirectUri;
        const connectionId = data?.connectedAccountId || data?.connection?.connectedAccountId;

        if (!redirectUrl) {
            if (data?.connectionStatus === 'ACTIVE' || data?.connectionStatus === 'CONNECTED') {
                throw new Error(`${appId} is already connected. Refresh the page to see it.`);
            }
            throw new Error(
                `${appId}: could not get auth URL. Response: ${JSON.stringify(data).slice(0, 200)}`
            );
        }

        return { redirectUrl, connectionId };
    }

    async getAuthUrl(appId: string): Promise<string> {
        const result = await this.initiateConnection(appId);
        openInSystemBrowser(result.redirectUrl);
        return result.redirectUrl;
    }

    // ─── Connected Accounts ──────────────────────────────────────

    async getConnections(): Promise<ComposioAppConnection[]> {
        if (!this.apiKey || !this.ipc) return [];

        try {
            const entityId = this.getStableEntityId();
            const data = await this.ipc.getConnections(entityId);
            const items = data?.items || (Array.isArray(data) ? data : []);

            this.connections.clear();

            items.forEach((conn: any) => {
                const appId = conn.appUniqueId || conn.appName || '';
                const rawStatus = (conn.status || '').toUpperCase();
                const status = rawStatus === 'ACTIVE' || rawStatus === 'CONNECTED' || rawStatus === 'INITIATED'
                    ? 'connected' : 'disconnected';
                if (appId && !conn.deleted) {
                    this.connections.set(appId, {
                        appId,
                        appName: conn.appName || appId,
                        status,
                        isActive: status === 'connected',
                        connectedAt: conn.createdAt ? new Date(conn.createdAt).getTime() : undefined,
                        id: conn.id,
                    });
                }
            });

            return Array.from(this.connections.values());
        } catch (e: any) {
            console.error('Failed to get connections:', e);
            return Array.from(this.connections.values());
        }
    }

    async disconnectApp(connectionId: string): Promise<boolean> {
        if (!this.ipc) return false;
        try {
            await this.ipc.disconnectApp(connectionId);
            return true;
        } catch (e) {
            console.error('Failed to disconnect:', e);
            return false;
        }
    }

    // ─── Apps / Toolkits ─────────────────────────────────────────

    async getAvailableApps(): Promise<ComposioApp[]> {
        if (!this.apiKey || !this.ipc) return [];

        try {
            const data = await this.ipc.getApps();
            const items = data?.items || (Array.isArray(data) ? data : []);

            items.forEach((app: any) => {
                const id = app.key || app.slug || app.id || app.appId;
                this.apps.set(id, {
                    id,
                    name: app.name || id,
                    description: app.description || '',
                    logo: app.logo,
                    categories: app.categories || [],
                    toolCount: app.meta?.actionsCount || app.toolCount || 0,
                });
            });

            return Array.from(this.apps.values());
        } catch (e) {
            console.error('Failed to get apps:', e);
            return [];
        }
    }

    // ─── Tools ───────────────────────────────────────────────────

    async getAvailableTools(appId?: string): Promise<ComposioTool[]> {
        if (!this.apiKey || !this.ipc) return [];

        try {
            const data = await this.ipc.getTools(appId);
            const items = data?.items || (Array.isArray(data) ? data : []);

            items.forEach((tool: any) => {
                const id = tool.name || tool.slug || tool.id;
                const toolAppId = tool.appKey || tool.appId || '';
                this.tools.set(id, {
                    id,
                    name: tool.display_name || tool.name || id,
                    description: tool.description || '',
                    appId: toolAppId,
                    appName: tool.appName || this.apps.get(toolAppId)?.name || toolAppId,
                    requiresAuth: true,
                    isAuthed: this.isToolAuthed(toolAppId),
                    params: tool.parameters?.properties || {},
                    category: tool.category,
                    tags: tool.tags,
                });
            });

            return Array.from(this.tools.values());
        } catch (e) {
            console.error('Failed to get tools:', e);
            return [];
        }
    }

    private isToolAuthed(appId: string): boolean {
        const conn = this.connections.get(appId);
        return conn ? conn.status === 'connected' : false;
    }

    // ─── Tool Execution ──────────────────────────────────────────

    async executeTool(
        actionName: string,
        params: Record<string, any>,
        appId: string
    ): Promise<{ success: boolean; data?: any; error?: string }> {
        if (!this.isToolAuthed(appId)) {
            return { success: false, error: `App ${appId} is not authenticated.` };
        }

        const conn = this.connections.get(appId);
        if (!conn?.id) {
            return { success: false, error: `No connection ID for ${appId}. Try reconnecting.` };
        }

        if (!this.ipc) return { success: false, error: 'IPC not found' };

        try {
            const result = await this.ipc.executeTool(actionName, params, this.getStableEntityId(), conn.id);

            const successFlag = result?.successfull ?? result?.successful ?? true;
            const data = result?.data || result;

            if (successFlag) {
                return { success: true, data };
            }
            return { success: false, error: result?.error || JSON.stringify(data) };
        } catch (error: any) {
            return { success: false, error: `Execute failed: ${error.message}` };
        }
    }

    // ─── Tool Search ─────────────────────────────────────────────

    async searchTools(query: string): Promise<ComposioTool[]> {
        if (!this.apiKey || !this.ipc) return [];

        try {
            const data = await this.ipc.searchTools(query);
            const items = data?.items || (Array.isArray(data) ? data : []);
            return items.map((tool: any) => {
                const toolAppId = tool.appKey || tool.appId || '';
                return {
                    id: tool.name || tool.slug || tool.id,
                    name: tool.display_name || tool.name,
                    description: tool.description || '',
                    appId: toolAppId,
                    appName: tool.appName || toolAppId,
                    requiresAuth: true,
                    isAuthed: this.isToolAuthed(toolAppId),
                    params: tool.parameters?.properties || {},
                    category: tool.category,
                    tags: tool.tags,
                };
            });
        } catch (e) {
            console.error('Search tools failed:', e);
            return [];
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────

    isAuthenticated(): boolean {
        return !!this.apiKey;
    }

    getCachedTools(): ComposioTool[] {
        return Array.from(this.tools.values());
    }

    getCachedApps(): ComposioApp[] {
        return Array.from(this.apps.values());
    }

    getCachedConnections(): ComposioAppConnection[] {
        return Array.from(this.connections.values());
    }

    logout(): void {
        this.apiKey = '';
        this.userId = '';
        this.connections.clear();
        this.tools.clear();
        this.apps.clear();
        localStorage.removeItem('composio_auth');
        localStorage.removeItem('composio_entity_id');
    }
}

export const composioClient = new ComposioClient();
export type { ComposioAuth, ComposioTool, ComposioAppConnection, ComposioApp };
