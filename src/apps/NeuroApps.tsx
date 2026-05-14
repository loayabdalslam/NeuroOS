import React, { useEffect, useMemo, useState } from 'react';
import { Code2, ExternalLink, Globe, Library, Play, RefreshCw, Send, Share2, Sparkles } from 'lucide-react';
import { OSAppWindow } from '../hooks/useOS';
import { useNeuroAppsStore } from '../stores/neuroAppsStore';
import { codeAgent } from '../lib/runtime/codeAgent';
import { NeuroApp } from '../lib/runtime/runtimeMachine';
import { cn } from '../lib/utils';

interface NeuroAppsAppProps {
    windowData: OSAppWindow;
}

export const NeuroApps: React.FC<NeuroAppsAppProps> = () => {
    const {
        apps,
        addApp,
        updateApp,
        deleteApp,
        publishApp,
        publishedApps,
        refreshPublishedApps,
    } = useNeuroAppsStore();
    const [prompt, setPrompt] = useState('');
    const [logs, setLogs] = useState<string[]>([]);
    const [currentApp, setCurrentApp] = useState<NeuroApp | null>(apps[0] || null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [publishState, setPublishState] = useState<{ status: 'idle' | 'publishing'; shareUrl?: string; error?: string }>({ status: 'idle' });

    useEffect(() => {
        refreshPublishedApps();
    }, [refreshPublishedApps]);

    useEffect(() => {
        if (!currentApp) return;
        const entry = currentApp.manifest?.entry || Object.keys(currentApp.code)[0] || 'index.html';
        const source = currentApp.code[entry] || Object.values(currentApp.code)[0] || '';

        let html = source;
        if (currentApp.type === 'react') {
            html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><script src="https://cdn.tailwindcss.com"></script></head><body><div style="padding:24px;font-family:ui-sans-serif,system-ui;background:#f8fafc;color:#0f172a;"><pre style="white-space:pre-wrap;font-size:12px;line-height:1.5;">${source.replace(/</g, '&lt;')}</pre></div></body></html>`;
        }

        const blob = new Blob([html], { type: 'text/html' });
        const nextUrl = URL.createObjectURL(blob);
        setPreviewUrl(nextUrl);
        updateApp(currentApp.id, {
            lastRun: Date.now(),
            preview: {
                status: 'ready',
                url: nextUrl,
                lastBuiltAt: Date.now(),
            },
        });

        return () => URL.revokeObjectURL(nextUrl);
    }, [currentApp, updateApp]);

    const currentFiles = useMemo(
        () => currentApp?.files || Object.entries(currentApp?.code || {}).map(([path, content]) => ({ path, language: path.split('.').pop() || 'txt', size: content.length })),
        [currentApp]
    );

    const generateApp = async () => {
        if (!prompt.trim()) return;
        setBusy(true);
        setLogs(['Analyzing prompt...', 'Generating app spec...']);
        const result = await codeAgent.generateFromPrompt(prompt.trim());
        setLogs(result.logs);
        if (result.success && result.app) {
            addApp(result.app);
            setCurrentApp(result.app);
        }
        setBusy(false);
    };

    const iterateApp = async () => {
        if (!currentApp || !prompt.trim()) return;
        setBusy(true);
        setLogs(['Applying iteration feedback...']);
        const result = await codeAgent.iterateOnApp(currentApp.id, prompt.trim());
        setLogs(result.logs);
        if (result.success && result.app) {
            updateApp(currentApp.id, result.app);
            setCurrentApp(result.app);
        }
        setBusy(false);
    };

    const handlePublish = async () => {
        if (!currentApp) return;
        setPublishState({ status: 'publishing' });
        const result = await publishApp(currentApp.id);
        if (result.success) {
            setPublishState({ status: 'idle', shareUrl: result.shareUrl });
        } else {
            setPublishState({ status: 'idle', error: result.error });
        }
    };

    return (
        <div className="h-full bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(241,245,249,0.98))] p-4">
            <div className="h-full grid grid-cols-[280px_1.1fr_1fr] gap-4">
                <section className="rounded-[30px] border border-white/50 bg-white/55 backdrop-blur-[var(--shell-blur)] shadow-[var(--shell-shadow)] overflow-hidden">
                    <div className="p-4 border-b border-white/50">
                        <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-400 font-semibold">Library</div>
                        <div className="text-xl font-semibold tracking-tight text-zinc-900 mt-1">Builder projects</div>
                    </div>
                    <div className="p-3 space-y-2 overflow-y-auto h-[calc(100%-84px)]">
                        {apps.map((app) => (
                            <button
                                key={app.id}
                                onClick={() => setCurrentApp(app)}
                                className={cn(
                                    'w-full rounded-[24px] border px-4 py-4 text-left transition-all',
                                    currentApp?.id === app.id ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white/50 border-white/50 hover:bg-white/80'
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="font-semibold">{app.name}</div>
                                    <Code2 size={15} />
                                </div>
                                <div className={cn('text-xs mt-2', currentApp?.id === app.id ? 'text-zinc-300' : 'text-zinc-500')}>
                                    {app.description}
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="rounded-[30px] border border-white/50 bg-white/60 backdrop-blur-[var(--shell-blur)] shadow-[var(--shell-shadow)] flex flex-col overflow-hidden">
                    <div className="p-5 border-b border-white/50">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-400 font-semibold">Prompt to app</div>
                                <div className="text-2xl font-semibold tracking-tight text-zinc-900 mt-1">NeuroApps Builder</div>
                            </div>
                            <div className="rounded-2xl bg-white/70 border border-white/60 px-3 py-2 text-[11px] font-semibold text-zinc-500 flex items-center gap-2">
                                <Sparkles size={12} className="text-sky-500" />
                                Codex-ready
                            </div>
                        </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col gap-4 overflow-y-auto">
                        <div className="rounded-[28px] border border-white/60 bg-white/55 p-4">
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe the app you want to build or how to iterate on the current one."
                                className="w-full h-32 bg-transparent resize-none outline-none text-sm text-zinc-800 placeholder:text-zinc-400"
                            />
                            <div className="flex flex-wrap gap-3 mt-4">
                                <button onClick={generateApp} disabled={busy} className="rounded-2xl bg-zinc-900 text-white px-4 py-2.5 text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                                    <Send size={14} />
                                    Generate
                                </button>
                                <button onClick={iterateApp} disabled={busy || !currentApp} className="rounded-2xl bg-white border border-white/70 px-4 py-2.5 text-sm font-medium text-zinc-700 flex items-center gap-2 disabled:opacity-50">
                                    <RefreshCw size={14} />
                                    Iterate
                                </button>
                                <button onClick={handlePublish} disabled={!currentApp || publishState.status === 'publishing'} className="rounded-2xl bg-sky-600 text-white px-4 py-2.5 text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                                    <Share2 size={14} />
                                    {publishState.status === 'publishing' ? 'Publishing...' : 'Publish'}
                                </button>
                            </div>
                            {publishState.shareUrl && (
                                <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-700 flex items-center justify-between">
                                    <span>{publishState.shareUrl}</span>
                                    <button onClick={() => window.electron.browser.openExternal(publishState.shareUrl!)} className="font-medium">Open</button>
                                </div>
                            )}
                            {publishState.error && <div className="mt-4 text-sm text-rose-600">{publishState.error}</div>}
                        </div>

                        <div className="grid grid-cols-[220px_1fr] gap-4 min-h-[320px]">
                            <div className="rounded-[28px] border border-white/60 bg-white/55 p-4">
                                <div className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                                    <Library size={14} />
                                    Files
                                </div>
                                <div className="space-y-2">
                                    {currentFiles.map((file) => (
                                        <div key={file.path} className="rounded-2xl bg-white/65 border border-white/60 px-3 py-2">
                                            <div className="text-sm font-medium text-zinc-800">{file.path}</div>
                                            <div className="text-xs text-zinc-500">{file.language} • {file.size} chars</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-[28px] border border-white/60 bg-white/55 p-4 flex flex-col">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <div className="text-sm font-semibold text-zinc-900">Runtime preview</div>
                                        <div className="text-xs text-zinc-500">{currentApp?.preview?.status || 'idle'}</div>
                                    </div>
                                    {previewUrl && (
                                        <a href={previewUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-white/70 border border-white/60 px-3 py-2 text-xs font-medium text-zinc-700 flex items-center gap-2">
                                            <ExternalLink size={12} />
                                            Open
                                        </a>
                                    )}
                                </div>
                                <div className="flex-1 rounded-[24px] overflow-hidden border border-white/60 bg-white/80 min-h-[260px]">
                                    {previewUrl ? (
                                        <iframe src={previewUrl} className="w-full h-full border-0" title="NeuroApp preview" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-sm text-zinc-400">Generate an app to preview it here.</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[28px] border border-white/60 bg-white/55 p-4">
                            <div className="text-sm font-semibold text-zinc-900 mb-3">Build logs</div>
                            <div className="rounded-[22px] bg-zinc-950 text-zinc-200 p-4 text-xs leading-6 max-h-48 overflow-y-auto">
                                {logs.length === 0 ? 'No logs yet.' : logs.join('\n')}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-[30px] border border-white/50 bg-white/55 backdrop-blur-[var(--shell-blur)] shadow-[var(--shell-shadow)] overflow-hidden">
                    <div className="p-4 border-b border-white/50">
                        <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-400 font-semibold">Publish</div>
                        <div className="text-xl font-semibold tracking-tight text-zinc-900 mt-1">Shareable apps</div>
                    </div>
                    <div className="p-4 space-y-3 overflow-y-auto h-[calc(100%-84px)]">
                        {publishedApps.length === 0 && (
                            <div className="rounded-[24px] border border-dashed border-zinc-300 bg-white/40 p-5 text-sm text-zinc-500">
                                Published apps will appear here with share links and timestamps.
                            </div>
                        )}
                        {publishedApps.map((item: any) => (
                            <div key={item.id} className="rounded-[24px] border border-white/60 bg-white/45 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="font-semibold text-zinc-900">{item.name}</div>
                                    <Globe size={14} className="text-sky-500" />
                                </div>
                                <div className="text-xs text-zinc-500 mt-2">{item.shareUrl}</div>
                                <div className="mt-3 flex gap-2">
                                    <button onClick={() => window.electron.browser.openExternal(item.shareUrl)} className="rounded-2xl bg-zinc-900 text-white px-3 py-2 text-xs font-medium">
                                        Open link
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};
