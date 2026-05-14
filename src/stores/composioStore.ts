import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type IntegrationKind = 'gmail' | 'googlecalendar';
export type IntegrationStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectedIntegration {
    id: string;
    appName: IntegrationKind;
    accountId?: string;
    accountLabel: string;
    status: IntegrationStatus;
    permissions: string[];
    connectedAt?: number;
    lastSyncedAt?: number;
    error?: string;
}

interface ComposioState {
    apiKey: string;
    initialized: boolean;
    integrations: ConnectedIntegration[];
    setApiKey: (apiKey: string) => Promise<boolean>;
    refreshConnections: (userId: string) => Promise<void>;
    connectApp: (appName: IntegrationKind, userId: string) => Promise<{ success: boolean; redirectUrl?: string; error?: string }>;
    disconnectApp: (connectionId: string, userId: string) => Promise<boolean>;
    getIntegration: (appName: IntegrationKind) => ConnectedIntegration | undefined;
}

const normalizeIntegration = (account: any): ConnectedIntegration => ({
    id: account.id || account.connectedAccountId || `${account.appName}-${account.entityId}`,
    appName: (account.appName || account.integrationName || '').toLowerCase(),
    accountId: account.connectedAccountId || account.id,
    accountLabel: account?.accountName || account?.appUniqueId || account?.appName || 'Connected account',
    status: account.status === 'ACTIVE' || account.status === 'connected' ? 'connected' : 'connecting',
    permissions: account?.scopes || account?.permissions || [],
    connectedAt: account?.createdAt ? new Date(account.createdAt).getTime() : Date.now(),
    lastSyncedAt: Date.now(),
});

export const useComposioStore = create<ComposioState>()(
    persist(
        (set, get) => ({
            apiKey: '',
            initialized: false,
            integrations: [],

            setApiKey: async (apiKey) => {
                const result = await window.electron.composio.initialize(apiKey);
                if (result?.success) {
                    set({ apiKey, initialized: true });
                    return true;
                }
                set({ apiKey, initialized: false });
                return false;
            },

            refreshConnections: async (userId) => {
                const result = await window.electron.composio.getConnectedAccounts(userId);
                if (!result?.success) return;
                const raw = Array.isArray(result.data?.items) ? result.data.items : Array.isArray(result.data) ? result.data : [];
                set({ integrations: raw.map(normalizeIntegration) });
            },

            connectApp: async (appName, userId) => {
                set((state) => ({
                    integrations: [
                        ...state.integrations.filter((item) => item.appName !== appName),
                        {
                            id: `${appName}-pending`,
                            appName,
                            accountLabel: 'Pending connection',
                            status: 'connecting',
                            permissions: [],
                            connectedAt: Date.now(),
                        },
                    ],
                }));
                const result = await window.electron.composio.initiateConnection({ appName, userId });
                if (!result?.success) {
                    set((state) => ({
                        integrations: state.integrations.map((item) =>
                            item.appName === appName ? { ...item, status: 'error', error: result?.error || 'Connection failed' } : item
                        ),
                    }));
                    return { success: false, error: result?.error || 'Connection failed' };
                }
                await get().refreshConnections(userId);
                return {
                    success: true,
                    redirectUrl: result.data?.redirectUrl || result.data?.redirect_url || result.data?.url,
                };
            },

            disconnectApp: async (connectionId, userId) => {
                const result = await window.electron.composio.disconnectAccount(connectionId);
                if (!result?.success) return false;
                await get().refreshConnections(userId);
                return true;
            },

            getIntegration: (appName) => get().integrations.find((item) => item.appName === appName),
        }),
        {
            name: 'neuro-composio',
        }
    )
);
