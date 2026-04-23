/**
 * Composio Client for NeuroOS
 * Integrates Composio v3 API for tool calling, authentication, and permission management
 *
 * API Base: https://backend.composio.dev/api/v3
 * Auth: x-api-key header
 */

interface ComposioAuth {
    apiKey: string;
    userId: string;
    accessToken?: string;
    expiresAt?: number;
}

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
    private baseUrl: string = 'https://backend.composio.dev/api/v3';
    private connections: Map<string, ComposioAppConnection> = new Map();
    private tools: Map<string, ComposioTool> = new Map();
    private apps: Map<string, ComposioApp> = new Map();
    private authConfigs: Map<string, string> = new Map();

    constructor() {
        this.loadAuthFromStorage();
    }

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

    private saveAuthToStorage(auth: ComposioAuth): void {
        localStorage.setItem('composio_auth', JSON.stringify(auth));
    }

    private async makeRequest<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T | null> {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    'x-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}: ${response.statusText} — ${body}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Composio API error (${endpoint}):`, error);
            return null;
        }
    }

    // ─── Authentication ──────────────────────────────────────────

    async initializeAuth(apiKey: string): Promise<boolean> {
        try {
            this.apiKey = apiKey;
            const data = await this.makeRequest<any>('/auth/session/info');

            if (data) {
                this.userId = data.user?.id || data.id || 'user-' + Date.now();
                this.saveAuthToStorage({
                    apiKey,
                    userId: this.userId,
                    accessToken: apiKey,
                    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                });
                return true;
            }
            this.apiKey = '';
            return false;
        } catch (e) {
            console.error('Composio auth failed:', e);
            this.apiKey = '';
            return false;
        }
    }

    // ─── Auth Configs ────────────────────────────────────────────
    // Each toolkit (gmail, slack, etc.) has an auth_config that holds
    // the OAuth credentials. We need the auth_config_id to create a
    // connection link.

    async getAuthConfigForApp(toolkitSlug: string): Promise<string | null> {
        const cached = this.authConfigs.get(toolkitSlug);
        if (cached) return cached;

        const data = await this.makeRequest<any>(
            `/auth_configs?toolkit_slug=${encodeURIComponent(toolkitSlug)}`
        );

        const items = data?.items || data?.auth_configs || (Array.isArray(data) ? data : []);
        if (items.length > 0) {
            const configId = items[0].id || items[0].nanoid;
            if (configId) {
                this.authConfigs.set(toolkitSlug, configId);
                return configId;
            }
        }
        return null;
    }

    // ─── Connection Flow ─────────────────────────────────────────
    // 1. Get auth_config_id for the toolkit
    // 2. POST /connected_accounts/link to create a link session
    // 3. Open the returned redirect_url in the system browser
    // 4. User authenticates, then we poll /connected_accounts

    async initiateConnection(appId: string): Promise<{ redirectUrl: string; connectionId?: string } | null> {
        const authConfigId = await this.getAuthConfigForApp(appId);
        if (!authConfigId) {
            console.error(`No auth config found for ${appId}`);
            return null;
        }

        const data = await this.makeRequest<any>('/connected_accounts/link', {
            method: 'POST',
            body: JSON.stringify({
                auth_config_id: authConfigId,
                user_id: this.userId,
            }),
        });

        const redirectUrl = data?.redirect_url || data?.redirectUrl;
        if (redirectUrl) {
            return {
                redirectUrl,
                connectionId: data?.connected_account_id || data?.id,
            };
        }

        return null;
    }

    async getAuthUrl(appId: string): Promise<string | null> {
        const result = await this.initiateConnection(appId);
        if (result?.redirectUrl) {
            openInSystemBrowser(result.redirectUrl);
            return result.redirectUrl;
        }
        return null;
    }

    // ─── Connected Accounts ──────────────────────────────────────

    async getConnections(): Promise<ComposioAppConnection[]> {
        const data = await this.makeRequest<any>('/connected_accounts');

        const items = data?.items || data?.connections || data?.connected_accounts || (Array.isArray(data) ? data : []);
        this.connections.clear();

        items.forEach((conn: any) => {
            const appId = conn.toolkit_slug || conn.appId || conn.app_id || '';
            const status = conn.status === 'active' || conn.status === 'connected' ? 'connected' : 'disconnected';
            this.connections.set(appId, {
                appId,
                appName: conn.toolkit_name || conn.appName || conn.app_name || appId,
                status,
                isActive: status === 'connected',
                connectedAt: conn.created_at ? new Date(conn.created_at).getTime() : undefined,
                id: conn.id || conn.nanoid,
            });
        });

        return Array.from(this.connections.values());
    }

    async disconnectApp(connectionId: string): Promise<boolean> {
        const data = await this.makeRequest<any>(`/connected_accounts/${connectionId}`, {
            method: 'DELETE',
        });
        return data !== null;
    }

    // ─── Apps / Toolkits ─────────────────────────────────────────

    async getAvailableApps(): Promise<ComposioApp[]> {
        const data = await this.makeRequest<any>('/apps');

        const items = data?.items || data?.apps || (Array.isArray(data) ? data : []);
        items.forEach((app: any) => {
            this.apps.set(app.id || app.slug, {
                id: app.id || app.slug,
                name: app.name,
                description: app.description || '',
                logo: app.logo,
                categories: app.categories || [],
                toolCount: app.toolCount || app.tool_count || 0,
            });
        });

        return Array.from(this.apps.values());
    }

    // ─── Tools ───────────────────────────────────────────────────

    async getAvailableTools(appId?: string): Promise<ComposioTool[]> {
        const endpoint = appId
            ? `/tools?toolkit_slug=${encodeURIComponent(appId)}`
            : '/tools';
        const data = await this.makeRequest<any>(endpoint);

        const items = data?.items || data?.tools || (Array.isArray(data) ? data : []);
        items.forEach((tool: any) => {
            const id = tool.id || tool.slug || tool.name;
            this.tools.set(id, {
                id,
                name: tool.name || tool.display_name || id,
                description: tool.description || '',
                appId: tool.toolkit_slug || tool.appId || '',
                appName: tool.toolkit_name || tool.appName || this.apps.get(tool.toolkit_slug)?.name || tool.toolkit_slug || '',
                requiresAuth: tool.requires_auth !== false,
                isAuthed: this.isToolAuthed(tool.toolkit_slug || tool.appId || ''),
                params: tool.params || tool.parameters || {},
                category: tool.category,
                tags: tool.tags,
            });
        });

        return Array.from(this.tools.values());
    }

    private isToolAuthed(appId: string): boolean {
        const conn = this.connections.get(appId);
        return conn ? conn.status === 'connected' : false;
    }

    // ─── Tool Execution ──────────────────────────────────────────

    async executeTool(
        toolId: string,
        params: Record<string, any>,
        appId: string
    ): Promise<{ success: boolean; data?: any; error?: string }> {
        if (!this.isToolAuthed(appId)) {
            return {
                success: false,
                error: `App ${appId} is not authenticated. Please authorize it first.`,
            };
        }

        const conn = this.connections.get(appId);
        const data = await this.makeRequest<any>(
            `/tools/execute/${encodeURIComponent(toolId)}`,
            {
                method: 'POST',
                body: JSON.stringify({
                    connected_account_id: conn?.id,
                    input: params,
                }),
            }
        );

        if (data) {
            return { success: true, data: data.result || data.output || data };
        }

        return { success: false, error: 'Tool execution failed' };
    }

    // ─── Tool Search ─────────────────────────────────────────────

    async searchTools(query: string): Promise<ComposioTool[]> {
        const data = await this.makeRequest<any>(`/tools?search=${encodeURIComponent(query)}`);

        const items = data?.items || data?.tools || (Array.isArray(data) ? data : []);
        return items.map((tool: any) => ({
            id: tool.id || tool.slug || tool.name,
            name: tool.name || tool.display_name,
            description: tool.description || '',
            appId: tool.toolkit_slug || tool.appId || '',
            appName: tool.toolkit_name || tool.appName || '',
            requiresAuth: tool.requires_auth !== false,
            isAuthed: this.isToolAuthed(tool.toolkit_slug || tool.appId || ''),
            params: tool.params || tool.parameters || {},
            category: tool.category,
            tags: tool.tags,
        }));
    }

    async getToolInfo(toolId: string): Promise<ComposioTool | null> {
        const data = await this.makeRequest<any>(`/tools/${encodeURIComponent(toolId)}`);

        if (data) {
            const tool = data.tool || data;
            return {
                id: tool.id || tool.slug || toolId,
                name: tool.name || tool.display_name || toolId,
                description: tool.description || '',
                appId: tool.toolkit_slug || tool.appId || '',
                appName: tool.toolkit_name || tool.appName || '',
                requiresAuth: tool.requires_auth !== false,
                isAuthed: this.isToolAuthed(tool.toolkit_slug || tool.appId || ''),
                params: tool.params || tool.parameters || {},
                category: tool.category,
                tags: tool.tags,
            };
        }

        return null;
    }

    // ─── Helpers ──────────────────────────────────────────────────

    isAuthenticated(): boolean {
        return !!this.apiKey && !!this.userId;
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
        this.authConfigs.clear();
        localStorage.removeItem('composio_auth');
    }
}

export const composioClient = new ComposioClient();
export type { ComposioAuth, ComposioTool, ComposioAppConnection, ComposioApp };
