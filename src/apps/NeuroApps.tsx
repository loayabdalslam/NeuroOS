/**
 * NeuroApps - Code Agent with Claude Code-style system prompt
 * Build, host, and run tiny apps with thinking and tool execution
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Code2, Play, Pause, Trash2, Search, Plus, Clock,
    Tag, Copy, Check, X, ChevronRight, Sparkles, Globe,
    FolderOpen, RefreshCw, Layers, Eye, Pencil, Download,
    Brain, Wrench, Send, Square, MessageSquare, SplitSquareHorizontal
} from 'lucide-react';
import { cn } from '../lib/utils';
import { OSAppWindow } from '../hooks/useOS';
import { useNeuroAppsStore } from '../stores/neuroAppsStore';
import { codeAgent, GenerationResult } from '../lib/runtime/codeAgent';
import { NeuroApp } from '../lib/runtime/runtimeMachine';
import Markdown from 'react-markdown';

interface NeuroAppsAppProps { windowData: OSAppWindow; }

// ─── Thinking Block ───────────────────────────────────────────────────────
interface ThinkBlock {
    id: string;
    type: 'thought' | 'tool_call' | 'tool_result' | 'error' | 'plan';
    content: string;
    tool?: string;
    duration?: number;
    timestamp: number;
}

// ─── Agent Message ─────────────────────────────────────────────────────────
interface AgentMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    thinking?: ThinkBlock[];
    timestamp: number;
    isStreaming?: boolean;
    code?: string;
}

// ─── Claude Code-style System Prompt ───────────────────────────────────────
const CLAUDE_CODE_SYSTEM_PROMPT = `You are an expert full-stack developer building small web applications. You have access to tools to create files, read files, run commands, and preview apps.

Your approach:
1. **Think deeply** before writing code - analyze the requirements
2. **Use tools** to create files and iterate on your work
3. **Preview often** to see results immediately
4. **Stay focused** - build small, complete, functional apps

═══ AVAILABLE TOOLS ═══

You have these tools available:

create_file(path, content) - Create a new file with the given content
update_file(path, content) - Overwrite a file with new content
append_file(path, content) - Append content to an existing file
read_file(path) - Read contents of a file
list_files(path) - List files in a directory
create_directory(path) - Create a directory

run_preview() - Preview the current app in an embedded window
stop_preview() - Stop the preview
iterate_app(feedback) - Iterate on the current app based on feedback

get_app_info() - Get information about the current app project
save_to_library() - Save the current app to the library
export_code(format) - Export code (html/react/node)

═══ PROJECT CONTEXT ═══

The user wants to build a small application. Ask clarifying questions if needed:
- What's the main purpose?
- Any specific features or interactions?
- Design style preferences?

Start by analyzing the request and creating a plan, then use tools to build.

═══ RESPONSE FORMAT ═══

When using tools, respond in JSON:
{"tool": "tool_name", "args": {"param": "value"}}

When explaining your thinking, write naturally.
When showing code, use proper formatting with backticks.
When done, summarize what you built and any next steps.`;

const MAX_ITER = 15;

export const NeuroApps: React.FC<NeuroAppsAppProps> = ({ windowData }) => {
    const [mode, setMode] = useState<'chat' | 'library'>('chat');
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [abort, setAbort] = useState<AbortController | null>(null);
    const [currentApp, setCurrentApp] = useState<NeuroApp | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(true);
    const [logs, setLogs] = useState<ThinkBlock[]>([]);

    const endRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const { apps, addApp, updateApp, deleteApp } = useNeuroAppsStore();

    const dark = false;

    // Auto-scroll
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, logs]);

    // Update preview when app changes
    useEffect(() => {
        if (currentApp && showPreview && iframeRef.current) {
            const code = Object.values(currentApp.code)[0] || '';
            const blob = new Blob([code], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
            iframeRef.current.src = url;
            return () => URL.revokeObjectURL(url);
        }
    }, [currentApp, showPreview]);

    const addLog = useCallback((type: ThinkBlock['type'], content: string, tool?: string) => {
        const log: ThinkBlock = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type,
            content,
            tool,
            timestamp: Date.now()
        };
        setLogs(prev => [...prev, log]);
        return log;
    }, []);

    const completeLog = useCallback((log: ThinkBlock) => {
        setLogs(prev => prev.map(l => l.id === log.id ? { ...l, duration: Date.now() - l.timestamp } : l));
    }, []);

    const handleToolCall = useCallback(async (tool: string, args: Record<string, any>): Promise<{ success: boolean; result: string }> => {
        const log = addLog('tool_call', `Executing: ${tool}`, tool);

        try {
            switch (tool) {
                case 'run_preview':
                    if (currentApp) {
                        setShowPreview(true);
                        completeLog(log);
                        return { success: true, result: 'Preview started' };
                    }
                    completeLog(log);
                    return { success: false, result: 'No app to preview' };

                case 'stop_preview':
                    setShowPreview(false);
                    completeLog(log);
                    return { success: true, result: 'Preview stopped' };

                case 'iterate_app': {
                    const feedback = args.feedback;
                    if (!currentApp) {
                        completeLog(log);
                        return { success: false, result: 'No app to iterate' };
                    }
                    const result = await codeAgent.iterateOnApp(currentApp.id, feedback);
                    if (result.success && result.app) {
                        setCurrentApp(result.app);
                        updateApp(currentApp.id, result.app);
                        completeLog(log);
                        return { success: true, result: 'App updated successfully' };
                    }
                    completeLog(log);
                    return { success: false, result: result.error || 'Iteration failed' };
                }

                case 'save_to_library': {
                    if (!currentApp) {
                        completeLog(log);
                        return { success: false, result: 'No app to save' };
                    }
                    addApp(currentApp);
                    completeLog(log);
                    return { success: true, result: `Saved "${currentApp.name}" to library` };
                }

                case 'export_code': {
                    if (!currentApp) {
                        completeLog(log);
                        return { success: false, result: 'No app to export' };
                    }
                    const code = Object.values(currentApp.code)[0] || '';
                    await navigator.clipboard.writeText(code);
                    completeLog(log);
                    return { success: true, result: 'Code copied to clipboard' };
                }

                case 'get_app_info': {
                    const info = currentApp
                        ? `Current App: ${currentApp.name}\nType: ${currentApp.type}\nDescription: ${currentApp.description}`
                        : 'No active project';
                    completeLog(log);
                    return { success: true, result: info };
                }

                default:
                    completeLog(log);
                    return { success: false, result: `Unknown tool: ${tool}` };
            }
        } catch (e: any) {
            addLog('error', `Error: ${e.message}`, tool);
            return { success: false, result: e.message };
        }
    }, [currentApp, addLog, completeLog, addApp, updateApp]);

    const runAgent = useCallback(async (userInput: string) => {
        const userMsg: AgentMessage = {
            id: `u-${Date.now()}`,
            role: 'user',
            content: userInput,
            timestamp: Date.now()
        };
        const aId = `a-${Date.now()}`;
        const assistantMsg: AgentMessage = {
            id: aId,
            role: 'assistant',
            content: '',
            thinking: [],
            timestamp: Date.now(),
            isStreaming: true
        };

        setMessages(prev => [...prev, userMsg, assistantMsg]);
        setStreaming(true);

        const ctrl = new AbortController();
        setAbort(ctrl);

        const thinkLog = addLog('thought', 'Analyzing your request...');
        let fullResponse = '';

        try {
            const llm = getLLMProvider();
            let iteration = 0;

            const sysMsg = CLAUDE_CODE_SYSTEM_PROMPT;
            const hist = messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
            const llmMsgs = [
                { role: 'system' as const, content: sysMsg },
                ...hist,
                { role: 'user' as const, content: userInput }
            ];

            while (iteration < MAX_ITER) {
                iteration++;
                let cur = '';

                if (iteration > 1) {
                    addLog('thought', `Iteration ${iteration}: Processing...`);
                }

                await llm.stream(llmMsgs, (chunk) => {
                    cur += chunk;
                    fullResponse += chunk;
                    setMessages(p => p.map(m => m.id === aId ? { ...m, content: cur } : m));
                }, ctrl.signal);

                completeLog(thinkLog);

                // Parse tool calls
                const toolCalls = parseToolCalls(cur);

                if (toolCalls.length === 0) {
                    // No more tools, finish
                    setMessages(p => p.map(m => m.id === aId ? { ...m, isStreaming: false } : m));
                    break;
                }

                llmMsgs.push({ role: 'assistant' as const, content: cur });

                // Execute tools
                for (const tc of toolCalls) {
                    const result = await handleToolCall(tc.tool, tc.args);
                    const toolMsg = result.success
                        ? `Tool ${tc.tool} succeeded: ${result.result}`
                        : `Tool ${tc.tool} failed: ${result.result}`;
                    llmMsgs.push({ role: 'user' as const, content: toolMsg });

                    if (tc.tool === 'iterate_app' && result.success) {
                        // Generate new code from iteration
                        const iterLog = addLog('thought', 'Generating updated code...');
                        let newCode = '';
                        await llm.stream(llmMsgs, (chunk) => {
                            newCode += chunk;
                        }, ctrl.signal);
                        completeLog(iterLog);
                    }
                }

                fullResponse = '';
            }

            setMessages(p => p.map(m => m.id === aId ? { ...m, isStreaming: false } : m));

        } catch (e: any) {
            if (e.name !== 'AbortError') {
                addLog('error', `Error: ${e.message}`);
            }
            setMessages(p => p.map(m => m.id === aId ? { ...m, isStreaming: false, content: `Error: ${e.message}` } : m));
        } finally {
            setStreaming(false);
            setAbort(null);
        }
    }, [messages, addLog, completeLog, handleToolCall]);

    // Simple tool call parser (matches Claude Code format)
    function parseToolCalls(text: string): Array<{ tool: string; args: Record<string, any> }> {
        const calls: Array<{ tool: string; args: Record<string, any> }> = [];

        // Match JSON tool calls
        const jsonRegex = /\{"tool":\s*"([^"]+)"[^}]*\}/g;
        let match;
        while ((match = jsonRegex.exec(text)) !== null) {
            try {
                const obj = JSON.parse(match[0]);
                if (obj.tool) {
                    calls.push({ tool: obj.tool, args: obj.args || {} });
                }
            } catch {}
        }

        // Match function-style calls: create_file("path", "content")
        const funcRegex = /(create_file|update_file|read_file|run_preview|iterate_app|save_to_library|export_code|get_app_info)\s*\(\s*(["'`])((?:[^\\]|\\.)*?)\2\s*(?:,\s*(["'`])(.*?)\4)?\s*\)/g;
        while ((match = funcRegex.exec(text)) !== null) {
            const tool = match[1];
            const arg1 = match[3];
            const arg2 = match[5];
            calls.push({
                tool,
                args: arg2 ? { path: arg1, content: arg2 } : { feedback: arg1 }
            });
        }

        return calls;
    }

    // LLM Provider mock (replace with actual)
    function getLLMProvider() {
        return {
            stream: async (msgs: any[], onChunk: (chunk: string) => void, signal?: AbortSignal) => {
                // This would call the actual LLM
                // For now, simulate a basic response
                const lastMsg = msgs[msgs.length - 1]?.content || '';
                const prompt = lastMsg.toLowerCase();

                // Simple keyword-based responses for demo
                if (prompt.includes('timer') || prompt.includes('pomodoro')) {
                    const code = `<!DOCTYPE html><html><head><style>body{font-family:system-ui;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:#fff}.timer{font-size:5rem;font-weight:bold}.controls{display:flex;gap:1rem;margin-top:2rem}button{padding:0.75rem 1.5rem;font-size:1rem;border:none;border-radius:8px;cursor:pointer;background:#4a4a6a;color:#fff}button:hover{background:#5a5a7a}.status{margin-top:1rem;font-size:1.5rem}</style></head><body><div class="timer" id="timer">25:00</div><div class="controls"><button onclick="start()">Start</button><button onclick="reset()">Reset</button></div><div class="status" id="status">Work</div><script>let time=25*60,run=false,work=true;function start(){run=!run;document.querySelector('button').textContent=run?'Pause':'Start'}function reset(){time=work?25*60:5*60;run=false;document.querySelector('button').textContent='Start';document.getElementById('timer').textContent=Math.floor(time/60)+':'+(time%60).toString().padStart(2,'0')}setInterval(()=>{if(run&&time>0){time--;document.getElementById('timer').textContent=Math.floor(time/60)+':'+(time%60).toString().padStart(2,'0')}else if(time===0&&run){work=!work;time=work?25*60:5*60;document.getElementById('status').textContent=work?'Work':'Break'}},1000)</script></body></html>`;
                    onChunk(`I've created a Pomodoro timer app for you!\n\n\`\`\`html\n${code.slice(0, 200)}...\n\`\`\`\n\nTool call: {"tool": "iterate_app", "args": {"feedback": "Apply this code"}}\n`);
                } else {
                    onChunk(`I understand you want to build something. Let me help you create an app.\n\nWhat type of app would you like?\n- Timer/Countdown\n- Todo list\n- Calculator\n- Weather widget\n- Game\n- Other\n\nJust describe what you want and I'll build it!`);
                }
            }
        };
    }

    const submit = useCallback((e?: React.FormEvent) => {
        e?.preventDefault?.();
        if (!input.trim() || streaming) return;
        runAgent(input.trim());
        setInput('');
    }, [input, streaming, runAgent]);

    const stop = useCallback(() => {
        abort?.abort();
        setStreaming(false);
    }, [abort]);

    const loadAppToEditor = useCallback((app: NeuroApp) => {
        setCurrentApp(app);
        setMode('chat');
        setMessages([{
            id: 'sys-' + Date.now(),
            role: 'assistant',
            content: `Loaded "${app.name}". What would you like to change?`,
            timestamp: Date.now()
        }]);
    }, []);

    return (
        <div className={cn("flex h-full", dark ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900")}>
            {/* Sidebar - Library */}
            <div className={cn(
                "w-64 border-r flex flex-col shrink-0",
                dark ? "bg-zinc-900 border-white/[0.08]" : "bg-white border-zinc-200"
            )}>
                <div className={cn("p-3 border-b", dark ? "border-white/[0.08]" : "border-zinc-200")}>
                    <h2 className="text-sm font-medium">App Library</h2>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{apps.length} apps saved</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {apps.length === 0 ? (
                        <div className={cn("text-[11px] text-center py-8", dark ? "text-zinc-600" : "text-zinc-400")}>
                            No apps yet.<br />Build one in the chat!
                        </div>
                    ) : apps.map(app => (
                        <button
                            key={app.id}
                            onClick={() => loadAppToEditor(app)}
                            className={cn(
                                "w-full text-left p-2 rounded-lg transition-colors",
                                dark ? "hover:bg-white/[0.05]" : "hover:bg-black/[0.03]"
                            )}
                        >
                            <div className="text-[11px] font-medium truncate">{app.name}</div>
                            <div className={cn("text-[9px] mt-0.5", dark ? "text-zinc-600" : "text-zinc-400")}>
                                {app.type} · {new Date(app.createdAt).toLocaleDateString()}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className={cn(
                    "flex items-center justify-between px-4 py-2 border-b shrink-0",
                    dark ? "bg-zinc-900 border-white/[0.08]" : "bg-white border-zinc-200"
                )}>
                    <div className="flex items-center gap-2">
                        <Code2 size={16} className="text-emerald-500" />
                        <span className="text-sm font-medium">Code Agent</span>
                        {currentApp && (
                            <span className={cn(
                                "text-[9px] px-2 py-0.5 rounded-full",
                                dark ? "bg-white/[0.1] text-zinc-400" : "bg-black/[0.05] text-zinc-500"
                            )}>
                                {currentApp.name}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className={cn(
                                "p-1.5 rounded-lg text-[10px] flex items-center gap-1",
                                dark ? "hover:bg-white/[0.05]" : "hover:bg-black/[0.04]"
                            )}
                        >
                            <SplitSquareHorizontal size={14} />
                            {showPreview ? 'Hide' : 'Show'} Preview
                        </button>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Messages */}
                    <div className={cn("flex-1 flex flex-col overflow-hidden", showPreview && currentApp ? "w-1/2" : "w-full")}>
                        {/* Logs */}
                        {logs.length > 0 && (
                            <div className={cn(
                                "border-b max-h-40 overflow-y-auto",
                                dark ? "border-white/[0.08] bg-black/20" : "border-zinc-200 bg-zinc-100/50"
                            )}>
                                <div className="p-2 space-y-1">
                                    {logs.slice(-10).map(log => (
                                        <div key={log.id} className="flex items-center gap-2 text-[10px]">
                                            {log.type === 'tool_call' && <Wrench size={10} className="text-emerald-500" />}
                                            {log.type === 'thought' && <Brain size={10} className="text-blue-500" />}
                                            {log.type === 'error' && <X size={10} className="text-red-500" />}
                                            <span className={dark ? "text-zinc-400" : "text-zinc-600"}>
                                                {log.content}
                                            </span>
                                            {log.duration && (
                                                <span className={cn("opacity-50", dark ? "text-zinc-600" : "text-zinc-400")}>
                                                    {log.duration}ms
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center">
                                    <div className={cn(
                                        "w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
                                        dark ? "bg-white/[0.05]" : "bg-black/[0.03]"
                                    )}>
                                        <Sparkles size={28} className="text-emerald-500 opacity-50" />
                                    </div>
                                    <h3 className="text-base font-medium mb-1">Code Agent Ready</h3>
                                    <p className="text-xs text-zinc-500 max-w-xs mb-6">
                                        Describe what you want to build. I'll create it with tools and let you preview it.
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                                        {[
                                            'Build a Pomodoro timer',
                                            'Create a todo list app',
                                            'Make a calculator',
                                            'Design a weather widget'
                                        ].map(suggestion => (
                                            <button
                                                key={suggestion}
                                                onClick={() => { setInput(suggestion); }}
                                                className={cn(
                                                    "text-left px-3 py-2 rounded-lg text-[11px] transition-colors",
                                                    dark ? "bg-white/[0.03] hover:bg-white/[0.06] text-zinc-400" : "bg-black/[0.02] hover:bg-black/[0.05] text-zinc-600"
                                                )}
                                            >
                                                {suggestion}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : messages.map(msg => (
                                <div key={msg.id} className={msg.role === 'user' ? "flex justify-end" : ""}>
                                    <div className={cn(
                                        "max-w-[85%] rounded-2xl px-4 py-3",
                                        msg.role === 'user'
                                            ? (dark ? "bg-emerald-500/20 text-emerald-100" : "bg-emerald-50 text-emerald-800")
                                            : (dark ? "bg-white/[0.05]" : "bg-white border border-zinc-200")
                                    )}>
                                        <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                                            <Markdown
                                                components={{
                                                    code: ({ children }) => (
                                                        <code className={cn(
                                                            "px-1.5 py-0.5 rounded text-[11px] font-mono",
                                                            dark ? "bg-black/30" : "bg-zinc-100"
                                                        )}>{children}</code>
                                                    ),
                                                    pre: ({ children }) => (
                                                        <pre className={cn(
                                                            "p-3 rounded-lg overflow-x-auto text-[11px] font-mono mt-2 mb-2",
                                                            dark ? "bg-black/40" : "bg-zinc-100"
                                                        )}>{children}</pre>
                                                    )
                                                }}
                                            >
                                                {msg.content}
                                            </Markdown>
                                        </div>
                                        {msg.isStreaming && (
                                            <motion.span
                                                animate={{ opacity: [1, 0] }}
                                                transition={{ duration: 0.8, repeat: Infinity }}
                                                className="inline-block w-1.5 h-3.5 ml-1 rounded-sm bg-emerald-500"
                                            />
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={endRef} />
                        </div>

                        {/* Input */}
                        <form onSubmit={submit} className={cn(
                            "p-4 border-t",
                            dark ? "border-white/[0.08] bg-zinc-900" : "border-zinc-200 bg-white"
                        )}>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    placeholder="Describe what you want to build..."
                                    disabled={streaming}
                                    className={cn(
                                        "flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none",
                                        dark
                                            ? "bg-white/[0.05] border-white/[0.08] text-zinc-100 placeholder:text-zinc-600 focus:border-white/[0.15]"
                                            : "bg-zinc-100 border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-300"
                                    )}
                                />
                                {streaming ? (
                                    <button
                                        type="button"
                                        onClick={stop}
                                        className="px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                    >
                                        <Square size={18} />
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={!input.trim()}
                                        className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white disabled:opacity-50 hover:bg-emerald-600"
                                    >
                                        <Send size={18} />
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>

                    {/* Preview */}
                    {showPreview && currentApp && (
                        <div className={cn(
                            "w-1/2 border-l flex flex-col",
                            dark ? "border-white/[0.08]" : "border-zinc-200"
                        )}>
                            <div className={cn(
                                "flex items-center justify-between px-3 py-2 border-b",
 dark ? "border-white/[0.08] bg-zinc-900" : "border-zinc-200 bg-zinc-50"
                            )}>
                                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                                    Preview
                                </span>
                                <div className="flex gap-1">
                                    <a
                                        href={previewUrl || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={cn(
                                            "p-1 rounded",
                                            dark ? "hover:bg-white/[0.05]" : "hover:bg-black/[0.04]"
                                        )}
                                    >
                                        <Globe size={12} />
                                    </a>
                                </div>
                            </div>
                            <div className="flex-1 bg-white">
                                <iframe
                                    ref={iframeRef}
                                    className="w-full h-full border-0"
                                    sandbox="allow-scripts allow-same-origin"
                                    title="App Preview"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};