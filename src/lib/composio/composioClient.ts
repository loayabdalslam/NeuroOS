/**
 * Composio Client for NeuroOS - Using Composio CLI
 * Integrates with Composio v3 APIs via the official CLI tool
 * This approach follows the Composio skills best practices
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
            // Validate API key by making a test request to Composio backend
            const response = await fetch('https://backend.composio.dev/api/v1/client/auth/client_info', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey,
                },
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || error.error || `API validation failed: ${response.statusText}`);
            }

            // Validate response contains user info
            const data = await response.json();
            if (!data) {
                throw new Error('Invalid response from Composio API');
            }

            // Get user ID from response
            const clientId = data?.client?.id || data?.id || apiKey.substring(0, 16);
            this.userId = clientId;

            // Store credentials
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('composio_api_key', apiKey);
                localStorage.setItem('composio_auth', JSON.stringify({
                    apiKey,
                    userId: this.userId,
                }));
                localStorage.setItem('composio_entity_id', this.userId);
            }

            return true;
        } catch (e: any) {
            console.error('Composio auth failed:', e);
            this.apiKey = '';
            this.userId = '';
            throw new Error(`Invalid API key. Please check and try again. (${e.message})`);
        }
    }

    // ─── Connection Flow ─────────────────────────────────────────
    // Uses the Composio CLI link command for authentication

    async initiateConnection(appId: string): Promise<{ redirectUrl: string; connectionId?: string }> {
        if (!this.apiKey) throw new Error('Composio API key not set.');

        try {
            // Use electron to call composio link command
            const electron = (window as any).electron;
            if (electron?.shell?.exec) {
                // Electron environment - use IPC to call CLI
                const result = await new Promise<{ authUrl: string; connectionId?: string }>((resolve, reject) => {
                    electron.shell.exec(
                        `composio link ${appId.toLowerCase()} --no-wait`,
                        (error: any, stdout: string, stderr: string) => {
                            if (error) {
                                reject(new Error(stderr || error.message));
                                return;
                            }
                            try {
                                const output = JSON.parse(stdout);
                                resolve({
                                    authUrl: output.redirectUrl || output.authUrl || output.url || '',
                                    connectionId: output.connectedAccountId,
                                });
                            } catch {
                                reject(new Error('Failed to parse Composio CLI output'));
                            }
                        }
                    );
                });

                if (!result.authUrl) {
                    throw new Error(`${appId}: could not get auth URL from Composio`);
                }

                return { redirectUrl: result.authUrl, connectionId: result.connectionId };
            } else {
                // Browser environment - throw error asking user to use CLI
                throw new Error(
                    `Please run: composio link ${appId} from your terminal, then refresh this page.`
                );
            }
        } catch (e: any) {
            const message = e?.message || String(e);
            throw new Error(`Failed to initiate connection for ${appId}: ${message}`);
        }
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
            // In production, you'd use composio manage connectedAccounts list
            // For now, return cached connections
            return Array.from(this.connections.values());
        } catch (e: any) {
            console.error('Failed to get connections:', e);
            return Array.from(this.connections.values());
        }
    }

    async disconnectApp(connectionId: string): Promise<boolean> {
        try {
            // Use: composio manage connectedAccounts delete <id>
            console.log('Disconnecting:', connectionId);
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
            // Use: composio manage toolkits list
            // For now, return cached apps or hardcoded list
            const commonApps = [
                { id: 'gmail', name: 'Gmail', description: 'Email management', categories: ['email'], toolCount: 10 },
                { id: 'slack', name: 'Slack', description: 'Team messaging', categories: ['communication'], toolCount: 15 },
                { id: 'github', name: 'GitHub', description: 'Code and issues', categories: ['development'], toolCount: 20 },
                { id: 'notion', name: 'Notion', description: 'Docs and databases', categories: ['productivity'], toolCount: 12 },
                { id: 'googlesheets', name: 'Google Sheets', description: 'Spreadsheets', categories: ['productivity'], toolCount: 8 },
                { id: 'hubspot', name: 'HubSpot', description: 'CRM and contacts', categories: ['crm'], toolCount: 18 },
                { id: 'googlecalendar', name: 'Google Calendar', description: 'Events and scheduling', categories: ['productivity'], toolCount: 6 },
            ];

            commonApps.forEach((app) => {
                this.apps.set(app.id, {
                    ...app,
                    logo: undefined,
                });
            });

            return commonApps;
        } catch (e) {
            console.error('Failed to get apps:', e);
            return [];
        }
    }

    // ─── Tools ───────────────────────────────────────────────────

    async getAvailableTools(appId?: string): Promise<ComposioTool[]> {
        if (!this.apiKey) return [];

        try {
            // Use: composio manage tools list [--toolkits <toolkit>]
            // For now, return cached tools
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

        try {
            // Use: composio execute "<TOOL_SLUG>" -d '{...params}'
            const paramsJson = JSON.stringify(params);
            const electron = (window as any).electron;

            if (electron?.shell?.exec) {
                const result = await new Promise<{ success: boolean; data?: any; error?: string }>((resolve) => {
                    electron.shell.exec(
                        `composio execute "${actionName}" -d '${paramsJson}'`,
                        (error: any, stdout: string, stderr: string) => {
                            if (error) {
                                resolve({ success: false, error: stderr || error.message });
                                return;
                            }
                            try {
                                const output = JSON.parse(stdout);
                                resolve({ success: true, data: output });
                            } catch {
                                resolve({ success: true, data: stdout });
                            }
                        }
                    );
                });
                return result;
            } else {
                return { success: false, error: 'Electron IPC not available' };
            }
        } catch (error: any) {
            return { success: false, error: `Execute failed: ${error.message}` };
        }
    }

    // ─── Tool Search ─────────────────────────────────────────────

    async searchTools(query: string): Promise<ComposioTool[]> {
        if (!this.apiKey) return [];

        try {
            // Use: composio search "<query>"
            // For now, return empty
            return [];
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
        localStorage.removeItem('composio_api_key');
    }
}

export const composioClient = new ComposioClient();
export type { ComposioAuth, ComposioTool, ComposioAppConnection, ComposioApp };
