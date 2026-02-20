/**
 * OS Control Tools — open/close apps, notifications, system info, wallpaper
 */
import { registerTool, ToolContext, ToolResult } from '../toolEngine';
import { APPS_CONFIG } from '../../apps';

// ─── Open App ────────────────────────────────────────────────────
registerTool({
    name: 'open_app',
    description: 'Opens a system application by its ID.',
    category: 'os',
    parameters: {
        app_id: {
            type: 'string',
            description: `App ID to open. Available: ${Object.keys(APPS_CONFIG).join(', ')}`,
            enum: Object.keys(APPS_CONFIG),
            required: true
        }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        const app = APPS_CONFIG[args.app_id];
        if (app) {
            ctx.openApp(app.id, app.name);
            return { success: true, message: `✅ Launched **${app.name}**.`, data: { app_id: app.id, app_name: app.name } };
        }
        return { success: false, message: `App "${args.app_id}" not found. Available: ${Object.keys(APPS_CONFIG).join(', ')}` };
    }
});

// ─── Close App ───────────────────────────────────────────────────
registerTool({
    name: 'close_app',
    description: 'Closes a running application window by its window ID.',
    category: 'os',
    parameters: {
        window_id: {
            type: 'string',
            description: 'The window ID to close (get from list_running_apps)',
            required: true
        }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        const win = ctx.appWindows.find(w => w.id === args.window_id);
        if (win) {
            ctx.closeWindow(args.window_id);
            return { success: true, message: `✅ Closed **${win.title}**.`, data: { window_id: args.window_id, title: win.title } };
        }
        return { success: false, message: `Window "${args.window_id}" not found.` };
    }
});

// ─── List Running Apps ───────────────────────────────────────────
registerTool({
    name: 'list_running_apps',
    description: 'Returns a list of currently open application windows with their IDs.',
    category: 'os',
    parameters: {},
    handler: async (_args, ctx): Promise<ToolResult> => {
        if (ctx.appWindows.length === 0) {
            return { success: true, message: 'No applications are currently running.' };
        }
        const list = ctx.appWindows.map(w => `• **${w.title}** (ID: \`${w.id}\`)`).join('\n');
        return { success: true, message: `Currently running:\n${list}`, data: ctx.appWindows };
    }
});

// ─── Send Notification ───────────────────────────────────────────
registerTool({
    name: 'send_notification',
    description: 'Shows a native system notification with a title and message.',
    category: 'os',
    parameters: {
        title: { type: 'string', description: 'Notification title', required: true },
        body: { type: 'string', description: 'Notification message body', required: true }
    },
    handler: async (args): Promise<ToolResult> => {
        try {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(args.title, { body: args.body });
            } else if ('Notification' in window) {
                const perm = await Notification.requestPermission();
                if (perm === 'granted') {
                    new Notification(args.title, { body: args.body });
                }
            }
            return { success: true, message: `🔔 Notification sent: **${args.title}**`, data: { title: args.title, body: args.body } };
        } catch (e: any) {
            return { success: false, message: `Failed to send notification: ${e.message}` };
        }
    }
});

// ─── Get System Info ─────────────────────────────────────────────
registerTool({
    name: 'get_system_info',
    description: 'Returns system information including platform, memory, and CPU.',
    category: 'os',
    parameters: {},
    handler: async (): Promise<ToolResult> => {
        try {
            const info = await (window as any).electron?.system?.info?.();
            if (info) {
                return {
                    success: true,
                    message: `**System Info:**\n• Platform: ${info.platform}\n• Architecture: ${info.arch}\n• CPUs: ${info.cpus}\n• Total Memory: ${(info.totalMemory / 1024 / 1024 / 1024).toFixed(1)} GB\n• Free Memory: ${(info.freeMemory / 1024 / 1024 / 1024).toFixed(1)} GB\n• Hostname: ${info.hostname}\n• Uptime: ${Math.floor(info.uptime / 3600)}h ${Math.floor((info.uptime % 3600) / 60)}m`,
                    data: info
                };
            }
            // Fallback to navigator API
            const nav = navigator as any;
            return {
                success: true,
                message: `**System Info:**\n• Platform: ${nav.platform}\n• Language: ${nav.language}\n• Cores: ${nav.hardwareConcurrency}\n• Online: ${nav.onLine}`
            };
        } catch (e: any) {
            return { success: false, message: `Failed to get system info: ${e.message}` };
        }
    }
});

// ─── Open File in Viewer ─────────────────────────────────────────
registerTool({
    name: 'open_file',
    description: 'Opens a file inside the OS file viewer. Supports ALL file types: code, text, images, video, audio, PDF, markdown, JSON, HTML/SVG. Opens a new viewer window with the file content displayed.',
    category: 'os',
    parameters: {
        path: {
            type: 'string',
            description: 'Absolute path to the file, or path relative to the workspace',
            required: true
        }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        const path = args.path;
        // Build absolute path if relative
        let fullPath = path;
        if (ctx.workspacePath && !path.match(/^[A-Za-z]:[/\\]/) && !path.startsWith('/')) {
            const sep = ctx.workspacePath.includes('/') ? '/' : '\\';
            fullPath = `${ctx.workspacePath}${sep}${path}`;
        }

        const fileName = fullPath.replace(/\\/g, '/').split('/').pop() || path;

        try {
            // Open a new viewer window
            ctx.openApp('viewer', fileName);

            // Send the file path to the viewer after it's created
            setTimeout(() => {
                const allWindows = ctx.getAppWindows();
                const viewerWin = allWindows.filter((w: any) => w.component === 'viewer').pop();
                if (viewerWin) {
                    ctx.sendAppAction(viewerWin.id, 'open_file', { path: fullPath, name: fileName });
                }
            }, 100);

            return {
                success: true,
                message: `📂 Opened **${fileName}** in File Viewer`,
                data: { path: fullPath, name: fileName }
            };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to open file: ${e.message}` };
        }
    }
});
