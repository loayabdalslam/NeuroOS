/**
 * browserTools.ts – Electron Webview Automation for NeuroOS AI
 *
 * Every tool here drives the real <webview> element in Browser.tsx via
 * sendAppAction + a promise-based requestId bridge in aiStore.
 * For quick CORS-free fetches (no open browser needed) we fall back to
 * the electron.browser.scrape IPC that runs fetch in the main process.
 */

import { registerTool, ToolResult } from '../toolEngine';
import { useOS } from '../../../hooks/useOS';
import { useAIStore } from '../../../stores/aiStore';
import { useWorkspaceStore } from '../../../stores/workspaceStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Open (or reuse) the browser window and return its window id */
function ensureBrowserOpen(url?: string): string | null {
    const os = useOS.getState();
    let win = os.appWindows.find(w => w.component === 'browser');
    if (!win) {
        os.openApp('browser', 'Browser');
        win = os.appWindows.find(w => w.component === 'browser');
    }
    if (!win) return null;
    os.focusWindow(win.id);
    return win.id;
}

/** Send an action to the browser window and await the promise-bridge result */
function sendBrowserAction(
    type: string,
    payload: Record<string, any>,
    timeoutMs = 25000
): Promise<{ success: boolean; data?: any; error?: string }> {
    return new Promise((resolve, reject) => {
        const ai = useAIStore.getState();

        // ── Live log: announce before the action fires ──
        const labelMap: Record<string, string> = {
            navigate_and_wait: `Navigating to ${payload.url || '...'}`,
            scrape_page: 'Scraping page content',
            get_html: 'Getting page HTML',
            get_links: 'Extracting page links',
            get_page_info: 'Getting page info',
            click: `Clicking: ${payload.selector || payload.text || `(${payload.x},${payload.y})`}`,
            type: `Typing into: ${payload.selector || 'input'}`,
            submit: `Submitting form: ${payload.selector || ''}`,
            key_press: `Key press: ${payload.key}`,
            scroll: `Scrolling (${payload.deltaX ?? 0}, ${payload.deltaY ?? 0})`,
            scroll_to: `Scrolling to: ${payload.selector}`,
            evaluate: 'Evaluating JavaScript',
            wait_for_selector: `Waiting for: ${payload.selector}`,
            wait: `Waiting ${payload.ms ?? 0}ms`,
            navigate: `Navigating to ${payload.url || '...'}`,
            new_tab: `Opening new tab: ${payload.url || ''}`,
            close_tab: 'Closing tab',
            back: 'Going back',
            forward: 'Going forward',
            refresh: 'Refreshing page',
        };
        ai.addBrowserLog({
            type: 'action',
            message: `⚙ ${labelMap[type] || type}`,
        });

        const requestId = ai.registerBrowserRequest(
            (result) => {
                // ── Live log: result ──
                if (result.success) {
                    ai.addBrowserLog({ type: 'info', message: `✓ ${labelMap[type] || type} completed` });
                } else {
                    ai.addBrowserLog({ type: 'error', message: `✗ ${labelMap[type] || type}: ${result.error || 'failed'}` });
                }
                resolve(result);
            },
            (err) => {
                ai.addBrowserLog({ type: 'error', message: `✗ ${labelMap[type] || type}: ${err?.message || err}` });
                reject(err);
            }
        );

        const os = useOS.getState();
        const win = os.appWindows.find(w => w.component === 'browser');
        if (!win) {
            ai.resolveBrowserRequest(requestId, { success: false, error: 'Browser window not open' });
            return;
        }
        os.sendAppAction(win.id, type, { ...payload, __requestId: requestId });

        // Timeout safeguard
        setTimeout(() => {
            const stillPending = useAIStore.getState().pendingBrowserRequests.has(requestId);
            if (stillPending) {
                ai.resolveBrowserRequest(requestId, { success: false, error: `Timeout after ${timeoutMs}ms for action "${type}"` });
            }
        }, timeoutMs);
    });
}

/** IPC-based CORS-free fetch (doesn't require browser window) */
async function ipcFetch(url: string): Promise<{ html: string; text: string }> {
    const electron = (window as any).electron;
    if (electron?.browser?.scrape) {
        return electron.browser.scrape(url);
    }
    // pure renderer fallback (may fail on CORS)
    const res = await fetch(url, { 
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
        } 
    });
    const html = await res.text();
    return { html, text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() };
}

/** Alternative search using DuckDuckGo HTML (more reliable) */
async function duckDuckGoSearch(query: string): Promise<{ results: string[]; html: string }> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const data = await ipcFetch(url);
    
    const results: string[] = [];
    // Extract result links from DuckDuckGo HTML
    const linkMatches = data.html.match(/href="(https?:\/\/[^"]+)"/g) || [];
    const seen = new Set<string>();
    
    for (const match of linkMatches) {
        const urlMatch = match.match(/href="(https?:\/\/[^"]+)"/);
        if (urlMatch) {
            const url = urlMatch[1];
            // Filter out DuckDuckGo internal links
            if (!url.includes('duckduckgo.com') && 
                !url.includes('google.com') && 
                !url.includes('yahoo.com') &&
                !url.includes('bing.com') &&
                url.length > 20 &&
                !seen.has(url)) {
                seen.add(url);
                results.push(url);
                if (results.length >= 10) break;
            }
        }
    }
    
    return { results, html: data.html };
}

/** Convert raw HTML/text to clean markdown */
function htmlToMarkdown(html: string, text: string, url: string): string {
    const lines: string[] = [];
    // title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) lines.push(`# ${titleMatch[1].trim()}`);
    // meta description
    const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if (metaMatch) lines.push(`> ${metaMatch[1].trim()}`);
    lines.push(`\n*Source: ${url}*\n`);
    // headings from html
    const headings = [...html.matchAll(/<h([1-3])[^>]*>([^<]+)<\/h\1>/gi)];
    if (headings.length) {
        lines.push('## Contents');
        headings.slice(0, 12).forEach(m => lines.push(`${'#'.repeat(Number(m[1]) + 1)} ${m[2].trim()}`));
        lines.push('');
    }
    // clean body text
    const clean = text
        .slice(0, 5000)
        .replace(/\s{3,}/g, '\n\n')
        .trim();
    if (clean) lines.push(clean);
    return lines.join('\n');
}

// simple heuristic to detect CAPTCHA presence in HTML/text
function detectCaptcha(html: string, text: string): boolean {
    const h = html.toLowerCase();
    const t = text.toLowerCase();
    if (h.includes('captcha') || t.includes('captcha')) return true;
    if (h.includes('g-recaptcha') || h.includes('hcaptcha')) return true;
    if (h.includes('please verify') || h.includes('are you human')) return true;
    return false;
}

// ─── Tools ──────────────────────────────────────────────────────────────────

// 1. NAVIGATE AND WAIT — opens page and waits for load
registerTool({
    name: 'browser_navigate',
    description: 'Navigate the browser to a URL and wait for the page to finish loading. Always call this before scraping or interacting.',
    category: 'browser',
    parameters: {
        url: { type: 'string', description: 'Full URL (must start with http:// or https://)', required: true },
        wait: { type: 'boolean', description: 'Wait for page load (default: true)', required: false },
        timeout: { type: 'number', description: 'Max wait time in ms (default 15000)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const url = String(args.url ?? '').trim();
        if (!url) return { success: false, message: 'URL is required' };

        ensureBrowserOpen(url);
        const shouldWait = args.wait !== false;
        useAIStore.getState().addBrowserLog({ type: 'info', message: `Navigating to: ${url}` });

        const action = shouldWait ? 'navigate_and_wait' : 'navigate';
        const result = await sendBrowserAction(action, { url, timeout: args.timeout ?? 15000 }, (args.timeout ?? 15000) + 2000);

        if (!result.success) return { success: false, message: `Navigation failed: ${result.error}` };
        return {
            success: true,
            message: `✅ Navigated to ${result.data?.url || url}${result.data?.timedOut ? ' (timed out, page may still be loading)' : ''}`,
            data: result.data,
        };
    },
});

// 2. SCRAPE PAGE — extract structured content from the loaded page
registerTool({
    name: 'browser_scrape',
    description: 'Extract structured text content from the currently loaded page in the browser. Navigate to the page first with browser_navigate. Returns `captcha: true` if a CAPTCHA is detected.',
    category: 'browser',
    parameters: {
        url: { type: 'string', description: 'Optional: navigate to this URL first, then scrape', required: false },
        maxLength: { type: 'number', description: 'Max text length to return (default 6000)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        if (args.url) {
            const url = String(args.url).trim();
            ensureBrowserOpen(url);
            await sendBrowserAction('navigate_and_wait', { url, timeout: 15000 }, 18000);
        } else {
            ensureBrowserOpen();
        }

        const result = await sendBrowserAction('scrape_page', { maxLength: args.maxLength ?? 6000 }, 15000);
        if (!result.success) return { success: false, message: `Scrape failed: ${result.error}` };

        const d = result.data;
        const md: string[] = [];
        if (d.title) md.push(`# ${d.title}`);
        if (d.meta) md.push(`> ${d.meta}`);
        md.push(`*Source: ${d.url}*\n`);
        if (d.h1s?.length) md.push(`## H1\n${d.h1s.join('\n')}`);
        if (d.h2s?.length) md.push(`## Sections\n${d.h2s.map((h: string) => `- ${h}`).join('\n')}`);
        if (d.cleanText) md.push(`\n${d.cleanText}`);

        useAIStore.getState().addBrowserLog({ type: 'info', message: `Scraped ${d.url} — ${d.cleanText?.length ?? 0} chars` });
        return {
            success: true,
            message: `✅ Scraped "${d.title || d.url}"`,
            data: { ...d, markdown: md.join('\n\n') },
        };
    },
});

// 3. WEB FETCH — CORS-free fetch via Electron IPC (doesn't open browser window)
registerTool({
    name: 'web_fetch',
    description: 'Fetch a URL via Electron (bypasses CORS) and return its content as markdown. Faster than browser_scrape but no JS execution.',
    category: 'browser',
    parameters: {
        url: { type: 'string', description: 'Full URL to fetch', required: true },
        format: { type: 'string', description: '"markdown" (default), "text", or "raw_html"', required: false },
        maxLength: { type: 'number', description: 'Max chars to return (default 8000)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const url = String(args.url ?? '').trim();
        if (!url.startsWith('http')) return { success: false, message: `Invalid URL: "${url}"` };

        useAIStore.getState().addBrowserLog({ type: 'info', message: `Fetching: ${url}` });
        try {
            const data = await ipcFetch(url);
            const fmt = args.format || 'markdown';
            const maxLen = args.maxLength ?? 8000;
            let content: string;
            if (fmt === 'raw_html') content = data.html.slice(0, maxLen);
            else if (fmt === 'text') content = data.text.slice(0, maxLen);
            else content = htmlToMarkdown(data.html, data.text, url).slice(0, maxLen);

            return {
                success: true,
                message: `✅ Fetched ${url} — ${content.length} chars`,
                data: { url, content, format: fmt },
            };
        } catch (e: any) {
            return { success: false, message: `❌ Fetch failed: ${e.message}` };
        }
    },
});

// 4. SEARCH WEB — Real web search using multiple sources
registerTool({
    name: 'search_web',
    description: 'Search the web and get real results. Uses multiple search engines for reliability. Returns actual URLs and titles you can visit.',
    category: 'browser',
    parameters: {
        query: { type: 'string', description: 'What to search for', required: true },
        open_browser: { type: 'boolean', description: 'Open results in browser', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const query = String(args.query ?? '').trim();
        if (!query) return { success: false, message: 'Search query is required' };

        useAIStore.getState().addBrowserLog({ type: 'info', message: `🔍 Searching for: "${query}"` });
        
        const results: Array<{title: string; url: string}> = [];
        
        try {
            // Try DuckDuckGo first
            try {
                const ddgUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&ia=web`;
                const ddgRes = await fetch(ddgUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'text/html',
                    }
                });
                const ddgHtml = await ddgRes.text();
                
                // Parse DuckDuckGo results
                const ddgMatches = ddgHtml.matchAll(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/g);
                for (const match of ddgMatches) {
                    let url = match[1];
                    const title = match[2].replace(/<[^>]+>/g, '').trim();
                    
                    // Clean DuckDuckGo redirect
                    if (url.includes('uddg=')) {
                        url = decodeURIComponent(url.split('uddg=')[1].split('&')[0]);
                    }
                    
                    if (url.startsWith('http') && title && !url.includes('duckduckgo.com')) {
                        results.push({ title, url });
                    }
                    if (results.length >= 10) break;
                }
            } catch (e) {
                useAIStore.getState().addBrowserLog({ type: 'error', message: `DuckDuckGo failed: ${e}` });
            }
            
            // If no results, try Bing
            if (results.length === 0) {
                try {
                    const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
                    const bingRes = await fetch(bingUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        }
                    });
                    const bingHtml = await bingRes.text();
                    
                    const bingMatches = bingHtml.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([^<]+)<\/a>/g);
                    for (const match of bingMatches) {
                        const url = match[1];
                        let title = match[2].replace(/<[^>]+>/g, '').trim();
                        
                        if (url && !url.includes('bing.com') && !url.includes('microsoft.com') && title.length > 5) {
                            results.push({ title: title.slice(0, 100), url });
                        }
                        if (results.length >= 10) break;
                    }
                } catch (e) {
                    useAIStore.getState().addBrowserLog({ type: 'error', message: `Bing failed: ${e}` });
                }
            }
            
            // If still no results, try Wikipedia
            if (results.length === 0) {
                try {
                    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json`;
                    const wikiRes = await fetch(wikiUrl);
                    const wikiData = await wikiRes.json() as any;

                    if (wikiData.query?.search && wikiData.query.search.length > 0) {
                        for (const result of wikiData.query.search) {
                            results.push({
                                title: result.title,
                                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title)}`
                            });
                            if (results.length >= 10) break;
                        }
                    }
                } catch (e) {
                    useAIStore.getState().addBrowserLog({ type: 'error', message: `Wikipedia search failed: ${e}` });
                }
            }

            // Try Jina AI reader as last resort
            if (results.length === 0) {
                try {
                    const jinaUrl = `https://r.jina.ai/http://www.google.com/search?q=${encodeURIComponent(query)}`;
                    const jinaRes = await fetch(jinaUrl);
                    const jinaText = await jinaRes.text();

                    if (jinaText && jinaText.length > 100) {
                        // Extract URLs from Jina AI summary
                        const urlMatches = jinaText.matchAll(/(https?:\/\/[^\s]+)/g);
                        for (const match of urlMatches) {
                            const url = match[1];
                            if (!url.includes('google.com') && !url.includes('gstatic.com') && url.length > 20) {
                                results.push({ title: url.slice(0, 50), url });
                            }
                            if (results.length >= 10) break;
                        }
                    }
                } catch (e) {
                    useAIStore.getState().addBrowserLog({ type: 'error', message: `Jina AI failed: ${e}` });
                }
            }

            // If we have results, return them
            if (results.length > 0) {
                const uniqueResults = results.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
                
                let message = `🔍 **Search Results for "${query}":**\n\n`;
                uniqueResults.slice(0, 8).forEach((r, i) => {
                    message += `${i + 1}. **${r.title}**\n   ${r.url}\n\n`;
                });
                message += `💡 Use **web_fetch** tool with any URL above to get full content.`;
                
                useAIStore.getState().addBrowserLog({ type: 'info', message: `Found ${uniqueResults.length} results` });
                
                return {
                    success: true,
                    message,
                    data: {
                        query,
                        resultLinks: uniqueResults.map(r => r.url),
                        count: uniqueResults.length
                    }
                };
            }
            
            // Last resort - try opening browser
            if (args.open_browser) {
                const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                ensureBrowserOpen(googleUrl);
                await sendBrowserAction('navigate_and_wait', { url: googleUrl, timeout: 10000 }, 15000);
                
                return {
                    success: true,
                    message: `🔍 Opened browser for search: "${query}"\n\nPlease check the browser window for results.`,
                    data: { query, browserOpened: true }
                };
            }
            
            return {
                success: false,
                message: `❌ Could not find search results for "${query}".

💡 Suggestions:
- Try a more specific search (e.g., "loaii abdalslam github" or "loaii abdalslam linkedin")
- Search for related terms or topics
- Use **web_fetch** if you know a specific URL
- Try **browser_navigate** to open a search in the browser manually`,
                data: { query }
            };
            
        } catch (e: any) {
            const errorMsg = e.message || 'Unknown error';
            useAIStore.getState().addBrowserLog({ type: 'error', message: `Search error: ${errorMsg}` });
            
            return {
                success: false,
                message: `❌ Search failed: ${errorMsg}. Try using web_fetch with a specific URL instead.`,
                data: { query, error: errorMsg }
            };
        }
    },
});

// 5. WEB RESEARCH — multi-URL fetch and combine
registerTool({
    name: 'web_research',
    description: 'Fetch multiple URLs and combine them into a single structured research report.',
    category: 'browser',
    parameters: {
        urls: { type: 'string', description: 'Comma-separated list of URLs', required: true },
        topic: { type: 'string', description: 'Research topic for the report header', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        const urls = String(args.urls).split(',').map(u => u.trim()).filter(u => u.startsWith('http'));
        if (!urls.length) return { success: false, message: 'No valid URLs provided' };

        const report: string[] = [`# Research Report${args.topic ? `: ${args.topic}` : ''}`, `*${urls.length} sources — ${new Date().toISOString().slice(0, 10)}*`, ''];
        let fetched = 0;
        for (const url of urls.slice(0, 5)) {
            try {
                const d = await ipcFetch(url);
                report.push('---', htmlToMarkdown(d.html, d.text, url).slice(0, 3000), '');
                fetched++;
            } catch (e: any) {
                report.push('---', `### ❌ Failed: ${url}`, `> ${e.message}`, '');
            }
        }
        return {
            success: fetched > 0,
            message: fetched > 0 ? `✅ Research: ${fetched}/${urls.length} sources` : '❌ All sources failed',
            data: { report: report.join('\n'), fetchedCount: fetched },
        };
    },
});

// 6. CLICK — click an element in the current page
registerTool({
    name: 'browser_click',
    description: 'Click an element on the current page by CSS selector, visible text, or x/y coordinates.',
    category: 'browser',
    parameters: {
        selector: { type: 'string', description: 'CSS selector (e.g. "#submit-btn", ".nav a")', required: false },
        text: { type: 'string', description: 'Visible text of the element to click', required: false },
        x: { type: 'number', description: 'X coordinate (use with y)', required: false },
        y: { type: 'number', description: 'Y coordinate (use with x)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        ensureBrowserOpen();
        const result = await sendBrowserAction('click', { selector: args.selector, text: args.text, x: args.x, y: args.y });
        if (!result.success) return { success: false, message: `Click failed: ${result.error}` };
        const d = result.data;
        if (!d?.clicked) return { success: false, message: `Element not found: ${d?.reason}` };
        return { success: true, message: `✅ Clicked <${d.tag}> "${d.text || ''}"`, data: d };
    },
});

// 7. TYPE — fill a text input
registerTool({
    name: 'browser_type',
    description: 'Type text into an input field or textarea on the current page.',
    category: 'browser',
    parameters: {
        text: { type: 'string', description: 'Text to type', required: true },
        selector: { type: 'string', description: 'CSS selector for the input (auto-detected if omitted)', required: false },
        clear: { type: 'boolean', description: 'Clear existing value first (default: true)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        ensureBrowserOpen();
        const result = await sendBrowserAction('type', { text: args.text, selector: args.selector, clear: args.clear !== false });
        if (!result.success) return { success: false, message: `Type failed: ${result.error}` };
        const d = result.data;
        if (!d?.typed) return { success: false, message: `Could not type: ${d?.reason}` };
        return { success: true, message: `✅ Typed "${String(args.text).slice(0, 40)}" into <${d.tag}>`, data: d };
    },
});

// 8. KEY PRESS — press a keyboard key (Enter, Escape, Tab, etc.)
registerTool({
    name: 'browser_key',
    description: 'Press a keyboard key in the browser (e.g. "Return", "Escape", "Tab", "ArrowDown").',
    category: 'browser',
    parameters: {
        key: { type: 'string', description: 'Key to press (e.g. "Return", "Escape", "Tab")', required: true },
    },
    handler: async (args): Promise<ToolResult> => {
        ensureBrowserOpen();
        const result = await sendBrowserAction('key_press', { key: args.key ?? 'Return' });
        if (!result.success) return { success: false, message: `Key press failed: ${result.error}` };
        return { success: true, message: `✅ Pressed "${args.key}"`, data: result.data };
    },
});

// 9. SUBMIT — submit a form
registerTool({
    name: 'browser_submit',
    description: 'Submit a form on the current page.',
    category: 'browser',
    parameters: {
        selector: { type: 'string', description: 'CSS selector for the form (defaults to first form)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        ensureBrowserOpen();
        const result = await sendBrowserAction('submit', { selector: args.selector });
        if (!result.success) return { success: false, message: `Submit failed: ${result.error}` };
        return { success: true, message: '✅ Form submitted', data: result.data };
    },
});

// 10. SCROLL — scroll the page
registerTool({
    name: 'browser_scroll',
    description: 'Scroll the browser page. Use y>0 to scroll down, y<0 to scroll up.',
    category: 'browser',
    parameters: {
        y: { type: 'number', description: 'Pixels to scroll vertically (positive = down)', required: false },
        x: { type: 'number', description: 'Pixels to scroll horizontally (positive = right)', required: false },
        selector: { type: 'string', description: 'Scroll a specific element into view instead', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        ensureBrowserOpen();
        const action = args.selector ? 'scroll_to' : 'scroll';
        const payload = args.selector ? { selector: args.selector } : { x: args.x ?? 0, y: args.y ?? 400 };
        const result = await sendBrowserAction(action, payload);
        if (!result.success) return { success: false, message: `Scroll failed: ${result.error}` };
        return { success: true, message: '✅ Scrolled', data: result.data };
    },
});

// 11. WAIT — wait for time or selector
registerTool({
    name: 'browser_wait',
    description: 'Wait for a CSS selector to appear on the page, or wait a fixed number of milliseconds.',
    category: 'browser',
    parameters: {
        selector: { type: 'string', description: 'CSS selector to wait for', required: false },
        ms: { type: 'number', description: 'Milliseconds to wait (max 30000)', required: false },
        timeout: { type: 'number', description: 'Timeout for selector wait in ms (default 10000)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        ensureBrowserOpen();
        if (args.selector) {
            const result = await sendBrowserAction('wait_for_selector', { selector: args.selector, timeout: args.timeout ?? 10000 }, (args.timeout ?? 10000) + 2000);
            if (!result.success) return { success: false, message: `Wait failed: ${result.error}` };
            return { success: true, message: `✅ Selector "${args.selector}" found`, data: result.data };
        } else {
            const ms = Math.min(args.ms ?? 1000, 30000);
            const result = await sendBrowserAction('wait', { ms }, ms + 2000);
            if (!result.success) return { success: false, message: `Wait failed: ${result.error}` };
            return { success: true, message: `✅ Waited ${ms}ms`, data: result.data };
        }
    },
});

// 12. EVALUATE — run arbitrary JavaScript in the page
registerTool({
    name: 'browser_evaluate',
    description: 'Execute JavaScript in the current browser page and return the result. Use for custom DOM inspection or manipulation.',
    category: 'browser',
    parameters: {
        code: { type: 'string', description: 'JavaScript expression or IIFE to execute', required: true },
    },
    handler: async (args): Promise<ToolResult> => {
        ensureBrowserOpen();
        const result = await sendBrowserAction('evaluate', { code: args.code });
        if (!result.success) return { success: false, message: `Evaluate failed: ${result.error}` };
        return {
            success: true,
            message: `✅ JS result: ${JSON.stringify(result.data?.result).slice(0, 200)}`,
            data: result.data,
        };
    },
});

// 13. GET PAGE INFO — get title, URL, scroll position
registerTool({
    name: 'browser_get_info',
    description: 'Get metadata about the current browser page: title, URL, readyState, body length.',
    category: 'browser',
    parameters: {},
    handler: async (): Promise<ToolResult> => {
        ensureBrowserOpen();
        const result = await sendBrowserAction('get_page_info', {});
        if (!result.success) return { success: false, message: `Info failed: ${result.error}` };
        const d = result.data;
        return {
            success: true,
            message: `📄 "${d.title}" — ${d.url}`,
            data: d,
        };
    },
});

// 14. GET LINKS — extract all links from the current page
registerTool({
    name: 'browser_get_links',
    description: 'Get all hyperlinks from the current browser page.',
    category: 'browser',
    parameters: {
        limit: { type: 'number', description: 'Max links to return (default 50)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        ensureBrowserOpen();
        const result = await sendBrowserAction('get_links', { limit: args.limit ?? 50 });
        if (!result.success) return { success: false, message: `Get links failed: ${result.error}` };
        return {
            success: true,
            message: `🔗 ${result.data?.links?.length ?? 0} links on ${result.data?.url}`,
            data: result.data,
        };
    },
});

// 15. GET HTML — get raw page HTML
registerTool({
    name: 'browser_get_html',
    description: 'Get the raw HTML of the current page (truncated to limit).',
    category: 'browser',
    parameters: {
        limit: { type: 'number', description: 'Max chars of HTML to return (default 50000)', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        ensureBrowserOpen();
        const result = await sendBrowserAction('get_html', { limit: args.limit ?? 50000 });
        if (!result.success) return { success: false, message: `Get HTML failed: ${result.error}` };
        return {
            success: true,
            message: `📄 ${result.data?.html?.length} chars of HTML`,
            data: result.data,
        };
    },
});

// 16. SAVE — save content to workspace
registerTool({
    name: 'browser_save',
    description: 'Save text content to a file in the workspace.',
    category: 'browser',
    parameters: {
        filename: { type: 'string', description: 'File name (e.g. "research.md")', required: true },
        content: { type: 'string', description: 'Content to save', required: true },
    },
    handler: async (args): Promise<ToolResult> => {
        const filename = String(args.filename ?? 'browser_content.txt').trim();
        const content = String(args.content ?? '');

        const electron = (window as any).electron;
        const ws = useWorkspaceStore?.getState?.();
        const workspacePath = ws?.workspacePath || '';

        if (electron?.fileSystem?.write) {
            try {
                const filePath = workspacePath ? `${workspacePath}/${filename}` : filename;
                await electron.fileSystem.write(filePath, content);
                return { success: true, message: `✅ Saved to ${filePath}`, data: { path: filePath, bytes: content.length } };
            } catch (e: any) {
                return { success: false, message: `Save failed: ${e.message}` };
            }
        }

        // Fallback: browser download
        const blob = new Blob([content], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        return { success: true, message: `✅ Downloaded as ${filename}`, data: { filename, bytes: content.length } };
    },
});

// 17. NEW TAB / CLOSE TAB / BACK / FORWARD / RELOAD — nav controls
registerTool({
    name: 'browser_tab',
    description: 'Control browser tabs: open a new tab, close current tab, go back, go forward, or reload.',
    category: 'browser',
    parameters: {
        action: { type: 'string', description: '"new", "close", "back", "forward", "reload"', required: true },
        url: { type: 'string', description: 'URL for new tab (only for action="new")', required: false },
    },
    handler: async (args): Promise<ToolResult> => {
        ensureBrowserOpen();
        const actionMap: Record<string, string> = {
            new: 'new_tab', close: 'close_tab', back: 'back', forward: 'forward', reload: 'refresh',
        };
        const mapped = actionMap[String(args.action)] ?? String(args.action);
        const result = await sendBrowserAction(mapped, { url: args.url });
        if (!result.success) return { success: false, message: `Tab action failed: ${result.error}` };
        return { success: true, message: `✅ Tab: ${args.action}`, data: result.data };
    },
});


// Navigation aliases for convenience
registerTool({
    name: "browser_back",
    description: "Go back in browser history",
    category: "browser",
    parameters: {},
    handler: async (_): Promise<ToolResult> => {
        ensureBrowserOpen();
        const result = await sendBrowserAction("back", {});
        if (!result.success) return { success: false, message: `Back failed: ${result.error}` };
        return { success: true, message: `✅ Went back`, data: result.data };
    },
});

registerTool({
    name: "browser_forward",
    description: "Go forward in browser history",
    category: "browser",
    parameters: {},
    handler: async (_): Promise<ToolResult> => {
        ensureBrowserOpen();
        const result = await sendBrowserAction("forward", {});
        if (!result.success) return { success: false, message: `Forward failed: ${result.error}` };
        return { success: true, message: `✅ Went forward`, data: result.data };
    },
});

registerTool({
    name: "browser_refresh",
    description: "Refresh the current page",
    category: "browser",
    parameters: {},
    handler: async (_): Promise<ToolResult> => {
        ensureBrowserOpen();
        const result = await sendBrowserAction("refresh", {});
        if (!result.success) return { success: false, message: `Refresh failed: ${result.error}` };
        return { success: true, message: `✅ Page refreshed`, data: result.data };
    },
});

