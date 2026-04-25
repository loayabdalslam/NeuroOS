/**
 * Composio Client for NeuroOS
 * Routes all API calls through Electron's main-process proxy to bypass CORS.
 * Does NOT use the composio-core SDK (it uses axios which is CORS-blocked in the renderer).
 */

const COMPOSIO_BASE = 'https://backend.composio.dev';

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

    constructor() {
        this.loadAuthFromStorage();
    }

    // ─── HTTP via Electron IPC proxy ─────────────────────────────

    private async api(path: string, method = 'GET', body?: any): Promise<any> {
        const proxy = (window as any).electron?.apiProxy;
        if (!proxy) {
            // Fallback: try direct fetch (works in dev server / non-Electron)
            const resp = await fetch(`${COMPOSIO_BASE}${path}`, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': this.apiKey,
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ message: resp.statusText }));
                throw new Error(err?.message || err?.error || `HTTP ${resp.status}`);
            }
            return resp.json();
        }

        const result = await proxy({
            url: `${COMPOSIO_BASE}${path}`,
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': this.apiKey,
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!result.ok) {
            const detail = typeof result.data === 'string' ? result.data
                : result.data?.message || result.data?.error || JSON.stringify(result.data);
            throw new Error(detail || `HTTP ${result.status}`);
        }
        return result.data;
    }

    // ─── Storage ─────────────────────────────────────────────────

    private loadAuthFromStorage(): void {
        try {
            const stored = localStorage.getItem('composio_auth');
            if (stored) {
                const auth: ComposioAuth = JSON.parse(stored);
                this.apiKey = auth.apiKey;
                this.userId = auth.userId;
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
            // Validate key by listing apps
            await this.api('/api/v1/apps');

            // Get client info for entity ID
            let clientId = 'default';
            try {
                const info = await this.api('/api/v1/client/auth/client_info');
                clientId = info?.client?.id || info?.id || 'default';
            } catch {
                // Non-critical — use default entity ID
            }

            this.userId = clientId;

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

        const entityId = this.getStableEntityId();

        const data = await this.api('/api/v2/connectedAccounts/initiateConnection', 'POST', {
            app: { uniqueKey: appId },
            config: {
                name: appId,
                useComposioAuth: true,
            },
            connection: {
                entityId,
                initiateData: {},
                extra: { redirectURL: '', labels: [] },
            },
        });

        const connResp = data?.connectionResponse || data;
        const redirectUrl = connResp?.redirectUrl || connResp?.redirectUri;
        const connectionId = connResp?.connectedAccountId;

        if (!redirectUrl) {
            if (connResp?.connectionStatus === 'ACTIVE' || connResp?.connectionStatus === 'CONNECTED') {
                throw new Error(`${appId} is already connected. Refresh the page to see it.`);
            }
            throw new Error(`${appId} returned no auth URL. Configure it in your Composio dashboard.`);
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
        if (!this.apiKey) return [];

        try {
            const entityId = this.getStableEntityId();
            const data = await this.api(`/api/v1/connectedAccounts?user_uuid=${encodeURIComponent(entityId)}`);
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
        try {
            await this.api(`/api/v1/connectedAccounts/${connectionId}`, 'DELETE');
            return true;
        } catch (e) {
            console.error('Failed to disconnect:', e);
            return false;
        }
    }

    // ─── Apps / Toolkits ─────────────────────────────────────────

    async getAvailableApps(): Promise<ComposioApp[]> {
        if (!this.apiKey) return [];

        try {
            const data = await this.api('/api/v1/apps');
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
        if (!this.apiKey) return [];

        try {
            const qs = appId ? `?apps=${encodeURIComponent(appId)}` : '';
            const data = await this.api(`/api/v1/actions${qs}`);
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

        try {
            const result = await this.api(`/api/v1/actions/${actionName}/execute`, 'POST', {
                connectedAccountId: conn.id,
                entityId: this.getStableEntityId(),
                input: params,
            });

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
        if (!this.apiKey) return [];

        try {
            const data = await this.api(`/api/v1/actions?useCase=${encodeURIComponent(query)}`);
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
