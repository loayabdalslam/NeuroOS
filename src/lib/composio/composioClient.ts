/**
 * Composio Client for NeuroOS
 * Integrates Composio API for tool calling, authentication, and permission management
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
}

interface ComposioApp {
    id: string;
    name: string;
    description: string;
    logo?: string;
    categories: string[];
    toolCount: number;
}

class ComposioClient {
    private apiKey: string = '';
    private userId: string = '';
    private baseUrl: string = 'https://backend.composio.dev/api/v3';
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
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Composio API error (${endpoint}):`, error);
            return null;
        }
    }

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

    async getAuthUrl(appId: string): Promise<string | null> {
        const data = await this.makeRequest<{ authUrl: string }>(`/apps/${appId}/auth-url`, {
            method: 'POST',
            body: JSON.stringify({
                userId: this.userId,
                redirectUrl: `${window.location.origin}/composio/callback`,
            }),
        });

        return data?.authUrl || null;
    }

    async getConnections(): Promise<ComposioAppConnection[]> {
        const data = await this.makeRequest<{ connections: any[] }>(`/users/${this.userId}/connections`);
        
        if (data?.connections) {
            data.connections.forEach((conn: any) => {
                this.connections.set(conn.appId, {
                    appId: conn.appId,
                    appName: conn.appName,
                    status: conn.status,
                    isActive: conn.isActive,
                    authUrl: conn.authUrl,
                    connectedAt: conn.connectedAt,
                });
            });
        }
        
        return Array.from(this.connections.values());
    }

    async getAvailableApps(): Promise<ComposioApp[]> {
        const data = await this.makeRequest<{ apps: any[] }>('/apps');
        
        if (data?.apps) {
            data.apps.forEach((app: any) => {
                this.apps.set(app.id, {
                    id: app.id,
                    name: app.name,
                    description: app.description,
                    logo: app.logo,
                    categories: app.categories || [],
                    toolCount: app.toolCount || 0,
                });
            });
        }
        
        return Array.from(this.apps.values());
    }

    async getAvailableTools(appId?: string): Promise<ComposioTool[]> {
        const endpoint = appId ? `/apps/${appId}/tools` : '/tools';
        const data = await this.makeRequest<{ tools: any[] }>(endpoint);
        
        if (data?.tools) {
            data.tools.forEach((tool: any) => {
                this.tools.set(tool.id, {
                    id: tool.id,
                    name: tool.name,
                    description: tool.description,
                    appId: tool.appId,
                    appName: tool.appName || this.apps.get(tool.appId)?.name || tool.appId,
                    requiresAuth: tool.requiresAuth,
                    isAuthed: this.isToolAuthed(tool.appId),
                    params: tool.params || {},
                    category: tool.category,
                    tags: tool.tags,
                });
            });
        }
        
        return Array.from(this.tools.values());
    }

    private isToolAuthed(appId: string): boolean {
        const conn = this.connections.get(appId);
        return conn ? conn.status === 'connected' : false;
    }

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

        const data = await this.makeRequest<{ result: any }>(`/tools/${toolId}/execute`, {
            method: 'POST',
            body: JSON.stringify({
                userId: this.userId,
                params,
            }),
        });

        if (data) {
            return { success: true, data: data.result };
        }
        
        return { success: false, error: 'Tool execution failed' };
    }

    async searchTools(query: string): Promise<ComposioTool[]> {
        const data = await this.makeRequest<{ tools: any[] }>(`/tools/search?q=${encodeURIComponent(query)}`);
        
        if (data?.tools) {
            return data.tools.map((tool: any) => ({
                id: tool.id,
                name: tool.name,
                description: tool.description,
                appId: tool.appId,
                appName: tool.appName || this.apps.get(tool.appId)?.name || tool.appId,
                requiresAuth: tool.requiresAuth,
                isAuthed: this.isToolAuthed(tool.appId),
                params: tool.params || {},
                category: tool.category,
                tags: tool.tags,
            }));
        }
        
        return [];
    }

    async getToolInfo(toolId: string): Promise<ComposioTool | null> {
        const data = await this.makeRequest<{ tool: any }>(`/tools/${toolId}`);
        
        if (data?.tool) {
            return {
                id: data.tool.id,
                name: data.tool.name,
                description: data.tool.description,
                appId: data.tool.appId,
                appName: data.tool.appName || this.apps.get(data.tool.appId)?.name || data.tool.appId,
                requiresAuth: data.tool.requiresAuth,
                isAuthed: this.isToolAuthed(data.tool.appId),
                params: data.tool.params || {},
                category: data.tool.category,
                tags: data.tool.tags,
            };
        }
        
        return null;
    }

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
        localStorage.removeItem('composio_auth');
    }
}

export const composioClient = new ComposioClient();
export type { ComposioAuth, ComposioTool, ComposioAppConnection, ComposioApp };
