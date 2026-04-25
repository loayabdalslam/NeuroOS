/**
 * Composio Store - Manages Composio integrations and tool permissions
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { composioClient, type ComposioTool, type ComposioAppConnection, type ComposioApp } from '../lib/composio/composioClient';

interface ComposioState {
    apiKey: string;
    isAuthenticated: boolean;
    isOnboarding: boolean;
    connections: ComposioAppConnection[];
    availableTools: ComposioTool[];
    availableApps: ComposioApp[];
    authorizedTools: Set<string>;
    pendingPermissions: { toolId: string; appId: string; toolName: string }[];
    isLoading: boolean;
    error: string | null;

    // Actions
    setApiKey: (key: string) => Promise<boolean>;
    startOnboarding: () => void;
    completeOnboarding: () => void;
    loadConnections: () => Promise<void>;
    loadApps: () => Promise<void>;
    loadTools: (appId?: string) => Promise<void>;
    searchTools: (query: string) => Promise<ComposioTool[]>;
    requestToolPermission: (toolId: string, appId: string, toolName: string) => void;
    grantToolPermission: (toolId: string) => void;
    denyToolPermission: (toolId: string) => void;
    authorizeApp: (appId: string) => Promise<string | null>;
    executeTool: (toolId: string, params: Record<string, any>, appId: string) => Promise<any>;
    getToolsForPrompt: () => string;
    logout: () => void;
    clearError: () => void;
}

export const useComposioStore = create<ComposioState>()(
    persist(
        (set, get) => ({
            apiKey: '',
            isAuthenticated: false,
            isOnboarding: false,
            connections: [],
            availableTools: [],
            availableApps: [],
            authorizedTools: new Set(),
            pendingPermissions: [],
            isLoading: false,
            error: null,

            setApiKey: async (key: string) => {
                set({ isLoading: true, error: null });
                try {
                    const success = await composioClient.initializeAuth(key);
                    if (success) {
                        set({ apiKey: key, isAuthenticated: true, isOnboarding: false });
                        await get().loadConnections();
                        await get().loadApps();
                        await get().loadTools();
                    } else {
                        set({ error: 'Could not initialize Composio SDK. Check your API key.' });
                    }
                    return success;
                } catch (error: any) {
                    const msg = error.message || String(error);
                    set({ error: msg.length > 120 ? msg.slice(0, 117) + '...' : msg });
                    return false;
                } finally {
                    set({ isLoading: false });
                }
            },

            startOnboarding: () => set({ isOnboarding: true }),

            completeOnboarding: () => set({ isOnboarding: false }),

            loadConnections: async () => {
                set({ isLoading: true });
                try {
                    const connections = await composioClient.getConnections();
                    set({ connections });
                } catch (error: any) {
                    set({ error: error.message });
                } finally {
                    set({ isLoading: false });
                }
            },

            loadApps: async () => {
                set({ isLoading: true });
                try {
                    const apps = await composioClient.getAvailableApps();
                    set({ availableApps: apps });
                } catch (error: any) {
                    set({ error: error.message });
                } finally {
                    set({ isLoading: false });
                }
            },

            loadTools: async (appId?: string) => {
                set({ isLoading: true });
                try {
                    const tools = await composioClient.getAvailableTools(appId);
                    set({ availableTools: tools });
                } catch (error: any) {
                    set({ error: error.message });
                } finally {
                    set({ isLoading: false });
                }
            },

            searchTools: async (query: string) => {
                try {
                    return await composioClient.searchTools(query);
                } catch (error: any) {
                    set({ error: error.message });
                    return [];
                }
            },

            requestToolPermission: (toolId, appId, toolName) => {
                set(state => ({
                    pendingPermissions: [
                        ...state.pendingPermissions,
                        { toolId, appId, toolName }
                    ]
                }));
            },

            grantToolPermission: (toolId) => {
                set(state => ({
                    authorizedTools: new Set([...state.authorizedTools, toolId]),
                    pendingPermissions: state.pendingPermissions.filter(p => p.toolId !== toolId)
                }));
            },

            denyToolPermission: (toolId) => {
                set(state => ({
                    pendingPermissions: state.pendingPermissions.filter(p => p.toolId !== toolId)
                }));
            },

            authorizeApp: async (appId: string) => {
                set({ isLoading: true, error: null });
                try {
                    const authUrl = await composioClient.getAuthUrl(appId);
                    return authUrl;
                } catch (error: any) {
                    const msg = error.message || String(error);
                    set({ error: msg });
                    return null;
                } finally {
                    set({ isLoading: false });
                }
            },

            executeTool: async (toolId, params, appId) => {
                const state = get();

                // Check if tool is authorized
                if (!state.authorizedTools.has(toolId)) {
                    return {
                        success: false,
                        error: 'Tool not authorized',
                        requiresPermission: true,
                        toolId,
                        appId
                    };
                }

                try {
                    return await composioClient.executeTool(toolId, params, appId);
                } catch (error: any) {
                    return { success: false, error: error.message };
                }
            },

            getToolsForPrompt: () => {
                const state = get();
                const toolsByApp: Record<string, ComposioTool[]> = {};
                
                state.availableTools.forEach(tool => {
                    if (!toolsByApp[tool.appName]) {
                        toolsByApp[tool.appName] = [];
                    }
                    toolsByApp[tool.appName].push(tool);
                });

                let prompt = '\n[COMPOSIO INTEGRATIONS]\n';
                for (const [appName, tools] of Object.entries(toolsByApp)) {
                    prompt += `\n${appName}:\n`;
                    tools.forEach(tool => {
                        const authStatus = state.authorizedTools.has(tool.id) ? '✅' : '🔒';
                        const params = Object.entries(tool.params || {})
                            .map(([key, param]: any) => `${key}: ${param.type || 'string'}`)
                            .join(', ');
                        prompt += `  ${authStatus} ${tool.name}(${params}): ${tool.description}\n`;
                    });
                }
                
                return prompt;
            },

            logout: () => {
                composioClient.logout();
                set({
                    apiKey: '',
                    isAuthenticated: false,
                    isOnboarding: false,
                    connections: [],
                    availableTools: [],
                    availableApps: [],
                    authorizedTools: new Set(),
                    pendingPermissions: [],
                    error: null
                });
            },

            clearError: () => set({ error: null })
        }),
        {
            name: 'neuro-composio-storage',
            partialize: (state) => ({
                apiKey: state.apiKey,
                isAuthenticated: state.isAuthenticated,
                authorizedTools: Array.from(state.authorizedTools),
            }),
            merge: (persistedState: any, currentState) => ({
                ...currentState,
                ...persistedState,
                authorizedTools: new Set(persistedState.authorizedTools || [])
            })
        }
    )
);
