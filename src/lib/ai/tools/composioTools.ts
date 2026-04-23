/**
 * Composio Tools - Dynamic tool integration from Composio
 * Allows AI to execute 500+ integrated tools via Composio
 */

import { ToolDefinition, ToolContext, ToolResult, registerTool } from '../toolEngine';
import { useComposioStore } from '../../../stores/composioStore';
import { useOS } from '../../../hooks/useOS';

/**
 * Register a Composio tool dynamically
 * This creates a wrapper that checks permissions before execution
 */
export function registerComposioTool(composioTool: {
    id: string;
    name: string;
    description: string;
    appId: string;
    appName: string;
    requiresAuth: boolean;
    params: Record<string, any>;
    category?: string;
    tags?: string[];
}) {
    const tool: ToolDefinition = {
        name: `composio_${composioTool.name}`,
        description: `[${composioTool.appName}] ${composioTool.description || `Composio tool from ${composioTool.appId}`}`,
        category: 'automation',
        parameters: Object.entries(composioTool.params || {}).reduce((acc, [key, param]: any) => {
            acc[key] = {
                type: param.type || 'string',
                description: param.description || key,
                required: param.required !== false
            };
            return acc;
        }, {} as Record<string, any>),
        requiresConfirmation: composioTool.requiresAuth,
        handler: async (args, context) => {
            const store = useComposioStore.getState();

            // Check if tool is authorized
            if (!store.authorizedTools.has(composioTool.id)) {
                return {
                    success: false,
                    message: `Tool "${composioTool.name}" requires authorization. Please grant permission to use ${composioTool.appName}.`,
                    data: {
                        requiresPermission: true,
                        toolId: composioTool.id,
                        toolName: composioTool.name,
                        appId: composioTool.appId,
                        appName: composioTool.appName
                    }
                };
            }

            // Execute the tool via Composio
            try {
                const result = await store.executeTool(composioTool.id, args, composioTool.appId);

                if (result.success) {
                    return {
                        success: true,
                        message: JSON.stringify(result.data || { success: true }, null, 2)
                    };
                } else {
                    return {
                        success: false,
                        message: result.error || `Tool execution failed`
                    };
                }
            } catch (error: any) {
                return {
                    success: false,
                    message: `Failed to execute ${composioTool.name}: ${error.message}`
                };
            }
        }
    };

    registerTool(tool);
}

/**
 * Load and register all available Composio tools
 */
export async function loadComposioTools() {
    const store = useComposioStore.getState();

    if (!store.isAuthenticated) {
        console.log('Composio not authenticated, skipping tool loading');
        return;
    }

    // Load available tools from Composio
    await store.loadTools();

    // Register each tool in the tool engine
    const tools = store.availableTools;
    for (const tool of tools) {
        registerComposioTool({
            ...tool,
            appName: tool.appName || tool.appId
        });
    }
    
    console.log(`Loaded ${tools.length} Composio tools`);
}

/**
 * Unregister all Composio tools (e.g., on logout)
 */
export function unloadComposioTools() {
    // Note: We don't have an unregister function in toolEngine yet
    // This would need to be added if Composio tools need to be removed
    console.log('Composio tools unloaded');
}

/**
 * Get Composio tools formatted for the AI prompt
 */
export function getComposioToolsForPrompt(): string {
    const store = useComposioStore.getState();
    
    if (!store.isAuthenticated || store.availableTools.length === 0) {
        return '';
    }
    
    return store.getToolsForPrompt();
}

/**
 * Register Composio integration tools
 * These tools allow the AI to manage Composio connections
 */
registerTool({
    name: 'composio_list_apps',
    description: 'Lists all available Composio app integrations that can be connected',
    category: 'automation',
    parameters: {},
    handler: async (): Promise<ToolResult> => {
        const store = useComposioStore.getState();
        
        if (!store.isAuthenticated) {
            return {
                success: false,
                message: 'Composio is not authenticated. Please set up your Composio API key in Settings.'
            };
        }
        
        await store.loadApps();
        const apps = store.availableApps;
        
        if (apps.length === 0) {
            return {
                success: true,
                message: 'No Composio apps available. Please check your API key.'
            };
        }
        
        const appList = apps.map(app => 
            `• **${app.name}** (${app.id}): ${app.description || 'No description'} [${app.toolCount} tools]`
        ).join('\n');
        
        return {
            success: true,
            message: `Available Composio Integrations:\n${appList}`,
            data: apps
        };
    }
});

registerTool({
    name: 'composio_list_connections',
    description: 'Lists all currently connected Composio app integrations',
    category: 'automation',
    parameters: {},
    handler: async (): Promise<ToolResult> => {
        const store = useComposioStore.getState();
        
        if (!store.isAuthenticated) {
            return {
                success: false,
                message: 'Composio is not authenticated.'
            };
        }
        
        await store.loadConnections();
        const connections = store.connections;
        
        if (connections.length === 0) {
            return {
                success: true,
                message: 'No apps are currently connected. Use composio_authorize_app to connect an app.'
            };
        }
        
        const connectionList = connections.map(conn => {
            const status = conn.status === 'connected' ? '✅' : '⏳';
            return `${status} **${conn.appName}** (${conn.appId}): ${conn.status}`;
        }).join('\n');
        
        return {
            success: true,
            message: `Connected Apps:\n${connectionList}`,
            data: connections
        };
    }
});

registerTool({
    name: 'composio_authorize_app',
    description: 'Authorizes a Composio app integration (opens browser for OAuth)',
    category: 'automation',
    parameters: {
        app_id: {
            type: 'string',
            description: 'The app ID to authorize (e.g., github, slack, gmail)',
            required: true
        }
    },
    requiresConfirmation: true,
    handler: async (args): Promise<ToolResult> => {
        const store = useComposioStore.getState();
        
        if (!store.isAuthenticated) {
            return {
                success: false,
                message: 'Composio is not authenticated.'
            };
        }
        
        const authUrl = await store.authorizeApp(args.app_id);
        
        if (authUrl) {
            return {
                success: true,
                message: `Opening authorization page for ${args.app_id}. Please complete the authorization in your browser.`,
                data: { authUrl }
            };
        } else {
            return {
                success: false,
                message: `Failed to get authorization URL for ${args.app_id}. Please check if the app exists.`
            };
        }
    }
});

registerTool({
    name: 'composio_search_tools',
    description: 'Searches for Composio tools by query',
    category: 'automation',
    parameters: {
        query: {
            type: 'string',
            description: 'Search query to find tools (e.g., "send email", "create issue")',
            required: true
        }
    },
    handler: async (args): Promise<ToolResult> => {
        const store = useComposioStore.getState();

        if (!store.isAuthenticated) {
            return {
                success: false,
                message: 'Composio is not authenticated.'
            };
        }

        const tools = await store.searchTools(args.query);

        if (tools.length === 0) {
            return {
                success: true,
                message: `No tools found for "${args.query}".`
            };
        }

        const toolList = tools.map(tool => {
            const authStatus = store.authorizedTools.has(tool.id) ? '✅' : '🔒';
            return `${authStatus} **${tool.name}** (${tool.appName}): ${tool.description}`;
        }).join('\n');

        return {
            success: true,
            message: `Found ${tools.length} tools matching "${args.query}":\n${toolList}`,
            data: tools
        };
    }
});

// ─── Connect Integration ────────────────────────────────────────
registerTool({
    name: 'connect_integration',
    description: 'Opens the Integrations app and triggers a connection flow for a specific service (e.g., gmail, slack, github, googlesheets, notion, hubspot, googlecalendar). Use this when the user wants to connect a service.',
    category: 'automation',
    parameters: {
        app_name: {
            type: 'string',
            description: 'The service to connect (e.g., gmail, slack, github, googlesheets, notion, hubspot, googlecalendar)',
            required: true
        }
    },
    handler: async (args): Promise<ToolResult> => {
        const store = useComposioStore.getState();
        const os = useOS.getState();
        const appId = args.app_name.toLowerCase().replace(/\s+/g, '');

        if (!store.isAuthenticated) {
            os.openApp('integrations', 'Integrations');
            return {
                success: false,
                message: 'Composio API key not configured. I opened the Integrations app — please add your API key first.'
            };
        }

        const conn = store.connections.find(c => c.appId === appId);
        if (conn?.status === 'connected') {
            return {
                success: true,
                message: `${args.app_name} is already connected and ready to use.`
            };
        }

        let intWin = os.appWindows.find(w => w.component === 'integrations');
        if (!intWin) {
            os.openApp('integrations', 'Integrations');
            await new Promise(r => setTimeout(r, 400));
            intWin = useOS.getState().appWindows.find(w => w.component === 'integrations');
        }

        if (intWin) {
            useOS.getState().sendAppAction(intWin.id, 'connect_app', { appId });
        }

        return {
            success: true,
            message: `Opening ${args.app_name} connection flow. Please complete the authorization in your browser, then come back — the status will update automatically.`
        };
    }
});
