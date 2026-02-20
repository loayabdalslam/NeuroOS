/**
 * Browser & Web Tools — scrape content, search, open URLs
 */
import { registerTool, ToolResult } from '../toolEngine';

// ─── Browse/Scrape Web ───────────────────────────────────────────
registerTool({
    name: 'browse_web',
    description: 'Fetches a web page and extracts its text content. Use for research, reading articles, checking APIs.',
    category: 'browser',
    parameters: {
        url: { type: 'string', description: 'The URL to fetch', required: true }
    },
    handler: async (args): Promise<ToolResult> => {
        try {
            const electron = (window as any).electron;

            // Try Electron proxy first (avoids CORS)
            if (electron?.browser?.scrape) {
                const result = await electron.browser.scrape(args.url);
                return {
                    success: true,
                    message: `🌐 **Content from** [${args.url}](${args.url}):\n\n${result.text?.slice(0, 5000) || result.html?.slice(0, 5000) || '(no content)'}${(result.text?.length || 0) > 5000 ? '\n\n...(truncated)' : ''}`,
                    data: result
                };
            }

            // Fallback: use the proxy-request channel
            if (electron?.proxyRequest) {
                const result = await electron.proxyRequest(args.url);
                const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                return {
                    success: true,
                    message: `🌐 **Content from** [${args.url}](${args.url}):\n\n${text.slice(0, 5000)}${text.length > 5000 ? '\n\n...(truncated)' : ''}`,
                    data: result
                };
            }

            // Last resort: direct fetch
            const response = await fetch(args.url);
            const text = await response.text();
            // Simple HTML to text
            const textContent = text.replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return {
                success: true,
                message: `🌐 **Content from** [${args.url}](${args.url}):\n\n${textContent.slice(0, 5000)}${textContent.length > 5000 ? '\n\n...(truncated)' : ''}`,
                data: { text: textContent }
            };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to fetch "${args.url}": ${e.message}` };
        }
    }
});

// ─── Web Search ──────────────────────────────────────────────────
registerTool({
    name: 'search_web',
    description: 'Searches the web using DuckDuckGo and returns results summary. Use for research and information lookup.',
    category: 'browser',
    parameters: {
        query: { type: 'string', description: 'Search query', required: true }
    },
    handler: async (args): Promise<ToolResult> => {
        try {
            const electron = (window as any).electron;
            const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(args.query)}&format=json&no_html=1&skip_disambig=1`;

            let data: any;
            if (electron?.proxyRequest) {
                data = await electron.proxyRequest(searchUrl);
            } else {
                const response = await fetch(searchUrl);
                data = await response.json();
            }

            if (typeof data === 'string') {
                try { data = JSON.parse(data); } catch { /* ignore */ }
            }

            const results: string[] = [];

            if (data.Abstract) {
                results.push(`**${data.Heading || 'Summary'}:** ${data.Abstract}`);
                if (data.AbstractURL) results.push(`[Source](${data.AbstractURL})`);
            }

            if (data.RelatedTopics && data.RelatedTopics.length > 0) {
                results.push('\n**Related:**');
                data.RelatedTopics.slice(0, 5).forEach((topic: any) => {
                    if (topic.Text) results.push(`• ${topic.Text}`);
                });
            }

            if (results.length === 0) {
                results.push(`No instant answer found for "${args.query}". Try browsing a specific URL for more details.`);
            }

            return {
                success: true,
                message: `🔍 **Search: "${args.query}"**\n\n${results.join('\n')}`,
                data
            };
        } catch (e: any) {
            return { success: false, message: `❌ Search failed: ${e.message}` };
        }
    }
});

// ─── Open URL in System Browser ──────────────────────────────────
registerTool({
    name: 'open_url',
    description: 'Opens a URL in the system\'s default browser.',
    category: 'browser',
    parameters: {
        url: { type: 'string', description: 'URL to open', required: true }
    },
    handler: async (args): Promise<ToolResult> => {
        try {
            const electron = (window as any).electron;
            if (electron?.browser?.openExternal) {
                await electron.browser.openExternal(args.url);
            } else {
                window.open(args.url, '_blank');
            }
            return { success: true, message: `🌐 Opened [${args.url}](${args.url}) in browser.` };
        } catch (e: any) {
            return { success: false, message: `❌ Failed to open URL: ${e.message}` };
        }
    }
});
