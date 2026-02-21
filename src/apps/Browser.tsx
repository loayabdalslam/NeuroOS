import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    RotateCw,
    Home,
    Globe,
    Lock,
    ShieldCheck,
    MoreVertical,
    Share2,
    Link as LinkIcon,
    Plus,
    X,
    History,
    Terminal,
    Layout,
    Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { OSAppWindow, useOS } from '../hooks/useOS';
import { useAIStore } from '../stores/aiStore';

interface Tab {
    id: string;
    url: string;
    title: string;
    history: string[];
    historyIndex: number;
    isLoading: boolean;
}

interface BrowserProps {
    windowData: OSAppWindow;
}

export const BrowserApp: React.FC<BrowserProps> = ({ windowData }) => {
    const { updateWindow } = useOS();
    const { browserLogs, addBrowserLog, clearBrowserLogs } = useAIStore();

    const [tabs, setTabs] = useState<Tab[]>([
        {
            id: 'default',
            url: 'https://www.google.com/search?igu=1',
            title: 'Google',
            history: ['https://www.google.com/search?igu=1'],
            historyIndex: 0,
            isLoading: false
        }
    ]);
    const [activeTabId, setActiveTabId] = useState('default');
    const [inputValue, setInputValue] = useState(tabs[0].url);
    const [showSidebar, setShowSidebar] = useState<'history' | 'logs' | null>(null);

    const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Sync window title with active tab
    useEffect(() => {
        updateWindow(windowData.id, { title: `Browser - ${activeTab.title}` });
        setInputValue(activeTab.url);
    }, [activeTabId, activeTab.url, activeTab.title]);

    // Handle incoming actions (automation)
    useEffect(() => {
        const cleanup = (window as any).electron?.browser?.onFrameNavigate?.((url: string) => {
            // Ignore the initial dev server URL and data URLs
            if (url.startsWith('http://localhost:517') || url.startsWith('data:')) return;

            // Clean up title from URL
            const domain = url.split('/')[2]?.replace('www.', '') || '';
            const displayTitle = domain
                ? domain.charAt(0).toUpperCase() + domain.slice(1)
                : activeTab.title;

            // Update active tab URL and title
            updateTab(activeTabId, {
                url,
                title: displayTitle,
                // If it's a new navigation, add to history if it's not the same as current
                history: activeTab.url !== url ? [...activeTab.history, url] : activeTab.history,
                historyIndex: activeTab.url !== url ? activeTab.historyIndex + 1 : activeTab.historyIndex
            });

            // Sync the input value (address bar) immediately
            setInputValue(url);

            addBrowserLog({ type: 'info', message: `Iframe Navigated: ${url}`, tabId: activeTabId });
        });
        return () => cleanup?.();
    }, [activeTabId, activeTab.url, activeTab.title]);

    useEffect(() => {
        const cleanup = (window as any).electron?.browser?.onTitleUpdated?.((title: string) => {
            updateTab(activeTabId, { title });
        });
        return () => cleanup?.();
    }, [activeTabId]);

    useEffect(() => {
        if (windowData.lastAction) {
            const { type, payload } = windowData.lastAction;
            addBrowserLog({ type: 'action', message: `AI Triggered: ${type}`, tabId: activeTabId });

            if (type === 'navigate') {
                navigate(payload.url);
            } else if (type === 'back') {
                goBack();
            } else if (type === 'forward') {
                goForward();
            } else if (type === 'refresh') {
                refresh();
            } else if (type === 'new_tab') {
                createNewTab(payload.url || 'https://www.google.com/search?igu=1');
            } else if (type === 'close_tab') {
                closeTab(payload.id || activeTabId);
            } else if (type === 'browser_action') {
                addBrowserLog({
                    type: 'action',
                    message: `Executing: ${payload.action}${payload.selector ? ` on ${payload.selector}` : ''}`,
                    tabId: activeTabId
                });
            }
        }
    }, [windowData.lastAction]);

    const createNewTab = (newUrl = 'https://www.google.com/search?igu=1') => {
        const id = Math.random().toString(36).substring(7);
        const newTab: Tab = {
            id,
            url: newUrl,
            title: 'New Tab',
            history: [newUrl],
            historyIndex: 0,
            isLoading: true
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(id);
        addBrowserLog({ type: 'info', message: `Opened new tab: ${newUrl}`, tabId: id });
    };

    const closeTab = (id: string) => {
        if (tabs.length === 1) return;
        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);
        if (activeTabId === id) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
        }
        addBrowserLog({ type: 'info', message: `Closed tab: ${id}` });
    };

    const updateTab = (id: string, updates: Partial<Tab>) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    };

    const navigate = (newUrl: string) => {
        let finalUrl = newUrl;
        if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
            if (newUrl.includes('.') && !newUrl.includes(' ')) {
                finalUrl = `https://${newUrl}`;
            } else {
                finalUrl = `https://www.google.com/search?q=${encodeURIComponent(newUrl)}&igu=1`;
            }
        }

        const newHistory = activeTab.history.slice(0, activeTab.historyIndex + 1);
        newHistory.push(finalUrl);

        const domain = finalUrl.split('/')[2]?.replace('www.', '') || '';
        const displayTitle = domain
            ? domain.charAt(0).toUpperCase() + domain.slice(1)
            : 'New Tab';

        updateTab(activeTabId, {
            url: finalUrl,
            history: newHistory,
            historyIndex: newHistory.length - 1,
            isLoading: true,
            title: displayTitle
        });

        addBrowserLog({ type: 'info', message: `Navigating to: ${finalUrl}`, tabId: activeTabId });
    };

    const goBack = () => {
        if (activeTab.historyIndex > 0) {
            const newIndex = activeTab.historyIndex - 1;
            const prevUrl = activeTab.history[newIndex];
            updateTab(activeTabId, {
                historyIndex: newIndex,
                url: prevUrl,
                isLoading: true
            });
        }
    };

    const goForward = () => {
        if (activeTab.historyIndex < activeTab.history.length - 1) {
            const newIndex = activeTab.historyIndex + 1;
            const nextUrl = activeTab.history[newIndex];
            updateTab(activeTabId, {
                historyIndex: newIndex,
                url: nextUrl,
                isLoading: true
            });
        }
    };

    const refresh = () => {
        const currentUrl = activeTab.url;
        updateTab(activeTabId, { url: '', isLoading: true });
        setTimeout(() => updateTab(activeTabId, { url: currentUrl }), 10);
    };

    const [draggedTabId, setDraggedTabId] = useState<string | null>(null);

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
                        onDragOver={(e) => {
                            e.preventDefault();
                            onTabDragOver(tab.id);
                        }}
                        onDragEnd={() => setDraggedTabId(null)}
                        onClick={() => setActiveTabId(tab.id)}
                        className={cn(
                            "group relative flex items-center gap-2 px-3 py-1.5 min-w-[140px] max-w-[200px] rounded-t-xl cursor-pointer transition-all border-x border-t border-transparent",
                            activeTabId === tab.id
                                ? "bg-white border-zinc-200/50 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] z-10"
                                : "hover:bg-zinc-200/50 text-zinc-500"
                        )}
                    >
                        {tab.isLoading ? <RotateCw size={12} className="animate-spin text-sky-500" /> : <Globe size={12} className={activeTabId === tab.id ? "text-sky-500" : "text-zinc-400"} />}
                        <span className="text-[11px] font-medium truncate flex-1">{tab.title}</span>
                        {tabs.length > 1 && (
                            <button
                                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
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
                    onClick={() => createNewTab()}
                    className="p-1.5 hover:bg-zinc-200 rounded-lg text-zinc-500 transition-all ml-1"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Toolbar */}
            <div className="h-14 border-b border-zinc-200/50 bg-white flex items-center gap-3 px-4 shrink-0 shadow-sm z-30">
                <div className="flex items-center gap-1">
                    <button onClick={goBack} disabled={activeTab.historyIndex === 0} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 disabled:opacity-30 transition-all active:scale-90">
                        <ChevronLeft size={18} />
                    </button>
                    <button onClick={goForward} disabled={activeTab.historyIndex === activeTab.history.length - 1} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 disabled:opacity-30 transition-all active:scale-90">
                        <ChevronRight size={18} />
                    </button>
                    <button onClick={refresh} className={cn("p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-all", activeTab.isLoading && "animate-spin-once")}>
                        <RotateCw size={16} />
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
                    <div className="flex items-center gap-1.5 text-emerald-600">
                        {activeTab.url.startsWith('https') ? <Lock size={12} strokeWidth={2.5} /> : <Globe size={12} />}
                    </div>

                    <form className="flex-1 flex" onSubmit={(e) => { e.preventDefault(); navigate(inputValue); }}>
                        <input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full bg-transparent border-none text-[13px] font-medium text-zinc-700 p-0 focus:ring-0 placeholder:text-zinc-400"
                            placeholder="Type a URL or search..."
                        />
                    </form>

                    <div className="flex items-center gap-1">
                        <div draggable onDragStart={handleAddressBarDragStart} className="p-1 px-2 hover:bg-zinc-200/50 rounded-md text-zinc-400 hover:text-sky-500 transition-all cursor-grab active:cursor-grabbing flex items-center gap-1 group/dnd" title="Drag to Board">
                            <LinkIcon size={12} className="group-hover/dnd:rotate-45 transition-transform" />
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
                    <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-all">
                        <MoreVertical size={16} />
                    </button>
                </div>
            </div>

            {/* Main View Area */}
            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 relative bg-white">
                    <AnimatePresence>
                        {activeTab.isLoading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center flex-col gap-4"
                            >
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-10 h-10 border-2 border-sky-500 border-t-transparent rounded-full" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {tabs.map(tab => (
                        <div key={tab.id} className={cn("absolute inset-0", activeTabId === tab.id ? "block" : "hidden")}>
                            <iframe
                                src={tab.url}
                                className="w-full h-full border-0"
                                onLoad={() => updateTab(tab.id, { isLoading: false })}
                                title="Browser View"
                                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
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
                            className="border-l border-zinc-200/50 bg-zinc-50 flex flex-col overflow-hidden"
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
                                    activeTab.history.map((h, i) => (
                                        <button key={i} onClick={() => navigate(h)} className="text-left p-2 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all text-[11px] truncate group">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Clock size={10} className="text-zinc-400" />
                                                <span className="text-zinc-400">Step {i + 1}</span>
                                            </div>
                                            <span className="text-zinc-700 font-medium group-hover:text-sky-600 truncate block">{h}</span>
                                        </button>
                                    )).reverse()
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <button onClick={clearBrowserLogs} className="text-[9px] font-bold text-rose-500 hover:text-rose-600 uppercase tracking-wider mb-2 text-right">Clear Logs</button>
                                        {browserLogs.filter(l => l.tabId === activeTabId || !l.tabId).map((log, i) => (
                                            <div key={i} className="flex gap-2">
                                                <div className={cn(
                                                    "w-1 h-auto rounded-full mt-1 shrink-0",
                                                    log.type === 'action' ? "bg-purple-400" : log.type === 'error' ? "bg-rose-400" : "bg-emerald-400"
                                                )} />
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-medium text-zinc-700 leading-tight">{log.message}</p>
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
                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">AI-Guided Secure Sandbox</span>
                </div>
                <div className="text-[9px] font-medium text-zinc-400 flex items-center gap-4">
                    <span>{tabs.length} Tabs Open</span>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-emerald-400" />
                        <span>Ready</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
