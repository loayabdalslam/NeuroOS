import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Plus, X, Terminal as TerminalIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { OSAppWindow } from '../hooks/useOS';

interface TerminalProps {
    windowData?: OSAppWindow;
}

interface OutputLine {
    type: 'input' | 'output' | 'error' | 'system';
    text: string;
}

interface TabSession {
    id: string;
    title: string;
    cwd: string;
    history: OutputLine[];
    commandHistory: string[];
    historyIndex: number;
}

const stripAnsi = (str: string) => str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

const createSession = (cwd: string): TabSession => ({
    id: `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: 'Terminal',
    cwd,
    history: [{ type: 'system', text: 'NeuroOS Terminal — Type commands below.' }],
    commandHistory: [],
    historyIndex: -1,
});

export const TerminalApp: React.FC<TerminalProps> = ({ windowData }) => {
    const [tabs, setTabs] = useState<TabSession[]>([]);
    const [activeTabId, setActiveTabId] = useState<string>('');
    const [input, setInput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const initCwd = async () => {
            let cwd = '~';
            try {
                const home = await (window as any).electron?.fileSystem?.homeDir?.();
                if (home) cwd = home;
            } catch {}
            const session = createSession(cwd);
            setTabs([session]);
            setActiveTabId(session.id);
        };
        initCwd();
    }, []);

    const activeTab = tabs.find((t) => t.id === activeTabId);

    const updateActiveTab = useCallback((updater: (tab: TabSession) => TabSession) => {
        setTabs((prev) => prev.map((t) => (t.id === activeTabId ? updater(t) : t)));
    }, [activeTabId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [activeTab?.history.length]);

    useEffect(() => {
        if (windowData?.lastAction?.type === 'execute_command') {
            executeCommand(windowData.lastAction.payload);
        }
    }, [windowData?.lastAction]);

    const executeCommand = async (cmd: string) => {
        if (!cmd.trim() || !activeTab) return;

        updateActiveTab((tab) => ({
            ...tab,
            history: [...tab.history, { type: 'input', text: cmd }],
            commandHistory: [cmd, ...tab.commandHistory.filter((c) => c !== cmd)].slice(0, 100),
            historyIndex: -1,
        }));

        const trimmed = cmd.trim();

        if (trimmed === 'clear') {
            updateActiveTab((tab) => ({ ...tab, history: [] }));
            return;
        }

        if (trimmed === 'neuro --status') {
            updateActiveTab((tab) => ({
                ...tab,
                history: [
                    ...tab.history,
                    { type: 'input', text: cmd },
                    { type: 'system', text: `System: Online\nUptime: ${Math.floor(performance.now() / 60000)}m\nPlatform: ${navigator.platform}\nCores: ${navigator.hardwareConcurrency}` },
                ],
            }));
            return;
        }

        const electron = (window as any).electron;
        if (!electron?.shell?.exec) {
            updateActiveTab((tab) => ({
                ...tab,
                history: [...tab.history, { type: 'error', text: 'Shell not available (running in browser mode)' }],
            }));
            return;
        }

        setIsRunning(true);

        try {
            let cwd = activeTab.cwd;

            if (trimmed.startsWith('cd ')) {
                const target = trimmed.slice(3).trim().replace(/^["']|["']$/g, '');
                const result = await electron.shell.exec(
                    process.platform === 'win32'
                        ? `cd /d "${target}" && cd`
                        : `cd "${target}" && pwd`,
                    cwd
                );
                if (result.exitCode === 0) {
                    const newCwd = result.stdout.trim();
                    updateActiveTab((tab) => ({
                        ...tab,
                        cwd: newCwd,
                        history: [...tab.history, { type: 'output', text: newCwd }],
                    }));
                } else {
                    updateActiveTab((tab) => ({
                        ...tab,
                        history: [...tab.history, { type: 'error', text: result.stderr || `cd: no such directory: ${target}` }],
                    }));
                }
            } else {
                const result = await electron.shell.exec(trimmed, cwd);
                const stdout = stripAnsi(result.stdout || '').trim();
                const stderr = stripAnsi(result.stderr || '').trim();

                updateActiveTab((tab) => {
                    const lines = [...tab.history];
                    if (stdout) lines.push({ type: 'output', text: stdout });
                    if (stderr) lines.push({ type: 'error', text: stderr });
                    if (!stdout && !stderr && result.exitCode !== 0) {
                        lines.push({ type: 'error', text: `Process exited with code ${result.exitCode}` });
                    }
                    return { ...tab, history: lines };
                });
            }
        } catch (err: any) {
            updateActiveTab((tab) => ({
                ...tab,
                history: [...tab.history, { type: 'error', text: err.message || 'Command failed' }],
            }));
        }

        setIsRunning(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isRunning) {
            executeCommand(input);
            setInput('');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!activeTab) return;
            const newIndex = Math.min(activeTab.historyIndex + 1, activeTab.commandHistory.length - 1);
            if (newIndex >= 0 && activeTab.commandHistory[newIndex]) {
                setInput(activeTab.commandHistory[newIndex]);
                updateActiveTab((tab) => ({ ...tab, historyIndex: newIndex }));
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!activeTab) return;
            const newIndex = activeTab.historyIndex - 1;
            if (newIndex < 0) {
                setInput('');
                updateActiveTab((tab) => ({ ...tab, historyIndex: -1 }));
            } else {
                setInput(activeTab.commandHistory[newIndex]);
                updateActiveTab((tab) => ({ ...tab, historyIndex: newIndex }));
            }
        }
    };

    const addTab = async () => {
        let cwd = '~';
        try {
            const home = await (window as any).electron?.fileSystem?.homeDir?.();
            if (home) cwd = home;
        } catch {}
        const session = createSession(cwd);
        setTabs((prev) => [...prev, session]);
        setActiveTabId(session.id);
    };

    const closeTab = (id: string) => {
        setTabs((prev) => {
            const next = prev.filter((t) => t.id !== id);
            if (next.length === 0) return prev;
            if (activeTabId === id) setActiveTabId(next[next.length - 1].id);
            return next;
        });
    };

    const cwdDisplay = activeTab?.cwd.replace(/\\/g, '/').split('/').slice(-2).join('/') || '~';

    return (
        <div className="flex flex-col h-full bg-white text-zinc-700 font-mono text-sm" onClick={() => inputRef.current?.focus()}>
            {/* Tab bar */}
            <div className="flex items-center bg-zinc-50 border-b border-black/[0.06] shrink-0">
                <div className="flex-1 flex items-center overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTabId(tab.id)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-black/[0.04] min-w-0 shrink-0 group',
                                tab.id === activeTabId
                                    ? 'bg-white text-zinc-700'
                                    : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100/60'
                            )}
                        >
                            <TerminalIcon size={11} />
                            <span className="truncate max-w-[80px]">{tab.title}</span>
                            {tabs.length > 1 && (
                                <X
                                    size={11}
                                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                                    className="opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-opacity ml-1"
                                />
                            )}
                        </button>
                    ))}
                </div>
                <button onClick={addTab} className="p-1.5 text-zinc-400 hover:text-zinc-600 transition-colors mx-1">
                    <Plus size={13} />
                </button>
            </div>

            {/* Output area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-0.5 select-text">
                {activeTab?.history.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                        {line.type === 'input' ? (
                            <span>
                                <span className="text-emerald-600">neuro@os</span>
                                <span className="text-zinc-400">:</span>
                                <span className="text-sky-600">{cwdDisplay}</span>
                                <span className="text-zinc-400">$ </span>
                                <span className="text-zinc-800">{line.text}</span>
                            </span>
                        ) : line.type === 'error' ? (
                            <span className="text-rose-500">{line.text}</span>
                        ) : line.type === 'system' ? (
                            <span className="text-zinc-400">{line.text}</span>
                        ) : (
                            <span className="text-zinc-600">{line.text}</span>
                        )}
                    </div>
                ))}
                {isRunning && (
                    <div className="flex items-center gap-2 text-zinc-400">
                        <motion.div
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                            className="w-1.5 h-1.5 bg-emerald-500 rounded-full"
                        />
                        Running...
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="flex items-center gap-0 px-3 py-2 border-t border-black/[0.06] shrink-0">
                <span className="text-emerald-600">neuro@os</span>
                <span className="text-zinc-400">:</span>
                <span className="text-sky-600">{cwdDisplay}</span>
                <span className="text-zinc-400">$ </span>
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isRunning}
                    className="flex-1 bg-transparent border-none outline-none focus:ring-0 p-0 ml-1 text-zinc-800 placeholder:text-zinc-400 disabled:opacity-50"
                    placeholder={isRunning ? 'Running...' : ''}
                    autoFocus
                    spellCheck={false}
                />
            </div>
        </div>
    );
};
