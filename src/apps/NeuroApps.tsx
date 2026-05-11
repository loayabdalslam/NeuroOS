/**
 * NeuroApps - App store for AI-generated applications
 * Build, host, and run tiny apps created by the code agent
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Code2, Play, Pause, Trash2, Search, Plus, Clock,
    Tag, Copy, Check, X, ChevronRight, Sparkles, Globe,
    FolderOpen, RefreshCw, Layers, Eye, Pencil, Download
} from 'lucide-react';
import { cn } from '../lib/utils';
import { OSAppWindow } from '../hooks/useOS';
import { useNeuroAppsStore } from '../stores/neuroAppsStore';
import { codeAgent, GenerationResult } from '../lib/runtime/codeAgent';
import { NeuroApp } from '../lib/runtime/runtimeMachine';

interface NeuroAppsAppProps { windowData: OSAppWindow; }

type Tab = 'store' | 'build' | 'running' | 'explorer';
type RunMode = 'preview' | 'edit' | 'fullscreen';

const AppCard: React.FC<{
    app: NeuroApp;
    onRun: (id: string) => void;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    onCopy: (id: string) => void;
    dark: boolean;
}> = ({ app, onRun, onEdit, onDelete, onCopy, dark }) => {
    const [copied, setCopied] = useState(false);

    const copyCode = () => {
        const code = Object.values(app.code)[0] || '';
        navigator.clipboard.writeText(code);
        setCopied(true);
        onCopy(app.id);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "rounded-xl border overflow-hidden group",
                dark ? "bg-zinc-900 border-white/[0.08]" : "bg-white border-zinc-200"
            )}
        >
            {/* Preview area */}
            <div
                className={cn(
                    "h-32 relative flex items-center justify-center cursor-pointer",
                    dark ? "bg-zinc-800/50" : "bg-zinc-50"
                )}
                onClick={() => onRun(app.id)}
            >
                {app.type === 'html' && (
                    <div className="text-4xl opacity-30">🌐</div>
                )}
                {app.type === 'react' && (
                    <div className="text-4xl opacity-30">⚛️</div>
                )}
                {app.type === 'script' && (
                    <div className="text-4xl opacity-30">📜</div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                        onClick={(e) => { e.stopPropagation(); onRun(app.id); }}
                        className="p-2 rounded-full bg-white/90 shadow-lg text-emerald-600 hover:bg-white"
                    >
                        <Play size={16} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(app.id); }}
                        className="p-2 rounded-full bg-white/90 shadow-lg text-blue-600 hover:bg-white"
                    >
                        <Pencil size={16} />
                    </button>
                </div>
                <div className="absolute top-2 right-2">
                    <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium",
                        dark ? "bg-white/10 text-zinc-400" : "bg-black/5 text-zinc-500"
                    )}>
                        {app.type}
                    </span>
                </div>
            </div>

            {/* Info */}
            <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <h3 className={cn(
                            "text-sm font-medium truncate",
                            dark ? "text-zinc-200" : "text-zinc-800"
                        )}>{app.name}</h3>
                        <p className={cn(
                            "text-[10px] mt-0.5 line-clamp-2",
                            dark ? "text-zinc-500" : "text-zinc-500"
                        )}>{app.description}</p>
                    </div>
                </div>

                {/* Tags */}
                {app.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {app.tags.slice(0, 3).map(tag => (
                            <span
                                key={tag}
                                className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded",
                                    dark ? "bg-white/[0.06] text-zinc-500" : "bg-black/[0.04] text-zinc-500"
                                )}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Actions */}
                <div className={cn(
                    "flex items-center justify-between mt-3 pt-2.5 border-t",
                    dark ? "border-white/[0.06]" : "border-black/[0.06]"
                )}>
                    <div className={cn("text-[9px]", dark ? "text-zinc-600" : "text-zinc-400")}>
                        <Clock size={9} className="inline mr-0.5" />
                        {new Date(app.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={copyCode}
                            className={cn(
                                "p-1 rounded text-[10px]",
                                dark ? "hover:bg-white/[0.06] text-zinc-500" : "hover:bg-black/[0.04] text-zinc-400"
                            )}
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                        <button
                            onClick={() => onDelete(app.id)}
                            className={cn(
                                "p-1 rounded",
                                dark ? "hover:bg-white/[0.06] text-zinc-500 hover:text-rose-500" : "hover:bg-black/[0.04] text-zinc-400 hover:text-rose-500"
                            )}
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const AppRunner: React.FC<{
    app: NeuroApp;
    onClose: () => void;
    onIterate: (appId: string, feedback: string) => Promise<GenerationResult>;
    dark: boolean;
}> = ({ app, onClose, onIterate, dark }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [mode, setMode] = useState<RunMode>('preview');
    const [feedback, setFeedback] = useState('');
    const [iterating, setIterating] = useState(false);
    const [showIterate, setShowIterate] = useState(false);

    const code = Object.values(app.code)[0] || '';

    useEffect(() => {
        if (mode === 'preview' && iframeRef.current) {
            const blob = new Blob([code], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            iframeRef.current.src = url;
            return () => URL.revokeObjectURL(url);
        }
    }, [code, mode]);

    const handleIterate = async () => {
        if (!feedback.trim()) return;
        setIterating(true);
        try {
            const result = await onIterate(app.id, feedback);
            if (result.success) {
                setFeedback('');
                setShowIterate(false);
            }
        } finally {
            setIterating(false);
        }
    };

    return (
        <div className={cn(
            "fixed inset-0 z-50 flex flex-col",
            dark ? "bg-zinc-950" : "bg-zinc-50"
        )}>
            {/* Header */}
            <div className={cn(
                "flex items-center justify-between px-4 py-2 border-b shrink-0",
                dark ? "bg-zinc-900 border-white/[0.08]" : "bg-white border-black/[0.06]"
            )}>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{app.name}</span>
                    <div className="flex items-center gap-1">
                        {(['preview', 'edit', 'fullscreen'] as RunMode[]).map(m => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={cn(
                                    "px-2 py-1 text-[10px] rounded capitalize",
                                    mode === m
                                        ? (dark ? "bg-white/10 text-white" : "bg-black/10 text-black")
                                        : (dark ? "text-zinc-500 hover:text-zinc-300" : "text-zinc-500 hover:text-zinc-700")
                                )}
                            >
                                {m === 'fullscreen' ? <Globe size={11} className="inline mr-0.5" /> : null}
                                {m}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowIterate(!showIterate)}
                        className={cn(
                            "px-2 py-1 text-[10px] rounded flex items-center gap-1",
                            dark ? "text-zinc-400 hover:bg-white/[0.06]" : "text-zinc-600 hover:bg-black/[0.04]"
                        )}
                    >
                        <Sparkles size={11} />
                        Iterate
                    </button>
                    <button
                        onClick={onClose}
                        className={cn(
                            "p-1 rounded",
                            dark ? "text-zinc-500 hover:bg-white/[0.06]" : "text-zinc-500 hover:bg-black/[0.04]"
                        )}
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Iterate panel */}
            <AnimatePresence>
                {showIterate && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className={cn(
                            "p-3 border-b",
                            dark ? "bg-zinc-900 border-white/[0.08]" : "bg-white border-black/[0.06]"
                        )}>
                            <textarea
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                placeholder="Describe what you want to change..."
                                className={cn(
                                    "w-full p-2 rounded-lg text-xs resize-none h-20 focus:outline-none",
                                    dark ? "bg-white/[0.05] border-white/[0.08] text-zinc-300 placeholder:text-zinc-600" : "bg-black/[0.02] border-black/[0.06] text-zinc-700 placeholder:text-zinc-400"
                                )}
                            />
                            <div className="flex justify-end mt-2">
                                <button
                                    onClick={handleIterate}
                                    disabled={!feedback.trim() || iterating}
                                    className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500 text-white disabled:opacity-50 flex items-center gap-1"
                                >
                                    {iterating ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                    {iterating ? 'Generating...' : 'Apply Changes'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
                {mode === 'preview' && (
                    <div className="flex-1 p-4 flex items-center justify-center">
                        <div className={cn(
                            "w-full max-w-3xl h-full border rounded-xl overflow-hidden shadow-xl",
                            dark ? "bg-white border-white/20" : "bg-white border-zinc-200"
                        )}>
                            <iframe
                                ref={iframeRef}
                                className="w-full h-full"
                                sandbox="allow-scripts allow-same-origin"
                                title={app.name}
                            />
                        </div>
                    </div>
                )}

                {mode === 'edit' && (
                    <div className="flex-1 flex">
                        <div className={cn("flex-1 p-4", dark ? "bg-zinc-900" : "bg-white")}>
                            <textarea
                                value={code}
                                readOnly
                                className={cn(
                                    "w-full h-full p-4 rounded-lg text-xs font-mono resize-none focus:outline-none",
                                    dark ? "bg-zinc-950 text-zinc-300" : "bg-zinc-50 text-zinc-700"
                                )}
                            />
                        </div>
                        <div className="flex-1 p-4">
                            <div className={cn(
                                "h-full border rounded-xl overflow-hidden",
                                dark ? "bg-white" : "bg-zinc-50 border-zinc-200"
                            )}>
                                <iframe
                                    ref={iframeRef}
                                    className="w-full h-full"
                                    sandbox="allow-scripts allow-same-origin"
                                    title={app.name}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'fullscreen' && (
                    <div className="flex-1">
                        <iframe
                            ref={iframeRef}
                            className="w-full h-full"
                            sandbox="allow-scripts allow-same-origin"
                            title={app.name}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export const NeuroApps: React.FC<NeuroAppsAppProps> = ({ windowData }) => {
    const [tab, setTab] = useState<Tab>('store');
    const [search, setSearch] = useState('');
    const [runningApp, setRunningApp] = useState<NeuroApp | null>(null);
    const [buildPrompt, setBuildPrompt] = useState('');
    const [building, setBuilding] = useState(false);
    const [buildingLogs, setBuildingLogs] = useState<string[]>([]);

    const { apps, addApp, deleteApp, updateApp } = useNeuroAppsStore();

    const dark = false;

    const filteredApps = search
        ? apps.filter(a =>
            a.name.toLowerCase().includes(search.toLowerCase()) ||
            a.description.toLowerCase().includes(search.toLowerCase())
        )
        : apps;

    const handleBuild = async () => {
        if (!buildPrompt.trim()) return;
        setBuilding(true);
        setBuildingLogs([]);

        const agent = new (await import('../lib/runtime/codeAgent')).CodeAgent();

        try {
            const result = await agent.generateFromPrompt(buildPrompt);
            setBuildingLogs(agent.getLogs());

            if (result.success && result.app) {
                addApp(result.app);
                setBuildPrompt('');
                setTab('store');
                setRunningApp(result.app);
            }
        } catch (e: any) {
            setBuildingLogs(prev => [...prev, `Error: ${e.message}`]);
        } finally {
            setBuilding(false);
        }
    };

    const handleIterate = async (appId: string, feedback: string) => {
        const agent = new (await import('../lib/runtime/codeAgent')).CodeAgent();
        const result = await agent.iterateOnApp(appId, feedback);
        setBuildingLogs(agent.getLogs());

        if (result.success && result.app) {
            updateApp(appId, { code: result.app.code, lastRun: Date.now() });
        }

        return result;
    };

    return (
        <>
            {runningApp && (
                <AppRunner
                    app={runningApp}
                    onClose={() => setRunningApp(null)}
                    onIterate={handleIterate}
                    dark={dark}
                />
            )}

            <div className={cn("flex flex-col h-full", dark ? "bg-zinc-950 text-zinc-100" : "bg-white text-zinc-900")}>
                {/* Header */}
                <div className={cn("flex items-center justify-between px-5 py-3 border-b", dark ? "border-white/[0.08]" : "border-black/[0.06]")}>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-gradient-to-br from-emerald-500 to-cyan-500">
                            <Code2 size={12} className="text-white" />
                        </div>
                        <span className="text-sm font-medium">NeuroApps</span>
                        <span className={cn("text-[9px] uppercase tracking-wider", dark ? "text-zinc-600" : "text-zinc-400")}>runtime machine</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={12} className={cn("absolute left-2.5 top-1/2 -translate-y-1/2", dark ? "text-zinc-600" : "text-zinc-400")} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search apps..."
                                className={cn(
                                    "pl-8 pr-3 py-1.5 text-[11px] rounded-lg border w-48 focus:outline-none",
                                    dark ? "bg-white/[0.05] border-white/[0.08] text-zinc-300 placeholder:text-zinc-600 focus:border-white/[0.15]" : "bg-black/[0.02] border-black/[0.06] text-zinc-700 placeholder:text-zinc-400 focus:border-black/[0.12]"
                                )}
                            />
                        </div>
                        <button
                            onClick={() => setTab('build')}
                            className={cn(
                                "px-3 py-1.5 text-[11px] rounded-lg flex items-center gap-1.5 font-medium",
                                dark ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                            )}
                        >
                            <Plus size={12} />
                            Build
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className={cn("flex border-b", dark ? "border-white/[0.08]" : "border-black/[0.06]")}>
                    {([
                        { id: 'store', label: 'Store', icon: Layers },
                        { id: 'build', label: 'Build', icon: Sparkles },
                        { id: 'running', label: 'Running', icon: Play },
                        { id: 'explorer', label: 'Explorer', icon: FolderOpen },
                    ] as const).map(t => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-4 py-2.5 text-[11px] border-r transition-colors",
                                tab === t.id
                                    ? (dark ? "bg-white/[0.03] text-zinc-200 border-white/[0.08]" : "bg-zinc-50 text-zinc-800 border-black/[0.06]")
                                    : (dark ? "text-zinc-500 hover:text-zinc-300 border-transparent" : "text-zinc-500 hover:text-zinc-700 border-transparent")
                            )}
                        >
                            <t.icon size={12} />
                            {t.label}
                            {t.id === 'store' && apps.length > 0 && (
                                <span className={cn(
                                    "text-[9px] px-1 py-0.5 rounded-full",
                                    dark ? "bg-white/[0.1] text-zinc-400" : "bg-black/[0.06] text-zinc-500"
                                )}>{apps.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5">
                    {tab === 'store' && (
                        filteredApps.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full">
                                <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-4" style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                                    <Code2 size={24} className="opacity-20" />
                                </div>
                                <h3 className={cn("text-sm font-medium mb-1", dark ? "text-zinc-300" : "text-zinc-700")}>No apps yet</h3>
                                <p className={cn("text-xs text-center max-w-xs", dark ? "text-zinc-600" : "text-zinc-500")}>Build your first app using the AI code agent</p>
                                <button
                                    onClick={() => setTab('build')}
                                    className="mt-4 px-4 py-2 text-xs rounded-lg bg-emerald-500 text-white flex items-center gap-1.5"
                                >
                                    <Sparkles size={12} />
                                    Build an App
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredApps.map(app => (
                                    <AppCard
                                        key={app.id}
                                        app={app}
                                        onRun={(id) => { const a = apps.find(x => x.id === id); if (a) setRunningApp(a); }}
                                        onEdit={(id) => { const a = apps.find(x => x.id === id); if (a) setRunningApp(a); }}
                                        onDelete={deleteApp}
                                        onCopy={() => {}}
                                        dark={dark}
                                    />
                                ))}
                            </div>
                        )
                    )}

                    {tab === 'build' && (
                        <div className="max-w-2xl mx-auto">
                            <div className={cn(
                                "rounded-xl p-6 border",
                                dark ? "bg-zinc-900 border-white/[0.08]" : "bg-zinc-50 border-zinc-200"
                            )}>
                                <h2 className="text-lg font-medium mb-1">Build an App</h2>
                                <p className={cn("text-xs mb-4", dark ? "text-zinc-500" : "text-zinc-500")}>
                                    Describe the app you want to build. The AI will generate it for you.
                                </p>

                                <textarea
                                    value={buildPrompt}
                                    onChange={e => setBuildPrompt(e.target.value)}
                                    placeholder="Example: A productivity timer with customizable work/break intervals, a Pomodoro tracker, and stats dashboard"
                                    className={cn(
                                        "w-full p-3 rounded-lg text-sm resize-none h-32 focus:outline-none",
                                        dark ? "bg-white/[0.05] border-white/[0.08] text-zinc-300 placeholder:text-zinc-600 focus:border-white/[0.15]" : "bg-white border-zinc-200 text-zinc-700 placeholder:text-zinc-400 focus:border-zinc-300"
                                    )}
                                />

                                <div className="flex items-center justify-between mt-4">
                                    <div className="flex gap-2">
                                        {['Timer', 'Calculator', 'Todo App', 'Weather', 'Game'].map(template => (
                                            <button
                                                key={template}
                                                onClick={() => setBuildPrompt(`Build a ${template.toLowerCase()}`)}
                                                className={cn(
                                                    "px-2 py-1 text-[10px] rounded-md",
                                                    dark ? "bg-white/[0.05] text-zinc-500 hover:bg-white/[0.1]" : "bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                                                )}
                                            >
                                                {template}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleBuild}
                                        disabled={!buildPrompt.trim() || building}
                                        className="px-4 py-2 text-xs rounded-lg bg-emerald-500 text-white disabled:opacity-50 flex items-center gap-1.5"
                                    >
                                        {building ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                        {building ? 'Building...' : 'Build App'}
                                    </button>
                                </div>

                                {buildingLogs.length > 0 && (
                                    <div className={cn(
                                        "mt-4 p-3 rounded-lg font-mono text-[10px] max-h-40 overflow-y-auto",
                                        dark ? "bg-black/30 text-zinc-500" : "bg-black/5 text-zinc-600"
                                    )}>
                                        {buildingLogs.map((log, i) => (
                                            <div key={i}>{log}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === 'running' && (
                        <div className="flex flex-col items-center justify-center h-full">
                            <Play size={32} className="opacity-20 mb-3" />
                            <p className={cn("text-sm", dark ? "text-zinc-500" : "text-zinc-500")}>Select an app from the store to run it</p>
                        </div>
                    )}

                    {tab === 'explorer' && (
                        <div className="space-y-4">
                            <div className={cn(
                                "flex items-center gap-3 p-4 rounded-xl border",
                                dark ? "bg-zinc-900 border-white/[0.08]" : "bg-zinc-50 border-zinc-200"
                            )}>
                                <FolderOpen size={20} className="opacity-40" />
                                <div>
                                    <div className="text-sm font-medium">{apps.length} Apps</div>
                                    <div className="text-[10px] text-zinc-500">Total generated apps</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: 'HTML Apps', count: apps.filter(a => a.type === 'html').length, emoji: '🌐' },
                                    { label: 'React Apps', count: apps.filter(a => a.type === 'react').length, emoji: '⚛️' },
                                    { label: 'Scripts', count: apps.filter(a => a.type === 'script').length, emoji: '📜' },
                                ].map(stat => (
                                    <div
                                        key={stat.label}
                                        className={cn(
                                            "p-4 rounded-xl border text-center",
                                            dark ? "bg-zinc-900 border-white/[0.08]" : "bg-zinc-50 border-zinc-200"
                                        )}
                                    >
                                        <div className="text-2xl mb-1">{stat.emoji}</div>
     <div className="text-lg font-medium">{stat.count}</div>
                                        <div className="text-[10px] text-zinc-500">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};