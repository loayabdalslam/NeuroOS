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
    requiresAuth: boolean;
    isAuthed: boolean;
    params: Record<string, any>;
}

interface ComposioAppConnection {
    appId: string;
    appName: string;
    status: 'connected' | 'disconnected' | 'pending';
    authUrl?: string;
    isActive: boolean;
}

class ComposioClient {
    private apiKey: string = '';
    private userId: string = '';
    private baseUrl: string = 'https://api.composio.dev/api/v1';
    private connections: Map<string, ComposioAppConnection> = new Map();
    private tools: Map<string, ComposioTool> = new Map();

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

    async initializeAuth(apiKey: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/auth/verify`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            });

            if (response.ok) {
                const data = await response.json();
                this.apiKey = apiKey;
                this.userId = data.userId || 'user-' + Date.now();
                this.saveAuthToStorage({
                    apiKey,
                    userId: this.userId,
                    accessToken: apiKey,
                    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                });
                return true;
            }
            return false;
        } catch (e) {
            console.error('Composio auth failed:', e);
            return false;
        }
    }

    async getAuthUrl(appId: string): Promise<string | null> {
        try {
            const response = await fetch(`${this.baseUrl}/apps/${appId}/auth-url`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.userId,
                    redirectUrl: `${window.location.origin}/composio/callback`,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                return data.authUrl;
            }
            return null;
        } catch (e) {
            console.error('Failed to get auth URL:', e);
            return null;
        }
    }

    async getConnections(): Promise<ComposioAppConnection[]> {
        try {
            const response = await fetch(`${this.baseUrl}/users/${this.userId}/connections`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
            });

            if (response.ok) {
                const data = await response.json();
                const connections = data.connections || [];
                connections.forEach((conn: any) => {
                    this.connections.set(conn.appId, {
                        appId: conn.appId,
                        appName: conn.appName,
                        status: conn.status,
                        isActive: conn.isActive,
                        authUrl: conn.authUrl,
                    });
                });
                return Array.from(this.connections.values());
            }
            return [];
        } catch (e) {
            console.error('Failed to get connections:', e);
            return [];
        }
    }

    async getAvailableTools(appId?: string): Promise<ComposioTool[]> {
        try {
            const endpoint = appId
                ? `${this.baseUrl}/apps/${appId}/tools`
                : `${this.baseUrl}/tools`;

            const response = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
            });

            if (response.ok) {
                const data = await response.json();
                const tools = data.tools || [];
                tools.forEach((tool: any) => {
                    this.tools.set(tool.id, {
                        id: tool.id,
                        name: tool.name,
                        description: tool.description,
                        appId: tool.appId,
                        requiresAuth: tool.requiresAuth,
                        isAuthed: this.isToolAuthed(tool.appId),
                        params: tool.params || {},
                    });
                });
                return Array.from(this.tools.values());
            }
            return [];
        } catch (e) {
            console.error('Failed to get tools:', e);
            return [];
        }
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
        try {
            if (!this.isToolAuthed(appId)) {
                return {
                    success: false,
                    error: `App ${appId} is not authenticated. Please authorize it first.`,
                };
            }

            const response = await fetch(`${this.baseUrl}/tools/${toolId}/execute`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: this.userId,
                    params,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                return { success: true, data: data.result };
            }
            return { success: false, error: 'Tool execution failed' };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    isAuthenticated(): boolean {
        return !!this.apiKey && !!this.userId;
    }

    logout(): void {
        this.apiKey = '';
        this.userId = '';
        this.connections.clear();
        this.tools.clear();
        localStorage.removeItem('composio_auth');
    }
}

export const composioClient = new ComposioClient();
export type { ComposioAuth, ComposioTool, ComposioAppConnection };
