/**
 * Composio Client for NeuroOS
 * Uses the official composio-core SDK for reliable tool execution, auth, and connections.
 * Connection initiation bypasses the SDK to fix the useComposioAuth flag bug.
 */

import { Composio, ComposioToolSet } from 'composio-core';

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
    private sdk: Composio | null = null;
    private toolset: ComposioToolSet | null = null;
    private connections: Map<string, ComposioAppConnection> = new Map();
    private tools: Map<string, ComposioTool> = new Map();
    private apps: Map<string, ComposioApp> = new Map();

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
                if (this.apiKey) {
                    this.initSDK(this.apiKey);
                }
            }
        } catch (e) {
            console.warn('Failed to load Composio auth from storage');
        }
    }

    private getStableEntityId(): string {
        if (this.userId && !this.userId.startsWith('user-')) return this.userId;
        let stored = localStorage.getItem('composio_entity_id');
        if (!stored) {
            stored = 'default';
            localStorage.setItem('composio_entity_id', stored);
        }
        return stored;
    }

    private initSDK(apiKey: string): void {
        try {
            this.sdk = new Composio({ apiKey });
            this.toolset = new ComposioToolSet({ apiKey, entityId: this.getStableEntityId() });
        } catch (e) {
            console.error('Failed to initialize Composio SDK:', e);
        }
    }

    // ─── Authentication ──────────────────────────────────────────

    async initializeAuth(apiKey: string): Promise<boolean> {
        try {
            this.apiKey = apiKey;
            this.initSDK(apiKey);

            if (!this.sdk) return false;

            let clientId: string | null = null;
            try {
                clientId = await this.sdk.backendClient?.getClientId?.();
            } catch {
                // getClientId may not exist or may fail in browser — that's OK
            }
            this.userId = clientId || this.getStableEntityId();
            this.toolset = new ComposioToolSet({ apiKey, entityId: this.userId });

            // Validate the key by listing apps
            try {
                await this.sdk.apps.list();
            } catch (validationErr: any) {
                const msg = validationErr?.message || String(validationErr);
                if (msg.includes('401') || msg.includes('403') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('invalid')) {
                    throw new Error('Invalid API key — Composio rejected the request.');
                }
            }

            localStorage.setItem('composio_auth', JSON.stringify({
                apiKey,
                userId: this.userId,
            }));

            return true;
        } catch (e: any) {
            console.error('Composio auth failed:', e);
            this.apiKey = '';
            this.sdk = null;
            this.toolset = null;
            throw e;
        }
    }

    // ─── Connection Flow ─────────────────────────────────────────

    async initiateConnection(appId: string): Promise<{ redirectUrl: string; connectionId?: string }> {
        if (!this.apiKey) throw new Error('Composio API key not set. Add your key in Integrations settings.');

        const entityId = this.userId || this.getStableEntityId();

        // Call the v2 API directly to set useComposioAuth: true
        // The SDK has a bug where it sets useComposioAuth: false when authMode/authConfig aren't passed,
        // which breaks OAuth apps like Gmail that need Composio's managed credentials.
        const resp = await fetch(`${COMPOSIO_BASE}/api/v2/connectedAccounts/initiateConnection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': this.apiKey,
            },
            body: JSON.stringify({
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
            }),
        });

        if (!resp.ok) {
            let detail = '';
            try {
                const err = await resp.json();
                detail = err?.message || err?.error || JSON.stringify(err);
            } catch {
                detail = resp.statusText;
            }
            throw new Error(`Composio connection failed (${resp.status}): ${detail}`);
        }

        const data = await resp.json();
        const connResp = data?.connectionResponse || data;
        const redirectUrl = connResp?.redirectUrl || connResp?.redirectUri;
        const connectionId = connResp?.connectedAccountId;

        if (!redirectUrl) {
            if (connResp?.connectionStatus === 'ACTIVE' || connResp?.connectionStatus === 'CONNECTED') {
                await this.getConnections();
                throw new Error(`${appId} is already connected! Refresh the page to see it.`);
            }
            throw new Error(`${appId} returned no auth URL. It may need manual setup in your Composio dashboard.`);
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
        if (!this.sdk) return [];

        try {
            const entity = this.sdk.getEntity(this.userId || 'default');
            const conns = await entity.getConnections();

            this.connections.clear();

            conns.forEach((conn: any) => {
                const appId = conn.appUniqueId || conn.appName || '';
                const rawStatus = (conn.status || '').toUpperCase();
                const status = rawStatus === 'ACTIVE' || rawStatus === 'CONNECTED' || rawStatus === 'INITIATED' ? 'connected' : 'disconnected';
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
        if (!this.sdk) return false;
        try {
            await this.sdk.connectedAccounts.delete({ connectedAccountId: connectionId });
            return true;
        } catch (e) {
            console.error('Failed to disconnect:', e);
            return false;
        }
    }

    // ─── Apps / Toolkits ─────────────────────────────────────────

    async getAvailableApps(): Promise<ComposioApp[]> {
        if (!this.sdk) return [];

        try {
            const appsList = await this.sdk.apps.list();
            const items = (appsList as any)?.items || (Array.isArray(appsList) ? appsList : []);

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
        if (!this.sdk) return [];

        try {
            const params: any = {};
            if (appId) params.apps = appId;
            const actionsList = await this.sdk.actions.list(params);
            const items = (actionsList as any)?.items || (Array.isArray(actionsList) ? actionsList : []);

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

    // ─── Tool Execution (via SDK) ────────────────────────────────

    async executeTool(
        actionName: string,
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
        if (!conn?.id) {
            return {
                success: false,
                error: `No connection ID for ${appId}. Try disconnecting and reconnecting.`,
            };
        }

        if (!this.toolset) {
            return { success: false, error: 'Composio SDK not initialized.' };
        }

        try {
            const result = await this.toolset.executeAction({
                action: actionName,
                params,
                connectedAccountId: conn.id,
                entityId: this.userId || 'default',
            });

            const successFlag = result?.successfull ?? result?.successful ?? true;
            const data = result?.data || result;

            if (successFlag) {
                return { success: true, data };
            }
            return { success: false, error: result?.error || JSON.stringify(data) };
        } catch (error: any) {
            const msg = error.message || String(error);
            console.error(`Composio execute failed (${actionName}):`, msg);
            return { success: false, error: `Execute failed: ${msg}` };
        }
    }

    // ─── Tool Search ─────────────────────────────────────────────

    async searchTools(query: string): Promise<ComposioTool[]> {
        if (!this.sdk) return [];

        try {
            const result = await this.sdk.actions.list({ useCase: query });
            const items = (result as any)?.items || (Array.isArray(result) ? result : []);
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
        return !!this.apiKey && !!this.sdk;
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
        this.sdk = null;
        this.toolset = null;
        this.connections.clear();
        this.tools.clear();
        this.apps.clear();
        localStorage.removeItem('composio_auth');
    }
}

export const composioClient = new ComposioClient();
export type { ComposioAuth, ComposioTool, ComposioAppConnection, ComposioApp };
