/**
 * Advanced Browser & Web Tools — scrape content, search, tab management, and automated actions.
 */
import { registerTool, ToolResult } from '../toolEngine';
import { useOS } from '../../../hooks/useOS';
import { useAIStore } from '../../../stores/aiStore';

// ─── Browser Tab & Navigation Control ─────────────────────────────

registerTool({
    name: 'browser_tab_control',
    description: 'Manages browser tabs: "new_tab", "close_tab", or "switch_tab".',
    category: 'browser',
    parameters: {
        action: { type: 'string', description: 'Action: "new_tab", "close_tab", "switch_tab"', required: true },
        url: { type: 'string', description: 'URL for new tab', required: false },
        tabId: { type: 'string', description: 'Target tab ID', required: false }
    },
    handler: async (args): Promise<ToolResult> => {
        try {
            const os = useOS.getState();
            const browserWin = os.appWindows.find(w => w.component === 'browser');

            if (!browserWin) {
                os.openApp('browser', 'Browser');
                return { success: true, message: "🌐 Opening Browser..." };
            }

            os.sendAppAction(browserWin.id, args.action, { url: args.url, id: args.tabId });
            return { success: true, message: `✅ Browser tab action: ${args.action}` };
        } catch (e: any) {
            return { success: false, message: `❌ Tab control failed: ${e.message}` };
        }
    }
});

registerTool({
    name: 'browser_navigate',
    description: 'Navigates the active tab to a specific URL.',
    category: 'browser',
    parameters: {
        url: { type: 'string', description: 'The URL to navigate to', required: true }
    },
    handler: async (args): Promise<ToolResult> => {
        try {
            const os = useOS.getState();
            let browserWin = os.appWindows.find(w => w.component === 'browser');

            if (!browserWin) {
                os.openApp('browser', 'Browser');
                // Auto-navigate after open is handled by BrowserApp useEffect or a small delay
                return { success: true, message: `🌐 Opening Browser to: ${args.url}` };
            }

            os.sendAppAction(browserWin.id, 'navigate', { url: args.url });
            os.focusWindow(browserWin.id);
            return { success: true, message: `🚀 Browser navigating to: ${args.url}` };
        } catch (e: any) {
            return { success: false, message: `❌ Browser navigation failed: ${e.message}` };
        }
    }
});

// ─── Browser Interaction (Automation) ─────────────────────────────

registerTool({
    name: 'browser_action',
    description: 'Executes automated actions on the current page: "click", "type", "scroll", "wait".',
    category: 'browser',
    parameters: {
        action: { type: 'string', description: 'Action: "click", "type", "scroll", "wait"', required: true },
        selector: { type: 'string', description: 'CSS Selector for the element', required: false },
        value: { type: 'string', description: 'Value for "type" action', required: false },
        ms: { type: 'number', description: 'Milliseconds for "wait" action', required: false }
    },
    handler: async (args): Promise<ToolResult> => {
        try {
            const { addBrowserLog } = useAIStore.getState();
            const os = useOS.getState();
            const browserWin = os.appWindows.find(w => w.component === 'browser');

            if (!browserWin) return { success: false, message: "❌ Browser is not open." };

            const logMsg = `Executing ${args.action}${args.selector ? ` on ${args.selector}` : ''}${args.value ? ` with value "${args.value}"` : ''}`;
            addBrowserLog({ type: 'action', message: logMsg });

            // In a real implementation, this would send an IPC to the Electron main process 
            // to execute code via webContents.executeJavaScript.
            // For this simulation, we send the action to the BrowserApp to reflect in the UI logs.
            os.sendAppAction(browserWin.id, 'browser_action', args);

            return { success: true, message: `⚙️ ${logMsg}` };
        } catch (e: any) {
            return { success: false, message: `❌ Browser action failed: ${e.message}` };
        }
    }
});

// ─── Data Extraction & Sync ───────────────────────────────────────

registerTool({
    name: 'browser_scrape',
    description: 'Extracts structured data or text from the current page.',
    category: 'browser',
    parameters: {
        url: { type: 'string', description: 'URL to scrape (optional, defaults to current)', required: false },
        format: { type: 'string', description: 'Format: "markdown", "text", "json"', required: false }
    },
    handler: async (args): Promise<ToolResult> => {
        try {
            const electron = (window as any).electron;
            const targetUrl = args.url || (document.querySelector('iframe') as HTMLIFrameElement)?.src;

            if (!targetUrl) return { success: false, message: "❌ No URL found to scrape." };

            useAIStore.getState().addBrowserLog({ type: 'info', message: `Scraping page: ${targetUrl}` });

            // Attempt to use Electron scraper if available
            if (electron?.browser?.scrape) {
                const result = await electron.browser.scrape(targetUrl);
                return {
                    success: true,
                    message: `📄 **Scraped Content from** ${targetUrl}:\n\n${result.text?.slice(0, 3000) || '(no text content)'}`,
                    data: result
                };
            }

            // Fallback: use proxy-request
            if (electron?.proxyRequest) {
                const result = await electron.proxyRequest(targetUrl);
                return { success: true, message: `📄 Scraped text content.`, data: result };
            }

            return { success: false, message: "❌ Scraping engine unavailable in this context." };
        } catch (e: any) {
            return { success: false, message: `❌ Scraping failed: ${e.message}` };
        }
    }
});

registerTool({
    name: 'browser_workspace_sync',
    description: 'Saves scraped data or images directly to the workspace.',
    category: 'browser',
    parameters: {
        filename: { type: 'string', description: 'Name of the file (e.g., "article.md")', required: true },
        content: { type: 'string', description: 'The content to save', required: true }
    },
    handler: async (args): Promise<ToolResult> => {
        try {
            const electron = (window as any).electron;
            if (!electron?.fs?.writeFile) return { success: false, message: "❌ Filesystem sync unavailable." };

            const path = `downloads/${args.filename}`; // Simulated workspace path
            await electron.fs.writeFile(path, args.content);

            useAIStore.getState().addBrowserLog({ type: 'info', message: `Saved browser data to workspace: ${path}` });

            return { success: true, message: `💾 Saved content to [${args.filename}](file://${path}) in workspace.` };
        } catch (e: any) {
            return { success: false, message: `❌ Sync failed: ${e.message}` };
        }
    }
});

// ─── Web Search (Legacy Override) ────────────────────────────────

registerTool({
    name: 'search_web',
    description: 'Searches the web and automatically opens a new tab with results.',
    category: 'browser',
    parameters: {
        query: { type: 'string', description: 'Search query', required: true }
    },
    handler: async (args): Promise<ToolResult> => {
        try {
            const os = useOS.getState();
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(args.query)}&igu=1`;

            let browserWin = os.appWindows.find(w => w.component === 'browser');
            if (browserWin) {
                os.sendAppAction(browserWin.id, 'new_tab', { url: searchUrl });
            } else {
                os.openApp('browser', 'Browser');
                // BrowserApp handle initial URL in production usually, here we rely on the navigate tool or tab logic
            }

            return { success: true, message: `🔍 Searching for "${args.query}" in a new tab.` };
        } catch (e: any) {
            return { success: false, message: `❌ Search failed: ${e.message}` };
        }
    }
});
