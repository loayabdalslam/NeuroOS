/**
 * OS Control Tools — open/close apps, notifications, system info, wallpaper
 */
import { registerTool, ToolContext, ToolResult } from '../toolEngine';
import { APPS_CONFIG } from '../../apps';
import { useOS } from '../../../hooks/useOS';

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
            const title = args.title || 'Neuro OS';
            const body = args.body || '';
            const icon = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🤖</text></svg>';

            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`Neuro OS — ${title}`, { body, icon });
            } else if ('Notification' in window) {
                const perm = await Notification.requestPermission();
                if (perm === 'granted') {
                    new Notification(`Neuro OS — ${title}`, { body, icon });
                }
            }
            // Also try electron native notification
            try {
                await (window as any).electron?.system?.notification?.(`Neuro OS — ${title}`, body);
            } catch {}

            return { success: true, message: `Notification sent: ${title}`, data: { title, body } };
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
        const ext = (fileName.split('.').pop() || '').toLowerCase();
        const mediaExts = ['png','jpg','jpeg','gif','webp','svg','bmp','ico','avif','mp4','webm','avi','mov','mkv','wmv','ogv','mp3','wav','ogg','flac','aac','m4a','wma'];
        const appType = mediaExts.includes(ext) ? 'media' : 'viewer';

        try {
            // Open the appropriate viewer window
            ctx.openApp(appType, fileName);

            // Send the file path to the viewer after it's created
            setTimeout(() => {
                const allWindows = ctx.getAppWindows();
                const viewerWin = allWindows.filter((w: any) => w.component === appType).pop();
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
registerTool({
    name: 'add_board_widget',
    description: 'Adds a live data widget (weather, stocks, news) to the project NeuroBoard.',
    category: 'os',
    parameters: {
        type: { type: 'string', description: 'Widget type: "weather", "stocks", "news"', enum: ['weather', 'stocks', 'news'], required: true },
        symbol: { type: 'string', description: 'Stock symbol (if type is stocks)', required: false }
    },
    handler: async (args): Promise<ToolResult> => {
        try {
            let boardWin = useOS.getState().appWindows.find(w => w.component === 'board');

            if (!boardWin) {
                useOS.getState().openApp('board', 'NeuroBoard');
            }

            await new Promise(r => setTimeout(r, 800));

            boardWin = useOS.getState().appWindows.find(w => w.component === 'board');
            if (boardWin) {
                useOS.getState().sendAppAction(boardWin.id, 'add_card', {
                    type: 'widget',
                    content: args.type.toUpperCase(),
                    metadata: { widgetType: args.type, symbol: args.symbol }
                });
            }

            return { success: true, message: `✅ Added **${args.type}** widget to NeuroBoard.` };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to add widget: ${e.message}` };
        }
    }
});

// ─── Save to NeuroBoard ─────────────────────────────────────────
registerTool({
    name: 'save_to_board',
    description: 'Saves a note, text, or content card to the NeuroBoard. Use this when user says "save to board" or "save to neuroboard".',
    category: 'os',
    parameters: {
        title: { type: 'string', description: 'Title for the card', required: true },
        content: { type: 'string', description: 'Content to save on the board', required: true },
        color: { type: 'string', description: 'Card color: blue, green, yellow, red, purple', required: false }
    },
    handler: async (args): Promise<ToolResult> => {
        try {
            let boardWin = useOS.getState().appWindows.find(w => w.component === 'board');

            if (!boardWin) {
                useOS.getState().openApp('board', 'NeuroBoard');
                await new Promise(r => setTimeout(r, 800));
                boardWin = useOS.getState().appWindows.find(w => w.component === 'board');
            }

            if (boardWin) {
                useOS.getState().sendAppAction(boardWin.id, 'add_card', {
                    type: 'note',
                    title: args.title || 'Note',
                    content: args.content || '',
                    color: args.color || 'blue'
                });
                useOS.getState().focusWindow(boardWin.id);
            }

            return { success: true, message: `Saved "${args.title}" to NeuroBoard.`, data: { title: args.title } };
        } catch (e: any) {
            return { success: false, message: `Failed to save to board: ${e.message}` };
        }
    }
});

// ─── Update Memory ────────────────────────────────────────────────
registerTool({
    name: 'update_memory',
    description: 'Saves a key-value fact to long-term memory so it persists across sessions.',
    category: 'os',
    parameters: {
        key: { type: 'string', description: 'Memory key (e.g. "user_name", "preferred_language")', required: true },
        value: { type: 'string', description: 'Value to store', required: true }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        ctx.updateMemory(args.key, args.value);
        return { success: true, message: `🧠 Remembered: **${args.key}** = "${args.value}"`, data: { key: args.key, value: args.value } };
    }
});

// ─── Save to Workspace ────────────────────────────────────────────
registerTool({
    name: 'save_to_workspace',
    description: 'Saves text content to a file in the workspace.',
    category: 'file',
    parameters: {
        filename: { type: 'string', description: 'File name (e.g. "notes.md", "data.json")', required: true },
        content: { type: 'string', description: 'Content to write to the file', required: true }
    },
    handler: async (args, ctx): Promise<ToolResult> => {
        if (!ctx.workspacePath) return { success: false, message: '❌ No workspace is set. Open File Manager to set one.' };
        try {
            const sep = ctx.workspacePath.includes('/') ? '/' : '\\';
            const fullPath = `${ctx.workspacePath}${sep}${args.filename}`;
            await ctx.writeFile(fullPath, args.content);
            return { success: true, message: `💾 Saved **${args.filename}** to workspace.`, data: { path: fullPath } };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to save: ${e.message}` };
        }
    }
});

// ─── Get App Windows (Alias for list_running_apps) ──────────────
registerTool({
    name: 'get_app_windows',
    description: 'Gets a list of all open application windows. Same as list_running_apps.',
    category: 'os',
    parameters: {},
    handler: async (_, ctx): Promise<ToolResult> => {
        const windows = ctx.getAppWindows();
        const windowList = windows
            .map(w => `• **${w.title}** (${w.component}) - State: ${w.state}`)
            .join('\n');

        return {
            success: true,
            message: `🪟 **${windows.length}** window(s) open:\n${windowList}`,
            data: { windows, count: windows.length }
        };
    }
});
