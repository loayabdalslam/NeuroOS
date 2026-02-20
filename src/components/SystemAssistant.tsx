import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Command, Search, Monitor, Cpu, Battery, Wifi, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useOS } from '../hooks/useOS';
import { APPS_CONFIG } from '../lib/apps';
import { useAuthStore } from '../stores/authStore';

export const SystemAssistant: React.FC = () => {
    const { openApp, sendAppAction } = useOS();
    const { users, activeUserId } = useAuthStore();
    const user = users.find(u => u.id === activeUserId);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Keyboard shortcut (Ctrl+Space or Command+Space in a real OS, but here just UI toggle)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const filteredApps = Object.values(APPS_CONFIG).filter(app =>
        app.name.toLowerCase().includes(query.toLowerCase())
    );

    const handleLaunch = (appId: string) => {
        openApp(appId);
        setIsOpen(false);
        setQuery('');
    };

    const handleAskAI = () => {
        openApp('chat');
        if (query.trim()) {
            // Send the query to the chat app
            sendAppAction('chat', 'initial_query', query);
        }
        setIsOpen(false);
        setQuery('');
    };

    return (
        <>
            {/* Top Trigger Pill */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-[100] p-4 pointer-events-auto">
                <button
                    onClick={() => setIsOpen(true)}
                    className={cn(
                        "group relative flex items-center justify-center gap-2 px-6 py-2 rounded-full",
                        "bg-white/80 backdrop-blur-xl border border-white/20 shadow-lg shadow-blue-500/20",
                        "transition-all duration-300 ease-spring active:scale-95",
                        "hover:bg-white hover:shadow-blue-500/40 hover:w-auto",
                        isOpen ? "opacity-0 pointer-events-none scale-90" : "opacity-100 scale-100"
                    )}
                >
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/20 via-purple-400/20 to-blue-400/20 animate-pulse" />
                    <Sparkles size={16} className="text-blue-500 group-hover:rotate-12 transition-transform" />
                    <span className="text-sm font-medium text-zinc-800">Ask {user?.name || 'NeuroOS'}...</span>
                </button>
            </div>

            {/* Command Center Overlay */}
            <div
                className={cn(
                    "fixed inset-0 z-[101] bg-black/20 backdrop-blur-sm transition-opacity duration-300",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setIsOpen(false)}
            >
                <div
                    className={cn(
                        "absolute top-24 left-1/2 -translate-x-1/2 w-[600px] max-w-[90vw]",
                        "bg-white/90 backdrop-blur-2xl rounded-2xl shadow-2xl ring-1 ring-black/5",
                        "flex flex-col overflow-hidden transition-all duration-300 ease-spring",
                        isOpen ? "translate-y-0 scale-100 opacity-100" : "-translate-y-8 scale-95 opacity-0"
                    )}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Search Input */}
                    <div className="flex items-center gap-4 p-4 border-b border-black/5">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-violet-500 rounded-lg shadow-lg shadow-blue-500/20">
                            <Sparkles className="text-white" size={20} />
                        </div>
                        <input
                            ref={inputRef}
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    if (filteredApps.length > 0) handleLaunch(filteredApps[0].id);
                                    else handleAskAI();
                                }
                            }}
                            placeholder={`Ask ${user?.name || 'NeuroOS'} or search apps...`}
                            className="flex-1 bg-transparent text-xl font-light outline-none placeholder:text-zinc-400"
                        />
                        <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium px-2 py-1 bg-zinc-100 rounded-md">
                            <span className="pt-0.5">ESC</span>
                        </div>
                    </div>

                    {/* Results Area */}
                    <div className="p-2 max-h-[400px] overflow-y-auto">

                        {/* 1. App Results */}
                        {query && filteredApps.length > 0 && (
                            <div className="mb-2">
                                <div className="px-4 py-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">Applications</div>
                                {filteredApps.map(app => (
                                    <button
                                        key={app.id}
                                        onClick={() => handleLaunch(app.id)}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-black/5 transition-colors group text-left"
                                    >
                                        <div className={cn("p-2 rounded-lg text-white group-hover:scale-105 transition-transform", app.color)}>
                                            <app.icon size={18} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-zinc-900">{app.name}</div>
                                            <div className="text-xs text-zinc-500">Launch Application</div>
                                        </div>
                                        <ArrowRight size={16} className="text-zinc-300 group-hover:text-zinc-500 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* 2. AI Action Fallback */}
                        {query && (
                            <button
                                onClick={handleAskAI}
                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 transition-colors group text-left border border-transparent hover:border-blue-100"
                            >
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                    <Sparkles size={18} />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-blue-900">Ask Neuro AI</div>
                                    <div className="text-xs text-blue-600/70">"{query}"</div>
                                </div>
                            </button>
                        )}

                        {/* 3. System Quick Stats (Default state) */}
                        {!query && (
                            <div className="grid grid-cols-2 gap-2 p-2">
                                <div className="col-span-2 px-2 py-1">
                                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">System Control</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                                        <Battery size={18} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium">Power</div>
                                        <div className="text-xs text-zinc-500">Balanced</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-50 border border-zinc-100">
                                    <div className="p-2 bg-violet-100 text-violet-600 rounded-lg">
                                        <Wifi size={18} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium">Network</div>
                                        <div className="text-xs text-zinc-500">Online</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 bg-zinc-50/50 border-t border-black/5 flex items-center justify-between text-xs text-zinc-400">
                        <div className="flex gap-2">
                            <span className="font-medium text-zinc-500">NeuroOS AI</span>
                            <span>v2.1.0</span>
                        </div>
                        <div className="flex gap-2">
                            <span>Type to search apps</span>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
