/**
 * Composio Tools - Dynamic tool integration from Composio
 * Allows AI to execute 500+ integrated tools via Composio
 */

import { ToolDefinition, ToolContext, ToolResult, registerTool } from '../toolEngine';
import { useComposioStore } from '../../../stores/composioStore';

/**
 * Register a Composio tool dynamically
 * This creates a wrapper that checks permissions before execution
 */
export function registerComposioTool(composioTool: {
    id: string;
    name: string;
    description: string;
    appId: string;
    requiresAuth: boolean;
    params: Record<string, any>;
}) {
    const tool: ToolDefinition = {
        name: composioTool.name,
        description: composioTool.description || `Composio tool from ${composioTool.appId}`,
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
                    message: `Tool "${composioTool.name}" requires authorization. Please grant permission to use ${composioTool.appId}.`,
                    data: {
                        requiresPermission: true,
                        toolId: composioTool.id,
                        toolName: composioTool.name,
                        appId: composioTool.appId
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

    // Load available tools from Composio
    await store.loadTools();

    // Register each tool in the tool engine
    const tools = store.availableTools;
    for (const tool of tools) {
        registerComposioTool(tool);
    }
}

/**
 * Unregister all Composio tools (e.g., on logout)
 */
export function unloadComposioTools() {
    const store = useComposioStore.getState();

    for (const tool of store.availableTools) {
        // Note: We don't have an unregister function in toolEngine yet
        // This would need to be added if Composio tools need to be removed
    }
}
