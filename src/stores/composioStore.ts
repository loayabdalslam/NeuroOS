/**
 * Composio Store - Manages Composio integrations and tool permissions
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { composioClient, type ComposioTool, type ComposioAppConnection } from '../lib/composio/composioClient';

interface ComposioState {
    apiKey: string;
    isAuthenticated: boolean;
    isOnboarding: boolean;
    connections: ComposioAppConnection[];
    availableTools: ComposioTool[];
    authorizedTools: Set<string>;
    pendingPermissions: { toolId: string; appId: string; toolName: string }[];

    // Actions
    setApiKey: (key: string) => Promise<boolean>;
    startOnboarding: () => void;
    completeOnboarding: () => void;
    loadConnections: () => Promise<void>;
    loadTools: (appId?: string) => Promise<void>;
    requestToolPermission: (toolId: string, appId: string, toolName: string) => void;
    grantToolPermission: (toolId: string) => void;
    denyToolPermission: (toolId: string) => void;
    authorizeApp: (appId: string) => Promise<string | null>;
    executeTool: (toolId: string, params: Record<string, any>, appId: string) => Promise<any>;
    logout: () => void;
}

export const useComposioStore = create<ComposioState>()(
    persist(
        (set, get) => ({
            apiKey: '',
            isAuthenticated: false,
            isOnboarding: false,
            connections: [],
            availableTools: [],
            authorizedTools: new Set(),
            pendingPermissions: [],

            setApiKey: async (key: string) => {
                const success = await composioClient.initializeAuth(key);
                if (success) {
                    set({ apiKey: key, isAuthenticated: true, isOnboarding: false });
                    await get().loadConnections();
                    await get().loadTools();
                }
                return success;
            },

            startOnboarding: () => set({ isOnboarding: true }),

            completeOnboarding: () => set({ isOnboarding: false }),

            loadConnections: async () => {
                const connections = await composioClient.getConnections();
                set({ connections });
            },

            loadTools: async (appId?: string) => {
                const tools = await composioClient.getAvailableTools(appId);
                set({ availableTools: tools });
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
                const authUrl = await composioClient.getAuthUrl(appId);
                if (authUrl) {
                    window.open(authUrl, 'composio_auth', 'width=600,height=700');
                    return authUrl;
                }
                return null;
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

                return await composioClient.executeTool(toolId, params, appId);
            },

            logout: () => {
                composioClient.logout();
                set({
                    apiKey: '',
                    isAuthenticated: false,
                    isOnboarding: false,
                    connections: [],
                    availableTools: [],
                    authorizedTools: new Set(),
                    pendingPermissions: []
                });
            }
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
