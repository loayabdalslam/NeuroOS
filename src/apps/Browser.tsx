import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    RotateCw,
    Home,
    Globe,
    Lock,
    ShieldCheck,
    MoreVertical,
    Link as LinkIcon,
    Plus,
    X,
    History,
    Terminal,
    Clock,
    Download,
    Code2,
    RefreshCcw,
    StopCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { OSAppWindow, useOS } from '../hooks/useOS';
import { useAIStore } from '../stores/aiStore';

interface Tab {
    id: string;
    url: string;
    title: string;
    favicon?: string;
    isLoading: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
}

interface BrowserProps {
    windowData: OSAppWindow;
}

// Chrome 122 UA — matches main.ts spoofing to avoid webview detection
const NEURO_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const DEFAULT_HOME = 'https://www.bing.com'; // Bing works in webviews unlike Google

const normalizeUrl = (input: string): string => {
    const trimmed = input.trim();
    if (!trimmed) return DEFAULT_HOME;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.includes('.') && !trimmed.includes(' ')) return `https://${trimmed}`;
    // Use Bing search — Google blocks webview via igu/webhp params
    return `https://www.bing.com/search?q=${encodeURIComponent(trimmed)}`;
};

const extractDomain = (url: string): string => {
    try {
        const u = new URL(url);
        return u.hostname.replace('www.', '');
    } catch {
        return url.split('/')[2]?.replace('www.', '') || 'New Tab';
    }
};

const formatTitle = (title: string, url: string): string => {
    if (!title || title === 'about:blank' || title === 'Loading...') {
        const domain = extractDomain(url);
        return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
    return title;
};

export const BrowserApp: React.FC<BrowserProps> = ({ windowData }) => {
    const { updateWindow } = useOS();
    const { browserLogs, addBrowserLog, clearBrowserLogs } = useAIStore();

    const createTab = (url = DEFAULT_HOME, title = 'New Tab'): Tab => ({
        id: Math.random().toString(36).substring(7),
        url,
        title,
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
    });

    const [tabs, setTabs] = useState<Tab[]>([{ ...createTab(), id: 'default' }]);
    const [activeTabId, setActiveTabId] = useState('default');
    const [inputValue, setInputValue] = useState(DEFAULT_HOME);
    const [showSidebar, setShowSidebar] = useState<'history' | 'logs' | 'devtools' | null>(null);
    const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [urlHistory, setUrlHistory] = useState<string[]>([]);

    // Webview refs - one per tab
    const webviewRefs = useRef<Record<string, any>>({});

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
    const activeWebview = webviewRefs.current[activeTabId];

    const updateTab = (id: string, updates: Partial<Tab>) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    // Sync window title with active tab
    useEffect(() => {
        updateWindow(windowData.id, { title: `Browser - ${activeTab.title}` });
        if (!isInputFocused) {
            setInputValue(activeTab.url);
        }
    }, [activeTabId, activeTab.url, activeTab.title, isInputFocused]);

    // Handle incoming AI automation actions – full browser control engine
    useEffect(() => {
        if (!windowData.lastAction) return;
        const { type, payload } = windowData.lastAction;
        const requestId: string | undefined = payload?.__requestId;

        addBrowserLog({ type: 'action', message: `AI Action: ${type}`, tabId: activeTabId });

        const wv = webviewRefs.current[activeTabId];
        const ai = useAIStore.getState();

        const ok = (data: any) => {
            if (requestId) ai.resolveBrowserRequest(requestId, { success: true, data });
        };
        const fail = (error: string) => {
            if (requestId) ai.resolveBrowserRequest(requestId, { success: false, error });
        };

        // ── NAVIGATION ──────────────────────────────────────────────────────────
        if (type === 'navigate' && payload?.url) {
            navigateTo(activeTabId, normalizeUrl(payload.url));
            ok({ url: normalizeUrl(payload.url), status: 'navigating' });

        } else if (type === 'navigate_and_wait' && payload?.url) {
            if (!wv) { fail('No webview available'); return; }
            const url = normalizeUrl(payload.url);
            const timeout = payload.timeout ?? 15000;
            const cleanup = () => wv.removeEventListener('did-stop-loading', onLoad);
            const timer = setTimeout(() => { cleanup(); ok({ url: wv.src || url, title: wv.getTitle?.() || '', timedOut: true }); }, timeout);
            function onLoad() { cleanup(); clearTimeout(timer); ok({ url: wv.src || url, title: wv.getTitle?.() || '' }); }
            wv.addEventListener('did-stop-loading', onLoad);
            navigateTo(activeTabId, url);

            // ── SCRAPING ────────────────────────────────────────────────────────────
        } else if (type === 'scrape_page') {
            if (!wv) { fail('No webview available'); return; }
            const maxLen = payload?.maxLength ?? 6000;
            wv.executeJavaScript(`(function(){
    const title=document.title;
    const meta=document.querySelector('meta[name="description"]')?.content||'';
    const h1s=[...document.querySelectorAll('h1')].map(e=>e.innerText.trim()).filter(Boolean);
    const h2s=[...document.querySelectorAll('h2')].map(e=>e.innerText.trim()).filter(Boolean).slice(0,8);
    const links=[...document.querySelectorAll('a[href]')].map(a=>({text:a.innerText.trim().slice(0,80),href:a.href})).filter(l=>l.text&&l.href.startsWith('http')).slice(0,30);
    const candidates=[...document.querySelectorAll('article,main,[role="main"],.content,.post-body,.entry-content')];
    let el=candidates[0]||document.body;
    const clone=el.cloneNode(true);
    clone.querySelectorAll&&clone.querySelectorAll('nav,header,footer,script,style,aside,[class*="sidebar"],[class*="ad"],[class*="banner"]').forEach(e=>e.remove());
    const rawText=(clone.innerText||clone.textContent||'').replace(/\\s{3,}/g,'\\n\\n').trim().slice(0,${maxLen});
    return{title,meta,url:location.href,h1s,h2s,cleanText:rawText,links};
})()`).then(r => ok(r)).catch(e => fail(`Scrape error: ${e.message}`));

        } else if (type === 'get_html') {
            if (!wv) { fail('No webview'); return; }
            wv.executeJavaScript(`document.documentElement.outerHTML.slice(0,${payload?.limit ?? 50000})`)
                .then(html => ok({ html, url: wv.src })).catch(e => fail(e.message));

        } else if (type === 'get_links') {
            if (!wv) { fail('No webview'); return; }
            wv.executeJavaScript(`[...document.querySelectorAll('a[href]')].map(a=>({text:a.innerText.trim().slice(0,100),href:a.href,title:a.title})).filter(l=>l.href.startsWith('http')).slice(0,${payload?.limit ?? 50})`)
                .then(links => ok({ links, url: wv.src })).catch(e => fail(e.message));

        } else if (type === 'get_page_info') {
            if (!wv) { fail('No webview'); return; }
            wv.executeJavaScript(`({title:document.title,url:location.href,readyState:document.readyState,bodyLength:document.body?.innerText?.length||0})`)
                .then(info => ok({ ...(info as any), canGoBack: wv.canGoBack(), canGoForward: wv.canGoForward() }))
                .catch(e => fail(e.message));

            // ── INTERACTION ─────────────────────────────────────────────────────────
        } else if (type === 'click') {
            if (!wv) { fail('No webview'); return; }
            let script: string;
            const sel = payload?.selector;
            const txt = payload?.text;
            if (sel) {
                script = `(function(){const el=document.querySelector(${JSON.stringify(sel)});if(el){el.scrollIntoView({block:'center'});el.click();return{clicked:true,tag:el.tagName.toLowerCase(),text:el.innerText?.trim().slice(0,50)}}return{clicked:false,reason:'Not found: '+${JSON.stringify(sel)}}})()`;
            } else if (txt) {
                script = `(function(){const all=[...document.querySelectorAll('a,button,input[type="submit"],[role="button"]')];const el=all.find(e=>(e.innerText||e.value||'').toLowerCase().includes(${JSON.stringify(txt.toLowerCase())}));if(el){el.scrollIntoView({block:'center'});el.click();return{clicked:true,tag:el.tagName.toLowerCase(),text:(el.innerText||el.value||'').trim().slice(0,50)}}return{clicked:false,reason:'No match for text: '+${JSON.stringify(txt)}}})()`;
            } else if (payload?.x !== undefined) {
                script = `(function(){const el=document.elementFromPoint(${payload.x},${payload.y});if(el){el.click();return{clicked:true,tag:el.tagName.toLowerCase()}}return{clicked:false}})()`;
            } else { fail('click requires selector, text, or x/y'); return; }
            wv.executeJavaScript(script).then(r => { addBrowserLog({ type: 'info', message: `Click: ${JSON.stringify(r)}`, tabId: activeTabId }); ok(r); }).catch(e => fail(e.message));

        } else if (type === 'type') {
            if (!wv) { fail('No webview'); return; }
            const sel2 = payload?.selector || 'input[type="text"],input[type="search"],textarea,input:not([type="hidden"]):not([type="submit"])';
            const text = String(payload?.text ?? '');
            const clear = payload?.clear !== false;
            wv.executeJavaScript(`(function(){
    const el=document.querySelector(${JSON.stringify(sel2)});
    if(!el)return{typed:false,reason:'Not found'};
    el.focus();
    const niv=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')?.set||Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value')?.set;
    if(niv&&(el.tagName==='INPUT'||el.tagName==='TEXTAREA')){
        if(${clear})niv.call(el,'');
        niv.call(el,${JSON.stringify(clear ? text : '')});
        if(!${clear}){el.value+='';}
        niv.call(el,el.value+${JSON.stringify(clear ? '' : text)});
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
    } else {
        if(${clear})el.innerText='';
        el.innerText+=${JSON.stringify(text)};
        el.dispatchEvent(new Event('input',{bubbles:true}));
    }
    return{typed:true,tag:el.tagName.toLowerCase(),value:el.value||el.innerText}
})()`).then(r => { addBrowserLog({ type: 'info', message: `Typed: ${JSON.stringify(r)}`, tabId: activeTabId }); ok(r); }).catch(e => fail(e.message));

        } else if (type === 'submit') {
            if (!wv) { fail('No webview'); return; }
            wv.executeJavaScript(`(function(){const f=document.querySelector(${JSON.stringify(payload?.selector || 'form')});if(f){f.submit();return{submitted:true}}const b=document.querySelector('[type="submit"]');if(b){b.click();return{submitted:true,via:'button'}}return{submitted:false}})()`)
                .then(r => ok(r)).catch(e => fail(e.message));

        } else if (type === 'key_press') {
            if (!wv) { fail('No webview'); return; }
            const key = payload?.key ?? 'Return';
            wv.executeJavaScript(`(function(){const el=document.activeElement||document.body;['keydown','keypress','keyup'].forEach(t=>{el.dispatchEvent(new KeyboardEvent(t,{key:${JSON.stringify(key)},code:${JSON.stringify(key)},keyCode:13,bubbles:true,cancelable:true}))});return{pressed:${JSON.stringify(key)}}})()`).then(r => ok(r)).catch(e => fail(e.message));

        } else if (type === 'scroll') {
            if (!wv) { fail('No webview'); return; }
            wv.executeJavaScript(`window.scrollBy({left:${payload?.x ?? 0},top:${payload?.y ?? 0},behavior:'${payload?.behavior ?? 'smooth'}'});({scrollX:window.scrollX,scrollY:window.scrollY})`)
                .then(r => ok(r)).catch(e => fail(e.message));

        } else if (type === 'scroll_to') {
            if (!wv) { fail('No webview'); return; }
            wv.executeJavaScript(`(function(){const el=document.querySelector(${JSON.stringify(payload?.selector)});if(el){el.scrollIntoView({behavior:'smooth',block:'center'});return{found:true}}return{found:false}})()`)
                .then(r => ok(r)).catch(e => fail(e.message));

            // ── UTILITIES ─────────────────────────────────────────────────────────
        } else if (type === 'evaluate') {
            if (!wv) { fail('No webview'); return; }
            wv.executeJavaScript(payload?.code ?? 'null')
                .then(r => ok({ result: r })).catch(e => fail(`JS: ${e.message}`));

        } else if (type === 'wait_for_selector') {
            if (!wv) { fail('No webview'); return; }
            const wsel = payload?.selector;
            const timeout2 = payload?.timeout ?? 10000;
            wv.executeJavaScript(`new Promise((res,rej)=>{const start=Date.now();const f=()=>{const el=document.querySelector(${JSON.stringify(wsel)});if(el)res({found:true,tag:el.tagName.toLowerCase()});else if(Date.now()-start>${timeout2})rej(new Error('Timeout waiting for ${wsel}'));else setTimeout(f,200)};f()})`)
                .then(r => ok(r)).catch(e => fail(e.message));

        } else if (type === 'wait') {
            const ms = Math.min(payload?.ms ?? 1000, 30000);
            setTimeout(() => ok({ waited: ms }), ms);

            // ── LEGACY / TABS ─────────────────────────────────────────────────────
        } else if (type === 'back') {
            wv?.goBack(); ok({ navigated: 'back' });
        } else if (type === 'forward') {
            wv?.goForward(); ok({ navigated: 'forward' });
        } else if (type === 'refresh') {
            wv?.reload(); ok({ refreshed: true });
        } else if (type === 'new_tab') {
            addNewTab(payload?.url || 'https://www.google.com');
            ok({ status: 'tab opened' });
        } else if (type === 'close_tab') {
            closeTab(payload?.id || activeTabId);
            ok({ status: 'tab closed' });
        } else if (type === 'execute_js' && payload?.code) {
            wv?.executeJavaScript(payload.code)
                .then(result => { addBrowserLog({ type: 'info', message: `JS: ${JSON.stringify(result)}`, tabId: activeTabId }); ok({ result }); })
                .catch(err => { addBrowserLog({ type: 'error', message: `JS Error: ${err.message}`, tabId: activeTabId }); fail(err.message); });
        } else {
            if (requestId) fail(`Unknown action: ${type}`);
        }
    }, [windowData.lastAction]);

    const navigateTo = (tabId: string, url: string) => {
        const wv = webviewRefs.current[tabId];
        if (wv) {
            wv.src = url;
        }
        updateTab(tabId, { url, isLoading: true });
    };

    const navigate = (input: string) => {
        const url = normalizeUrl(input);
        setInputValue(url);
        navigateTo(activeTabId, url);
        addBrowserLog({ type: 'info', message: `Navigating to: ${url}`, tabId: activeTabId });
    };

    const addNewTab = (url = 'https://www.google.com/search?igu=1') => {
        const tab = createTab(url);
        setTabs(prev => [...prev, tab]);
        setActiveTabId(tab.id);
        setInputValue(url);
    };

    const closeTab = (id: string) => {
        if (tabs.length === 1) return;
        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);
        if (activeTabId === id) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
        }
        delete webviewRefs.current[id];
    };

    const goBack = () => activeWebview?.canGoBack() && activeWebview.goBack();
    const goForward = () => activeWebview?.canGoForward() && activeWebview.goForward();
    const reload = () => activeTab.isLoading ? activeWebview?.stop() : activeWebview?.reload();

    // Webview event wiring
    const wireWebviewEvents = (wv: any, tabId: string) => {
        if (!wv || (wv as any).__wired) return;
        (wv as any).__wired = true;

        wv.addEventListener('did-start-loading', () => {
            updateTab(tabId, { isLoading: true });
        });

        wv.addEventListener('did-stop-loading', () => {
            const title = formatTitle(wv.getTitle?.() || '', wv.src || '');
            const url = wv.src || '';
            updateTab(tabId, {
                isLoading: false,
                url,
                title,
                canGoBack: wv.canGoBack(),
                canGoForward: wv.canGoForward(),
            });
            if (tabId === activeTabId && !isInputFocused) {
                setInputValue(url);
            }
            // Add to global history
            setUrlHistory(prev => [url, ...prev.filter(u => u !== url)].slice(0, 100));
            addBrowserLog({ type: 'info', message: `Loaded: ${url} — "${title}"`, tabId });
        });

        wv.addEventListener('did-navigate', (event: any) => {
            const url = event.url;
            const title = formatTitle('', url);
            updateTab(tabId, { url, title, isLoading: true });
            if (tabId === activeTabId && !isInputFocused) {
                setInputValue(url);
            }
        });

        wv.addEventListener('did-navigate-in-page', (event: any) => {
            const url = event.url;
            updateTab(tabId, { url });
            if (tabId === activeTabId && !isInputFocused) {
                setInputValue(url);
            }
        });

        wv.addEventListener('page-title-updated', (event: any) => {
            const title = formatTitle(event.title, wv.src || '');
            updateTab(tabId, { title });
        });

        wv.addEventListener('page-favicon-updated', (event: any) => {
            if (event.favicons?.length > 0) {
                updateTab(tabId, { favicon: event.favicons[0] });
            }
        });

        wv.addEventListener('new-window', (event: any) => {
            // Open new windows in a new tab instead
            event.preventDefault?.();
            addNewTab(event.url);
        });

        wv.addEventListener('console-message', (event: any) => {
            if (event.level >= 2) { // Warnings and Errors only
                addBrowserLog({ type: event.level >= 3 ? 'error' : 'info', message: `[Console] ${event.message}`, tabId });
            }
        });
    };

    // Drag tab reordering
    const onTabDragStart = (e: React.DragEvent, id: string) => {
        setDraggedTabId(id);
        const tab = tabs.find(t => t.id === id);
        if (tab) {
            e.dataTransfer.setData('neuro/file', JSON.stringify({
                name: tab.title,
                path: tab.url,
                isDirectory: false,
                type: 'url',
                url: tab.url
            }));
            e.dataTransfer.effectAllowed = 'copyMove';
        }
    };

    const onTabDragOver = (id: string) => {
        if (!draggedTabId || draggedTabId === id) return;
        const oldIndex = tabs.findIndex(t => t.id === draggedTabId);
        const newIndex = tabs.findIndex(t => t.id === id);
        if (oldIndex === -1 || newIndex === -1) return;
        const newTabs = [...tabs];
        const [draggedItem] = newTabs.splice(oldIndex, 1);
        newTabs.splice(newIndex, 0, draggedItem);
        setTabs(newTabs);
    };

    const handleAddressBarDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('neuro/file', JSON.stringify({
            name: activeTab.title,
            path: activeTab.url,
            isDirectory: false,
            type: 'url',
            url: activeTab.url
        }));
    };

    return (
        <div className="flex flex-col h-full bg-zinc-50 select-none overflow-hidden font-sans">
            {/* Tab Strip */}
            <div className="h-10 bg-zinc-100/80 backdrop-blur-md border-b border-zinc-200/50 flex items-center px-2 gap-1 overflow-x-auto no-scrollbar pt-1.5 shadow-inner">
                {tabs.map(tab => (
                    <motion.div
                        key={tab.id}
                        layout
                        draggable
                        onDragStart={(e: any) => onTabDragStart(e, tab.id)}
                        onDragOver={(e: any) => { e.preventDefault(); onTabDragOver(tab.id); }}
                        onDragEnd={() => setDraggedTabId(null)}
                        onClick={() => { setActiveTabId(tab.id); setInputValue(tab.url); }}
                        className={cn(
                            "group relative flex items-center gap-2 px-3 py-1.5 min-w-[140px] max-w-[200px] rounded-t-xl cursor-pointer transition-all border-x border-t border-transparent",
                            activeTabId === tab.id
                                ? "bg-white border-zinc-200/50 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] z-10"
                                : "hover:bg-zinc-200/50 text-zinc-500"
                        )}
                    >
                        {tab.isLoading
                            ? <RotateCw size={12} className="animate-spin text-sky-500 shrink-0" />
                            : tab.favicon
                                ? <img src={tab.favicon} className="w-3 h-3 rounded-sm shrink-0 object-contain" alt="" onError={(e) => (e.currentTarget.style.display = 'none')} />
                                : <Globe size={12} className={cn("shrink-0", activeTabId === tab.id ? "text-sky-500" : "text-zinc-400")} />
                        }
                        <span className="text-[11px] font-medium truncate flex-1">{tab.title}</span>
                        {tabs.length > 1 && (
                            <button
                                onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
                                className="opacity-0 group-hover:opacity-100 hover:bg-zinc-200 rounded-md p-0.5 transition-all"
                            >
                                <X size={10} />
                            </button>
                        )}
                        {activeTabId === tab.id && (
                            <div className="absolute -bottom-[2px] left-0 right-0 h-[2px] bg-white z-20" />
                        )}
                    </motion.div>
                ))}
                <button
                    onClick={() => addNewTab()}
                    className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-500 transition-all ml-1 shrink-0"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Toolbar */}
            <div className="h-14 border-b border-zinc-200/50 bg-white flex items-center gap-3 px-4 shrink-0 shadow-sm z-30">
                <div className="flex items-center gap-1">
                    <button onClick={goBack} disabled={!activeTab.canGoBack} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 disabled:opacity-30 transition-all active:scale-90">
                        <ChevronLeft size={18} />
                    </button>
                    <button onClick={goForward} disabled={!activeTab.canGoForward} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 disabled:opacity-30 transition-all active:scale-90">
                        <ChevronRight size={18} />
                    </button>
                    <button onClick={reload} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-all">
                        {activeTab.isLoading ? <StopCircle size={16} className="text-rose-500" /> : <RotateCw size={16} />}
                    </button>
                    <button onClick={() => navigate('https://www.google.com/search?igu=1')} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-all active:scale-90">
                        <Home size={16} />
                    </button>
                </div>

                {/* Address Bar */}
                <div
                    draggable
                    onDragStart={handleAddressBarDragStart}
                    className="flex-1 flex items-center gap-2 px-4 py-1.5 bg-zinc-100/80 rounded-2xl border border-zinc-200/50 group focus-within:bg-white focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500/30 transition-all relative"
                >
                    <div className="flex items-center gap-1.5 text-emerald-600 shrink-0">
                        {activeTab.url.startsWith('https') ? <Lock size={12} strokeWidth={2.5} /> : <Globe size={12} />}
                    </div>
                    <form className="flex-1 flex" onSubmit={e => { e.preventDefault(); navigate(inputValue); }}>
                        <input
                            value={isInputFocused ? inputValue : activeTab.url}
                            onChange={e => setInputValue(e.target.value)}
                            onFocus={e => { setIsInputFocused(true); e.target.select(); }}
                            onBlur={() => { setIsInputFocused(false); setInputValue(activeTab.url); }}
                            className="w-full bg-transparent border-none text-[13px] font-medium text-zinc-700 p-0 focus:ring-0 placeholder:text-zinc-400"
                            placeholder="Type a URL or search..."
                        />
                    </form>
                    <div className="flex items-center gap-1 shrink-0">
                        <div
                            draggable
                            onDragStart={handleAddressBarDragStart}
                            className="p-1 px-2 hover:bg-zinc-200/50 rounded-md text-zinc-400 hover:text-sky-500 transition-all cursor-grab active:cursor-grabbing flex items-center gap-1"
                            title="Drag to Board"
                        >
                            <LinkIcon size={12} />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button onClick={() => setShowSidebar(showSidebar === 'history' ? null : 'history')} className={cn("p-2 hover:bg-zinc-100 rounded-lg transition-all", showSidebar === 'history' ? "text-sky-500 bg-sky-50" : "text-zinc-500")}>
                        <History size={16} />
                    </button>
                    <button onClick={() => setShowSidebar(showSidebar === 'logs' ? null : 'logs')} className={cn("p-2 hover:bg-zinc-100 rounded-lg transition-all", showSidebar === 'logs' ? "text-purple-500 bg-purple-50" : "text-zinc-500")}>
                        <Terminal size={16} />
                    </button>
                    <button
                        onClick={() => activeWebview?.openDevTools()}
                        className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-all"
                        title="Open DevTools"
                    >
                        <Code2 size={16} />
                    </button>
                </div>
            </div>

            {/* Main View */}
            <div className="flex-1 flex overflow-hidden relative">
                <div className="flex-1 relative bg-white">
                    <AnimatePresence>
                        {activeTab.isLoading && (
                            <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute top-0 left-0 right-0 h-[2px] bg-sky-500 z-20 origin-left"
                            />
                        )}
                    </AnimatePresence>

                    {/* Webview per tab - shown/hidden to avoid remounting */}
                    {tabs.map(tab => (
                        <div
                            key={tab.id}
                            className={cn("absolute inset-0", tab.id === activeTabId ? "block" : "hidden")}
                        >
                            <webview
                                ref={(el: any) => {
                                    if (el && !webviewRefs.current[tab.id]) {
                                        webviewRefs.current[tab.id] = el;
                                        wireWebviewEvents(el, tab.id);
                                    }
                                }}
                                src={tab.url}
                                useragent={NEURO_USER_AGENT}
                                allowpopups={true as any}
                                webpreferences="allowRunningInsecureContent, javascript=yes, images=yes, plugins=yes"
                                style={{ width: '100%', height: '100%', display: 'flex' }}
                            />
                        </div>
                    ))}
                </div>

                {/* Sidebar */}
                <AnimatePresence mode="wait">
                    {showSidebar && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 280, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="border-l border-zinc-200/50 bg-zinc-50 flex flex-col overflow-hidden shrink-0"
                        >
                            <div className="h-12 flex items-center justify-between px-4 border-b border-zinc-200/50 bg-white">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                                    {showSidebar === 'history' ? 'Browsing History' : 'Automation Logs'}
                                </span>
                                <button onClick={() => setShowSidebar(null)} className="p-1 hover:bg-zinc-100 rounded">
                                    <X size={14} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                                {showSidebar === 'history' ? (
                                    urlHistory.length > 0 ? urlHistory.map((url, i) => (
                                        <button key={i} onClick={() => navigate(url)} className="text-left p-2 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all text-[11px] truncate group">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Clock size={10} className="text-zinc-400 shrink-0" />
                                                <span className="text-zinc-400 text-[9px]">{extractDomain(url)}</span>
                                            </div>
                                            <span className="text-zinc-700 font-medium group-hover:text-sky-600 truncate block">{url}</span>
                                        </button>
                                    )) : (
                                        <div className="flex flex-col items-center justify-center py-12 text-zinc-300 gap-2">
                                            <History size={32} strokeWidth={1} />
                                            <span className="text-[10px] uppercase font-bold tracking-widest">No History Yet</span>
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <button onClick={clearBrowserLogs} className="text-[9px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider mb-2 text-right">Clear Logs</button>
                                        {browserLogs.filter(l => !l.tabId || l.tabId === activeTabId).map((log, i) => (
                                            <div key={i} className="flex gap-2">
                                                <div className={cn("w-1 h-auto rounded-full mt-1 shrink-0",
                                                    log.type === 'action' ? "bg-purple-400" : log.type === 'error' ? "bg-rose-400" : "bg-emerald-400"
                                                )} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-medium text-zinc-700 leading-tight break-all">{log.message}</p>
                                                    <span className="text-[8px] text-zinc-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {browserLogs.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 text-zinc-300 gap-2">
                                                <Terminal size={32} strokeWidth={1} />
                                                <span className="text-[10px] uppercase font-bold tracking-widest">No Logs Yet</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Status Bar */}
            <div className="h-6 bg-zinc-50 border-t border-zinc-200/50 flex items-center justify-between px-3 shrink-0">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={10} className="text-emerald-500" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Electron WebView • Full Control</span>
                </div>
                <div className="text-[9px] font-medium text-zinc-400 flex items-center gap-4">
                    <span>{tabs.length} Tab{tabs.length !== 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-1.5">
                        <div className={cn("w-1.5 h-1.5 rounded-full", activeTab.isLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-400")} />
                        <span>{activeTab.isLoading ? 'Loading...' : 'Ready'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
