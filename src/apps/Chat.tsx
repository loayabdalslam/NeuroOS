import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Send, BrainCircuit, User, Eraser, StopCircle, Loader2, Wrench, Globe,
    FileText, Terminal, Layers, Plus, CheckCircle2, XCircle, Sparkles,
    AlertTriangle, Info, Database, Cpu, Activity, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { showContextMenu } from '../components/ContextMenu';
import { useSettingsStore } from '../stores/settingsStore';
import { getLLMProvider } from '../lib/llm/factory';
import { useOS, OSAppWindow } from '../hooks/useOS';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useFileSystem } from '../hooks/useFileSystem';
import { useAIStore } from '../stores/aiStore';
import {
    parseToolCalls, executeTool, stripToolCalls,
    ToolContext, ToolResult, getAllTools
} from '../lib/ai';

interface ChatAppProps { windowData: OSAppWindow; }

// ── Types ─────────────────────────────────────────────────────────────────────

type StepKind = 'thinking' | 'streaming' | 'tool-call' | 'tool-success' | 'tool-error' | 'info' | 'error';

interface StepLog {
    id: number;
    kind: StepKind;
    /** Primary label shown in the step row */
    text: string;
    /** Body text that streams in (for thinking/reasoning steps) */
    body?: string;
    /** Collapsed extra detail (args, error message, etc.) */
    detail?: string;
    tool?: string;
}

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    isStreaming?: boolean;
    steps?: StepLog[];
}

const MAX_ITER = 12;

// ── Step Icon/Color Map ───────────────────────────────────────────────────────

const kindConfig: Record<StepKind, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
    thinking: { icon: Cpu, color: 'text-violet-500', bg: 'bg-violet-50', border: 'border-violet-200/50', label: 'Thinking' },
    streaming: { icon: Sparkles, color: 'text-sky-500', bg: 'bg-sky-50', border: 'border-sky-200/50', label: 'Reasoning' },
    'tool-call': { icon: Wrench, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200/50', label: 'Tool Call' },
    'tool-success': { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200/50', label: 'Done' },
    'tool-error': { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200/50', label: 'Failed' },
    info: { icon: Info, color: 'text-zinc-400', bg: 'bg-zinc-50', border: 'border-zinc-200/50', label: 'Info' },
    error: { icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200/50', label: 'Error' },
};

function getToolIcon(toolName: string): React.ElementType {
    const map: Record<string, React.ElementType> = {
        web_fetch: Globe, browser_scrape: Globe, web_research: Globe, search_web: Globe,
        browser_navigate: Globe, browser_save: FileText, browser_tab_control: Globe,
        open_app: Cpu, close_app: Cpu, list_running_apps: Cpu, send_notification: Cpu,
        read_file: FileText, write_file: FileText, list_files: FileText,
        run_shell: Terminal, exec_command: Terminal,
        query_db: Database, update_memory: Database, save_to_workspace: FileText
    };
    return map[toolName] || Wrench;
}

// ── StepItem ──────────────────────────────────────────────────────────────────

const StepItem: React.FC<{ step: StepLog; isLast: boolean }> = React.memo(({ step, isLast }) => {
    const [expanded, setExpanded] = useState(false);
    const cfg = kindConfig[step.kind];
    const Icon = step.tool ? getToolIcon(step.tool) : cfg.icon;
    const isActive = step.kind === 'thinking' || step.kind === 'streaming';
    const isToolCall = step.kind === 'tool-call';
    const hasBody = !!step.body && step.body.trim().length > 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="flex gap-2.5 items-start"
        >
            {/* Timeline column */}
            <div className="flex flex-col items-center shrink-0 pt-0.5" style={{ width: 26 }}>
                <div className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center border shrink-0',
                    cfg.bg, cfg.border
                )}>
                    {isActive
                        ? <Loader2 size={12} className={cn('animate-spin', cfg.color)} />
                        : <Icon size={12} className={cfg.color} />
                    }
                </div>
                {!isLast && <div className="w-px flex-1 bg-zinc-100 mt-1 mb-0.5 min-h-[10px]" />}
            </div>

            {/* Content */}
            <div className="flex-1 pb-2.5 min-w-0">
                {/* Header row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn('text-[9.5px] font-black uppercase tracking-widest', cfg.color)}>
                        {step.tool ? step.tool.replace(/_/g, ' ') : cfg.label}
                    </span>
                    {(isToolCall || step.kind === 'tool-error') && step.detail && (
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="text-[9px] text-zinc-400 hover:text-sky-600 underline underline-offset-2 transition-colors"
                        >
                            {expanded ? 'hide' : 'args'}
                        </button>
                    )}
                    {(step.kind === 'tool-success') && step.detail && (
                        <button
                            onClick={() => setExpanded(e => !e)}
                            className="text-[9px] text-zinc-400 hover:text-emerald-600 underline underline-offset-2 transition-colors"
                        >
                            {expanded ? 'hide' : 'data'}
                        </button>
                    )}
                </div>

                {/* Primary label */}
                <p className="text-[12px] text-zinc-600 leading-snug mt-0.5">{step.text}</p>

                {/* Streaming body — rendered in real-time */}
                {hasBody && (
                    <div className={cn(
                        "mt-1.5 text-[11.5px] text-zinc-500 leading-relaxed",
                        "bg-zinc-50/60 border border-zinc-100 rounded-xl px-3 py-2"
                    )}>
                        <Markdown>{step.body!}</Markdown>
                        {isActive && (
                            <motion.span
                                animate={{ opacity: [1, 0, 1] }}
                                transition={{ duration: 0.7, repeat: Infinity }}
                                className="inline-block w-[2px] h-[11px] bg-sky-400 ml-0.5 align-middle rounded-sm"
                            />
                        )}
                    </div>
                )}

                {/* Collapsed detail */}
                <AnimatePresence>
                    {expanded && step.detail && (
                        <motion.pre
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="mt-1.5 text-[10px] text-zinc-500 bg-zinc-50 border border-zinc-100 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap"
                        >
                            {step.detail}
                        </motion.pre>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
});
StepItem.displayName = 'StepItem';

// ── BrowserActivityPanel ──────────────────────────────────────────────────────
// Floating live log panel that shows browser action steps in real-time

const BrowserActivityPanel: React.FC = () => {
    const { browserLogs, clearBrowserLogs } = useAIStore();
    const [expanded, setExpanded] = useState(false);
    const logsRef = useRef<HTMLDivElement>(null);
    const prevLen = useRef(0);

    // Auto-expand when new logs arrive, auto-scroll inside
    useEffect(() => {
        if (browserLogs.length > prevLen.current) {
            prevLen.current = browserLogs.length;
            if (!expanded) setExpanded(true);
            setTimeout(() => {
                if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
            }, 30);
        }
    }, [browserLogs.length]);

    useEffect(() => {
        if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }, [expanded, browserLogs.length]);

    if (browserLogs.length === 0) return null;

    const recentLogs = browserLogs.slice(-60);
    const lastLog = recentLogs[recentLogs.length - 1];
    const isRunning = lastLog?.type === 'action';

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mb-2 rounded-2xl border border-sky-100 bg-sky-50/80 backdrop-blur-sm shadow-sm overflow-hidden"
        >
            {/* Header bar */}
            <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
                onClick={() => setExpanded(e => !e)}
            >
                <div className={cn(
                    'w-5 h-5 rounded-md flex items-center justify-center',
                    isRunning ? 'bg-sky-500' : 'bg-emerald-500'
                )}>
                    {isRunning
                        ? <Loader2 size={11} className="text-white animate-spin" />
                        : <Activity size={11} className="text-white" />
                    }
                </div>
                <span className="text-[10px] font-black tracking-widest uppercase text-sky-700 flex-1">
                    {isRunning ? 'Executing…' : 'Execution Log'}
                </span>
                <span className="text-[9px] text-sky-400 font-mono">{recentLogs.length} steps</span>
                <button
                    onClick={e => { e.stopPropagation(); clearBrowserLogs(); setExpanded(false); }}
                    className="p-0.5 hover:bg-sky-200/60 rounded text-sky-400 hover:text-rose-500 transition-colors"
                    title="Clear logs"
                >
                    <Trash2 size={10} />
                </button>
                {expanded ? <ChevronUp size={12} className="text-sky-400" /> : <ChevronDown size={12} className="text-sky-400" />}
            </div>

            {/* Log entries */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                    >
                        <div
                            ref={logsRef}
                            className="max-h-48 overflow-y-auto px-3 pb-2 space-y-0.5 border-t border-sky-100"
                        >
                            {recentLogs.map((log, i) => (
                                <div key={i} className={cn(
                                    'flex items-start gap-2 py-0.5 rounded',
                                )}>
                                    <span className={cn(
                                        'shrink-0 mt-[3px] text-[9px]',
                                        log.type === 'action' ? 'text-sky-500' :
                                            log.type === 'error' ? 'text-rose-500' : 'text-emerald-500'
                                    )}>
                                        {log.type === 'action' ? '⚙' : log.type === 'error' ? '✗' : '✓'}
                                    </span>
                                    <span className={cn(
                                        'text-[11px] leading-tight font-mono break-all',
                                        log.type === 'action' ? 'text-sky-700' :
                                            log.type === 'error' ? 'text-rose-600' : 'text-emerald-700'
                                    )}>
                                        {log.message.replace(/^[⚙✓✗]\s*/, '')}
                                    </span>
                                    <span className="ml-auto shrink-0 text-[9px] text-sky-300 font-mono tabular-nums">
                                        {new Date(log.timestamp).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ── Main Chat Component ───────────────────────────────────────────────────────

export const ChatApp: React.FC<ChatAppProps> = ({ windowData }) => {
    const { aiConfig } = useSettingsStore();
    const { openApp, closeWindow, appWindows, sendAppAction, focusWindow } = useOS();
    const { workspacePath } = useWorkspaceStore();
    const { writeFile, readFile, listFiles, createDir, deleteFile } = useFileSystem();

    const {
        sessions, currentSessionId, createSession, switchSession,
        addMessage: addPersistentMessage, memory, updateMemory
    } = useAIStore();

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [localMessages, setLocalMessages] = useState<Message[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const lastProcessedAction = useRef<number>(0);

    // Sync messages with session
    useEffect(() => {
        if (!currentSessionId) {
            const sid = createSession();
            switchSession(sid);
        } else {
            const session = sessions[currentSessionId];
            if (session) setLocalMessages(session.history as Message[]);
        }
    }, [currentSessionId, sessions]);

    // Build tool context
    const getToolContext = useCallback((): ToolContext => ({
        openApp: (id, name) => openApp(id, name),
        closeWindow: (id) => closeWindow(id),
        sendAppAction: (idOrComponent, type, payload) => sendAppAction(idOrComponent, type, payload),
        getAppWindows: () => useOS.getState().appWindows,
        appWindows,
        workspacePath,
        writeFile, readFile, listFiles, createDir, deleteFile,
        addMessage: (role, content) => setLocalMessages(prev => [...prev, { role, content, timestamp: Date.now() }]),
        updateMemory: (key, value) => updateMemory(key, value)
    }), [openApp, closeWindow, sendAppAction, appWindows, workspacePath,
        writeFile, readFile, listFiles, createDir, deleteFile, updateMemory]);

    // Auto-scroll to bottom
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 300;
        if (nearBottom || isLoading) el.scrollTop = el.scrollHeight;
    }, [localMessages, isLoading]);

    // ── Error classifier ───────────────────────────────────────────────────
    function classifyError(errMsg: string): string {
        if (/fetch|network|ERR_CONNECTION|ECONNREFUSED/i.test(errMsg))
            return '💡 Check that your AI provider is running and the URL in Settings is correct.';
        if (/401|403|unauthorized|forbidden/i.test(errMsg))
            return '💡 Invalid API key — update it in Settings.';
        if (/model/i.test(errMsg))
            return '💡 The selected model may not be available. Try switching in Settings.';
        if (/timeout/i.test(errMsg))
            return '💡 Request timed out — the server may be busy.';
        return '';
    }

    // ── handleSend ────────────────────────────────────────────────────────
    const handleSend = useCallback(async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
        addPersistentMessage('user', text);
        setLocalMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        const msgId = Date.now() + Math.random();
        const assistantMsg: Message = {
            role: 'assistant', content: '', timestamp: msgId,
            isStreaming: true, steps: []
        };
        setLocalMessages(prev => [...prev, assistantMsg]);

        const controller = new AbortController();
        setAbortController(controller);

        // ── Live log helper (feeds the universal ExecLog panel) ──
        const execLog = (type: 'info' | 'action' | 'error', message: string) => {
            useAIStore.getState().addBrowserLog({ type, message });
        };

        // ── Step management helpers ─────────────────────────
        let stepIdCounter = 0;

        const addStep = (kind: StepKind, text: string, opts?: { body?: string; detail?: string; tool?: string }): number => {
            const step: StepLog = { id: ++stepIdCounter, kind, text, ...opts };
            setLocalMessages(prev => prev.map(m =>
                m.timestamp === msgId
                    ? { ...m, steps: (m.steps || []).concat([step]) }
                    : m
            ));
            return step.id;
        };

        const patchStep = (id: number, patch: Partial<StepLog>) => {
            setLocalMessages(prev => prev.map(m =>
                m.timestamp === msgId
                    ? { ...m, steps: (m.steps || []).map(s => s.id === id ? { ...s, ...patch } : s) }
                    : m
            ));
        };

        /** Stream text chunk into message.content (the main bubble) in real-time */
        const streamToContent = (prose: string) => {
            setLocalMessages(prev => prev.map(m =>
                m.timestamp === msgId ? { ...m, content: prose } : m
            ));
        };

        /** Set final bubble — clears streaming flag */
        const setFinal = (content: string) => {
            setLocalMessages(prev => prev.map(m =>
                m.timestamp === msgId ? { ...m, content, isStreaming: false } : m
            ));
        };

        try {
            const llm = getLLMProvider();
            const toolContext = getToolContext();
            const workingMemory: Array<{ step: number; tool: string; args: any; success: boolean; message: string; data?: any }> = [];

            const memoryContext = Object.entries(memory).length > 0
                ? `LONG-TERM MEMORY:\n${JSON.stringify(memory, null, 2)}`
                : '';

            const toolList = getAllTools().map(t => {
                const params = Object.entries(t.parameters)
                    .map(([k, v]: [string, any]) => `"${k}": "${v.type}"${v.required !== false ? ' /*required*/' : ''}`)
                    .join(', ');
                return `• ${t.name}({${params}}) — ${t.description}`;
            }).join('\n');

            const systemPrompt = `You are Neuro AI — an intelligent OS assistant.
${memoryContext}

## HOW TO USE TOOLS
Emit exactly ONE tool call per response as a JSON fenced block:

\`\`\`json
{"tool": "tool_name", "args": {"param": "value"}}
\`\`\`

**Rules:**
- Always explain what you are doing BEFORE the JSON block
- Only emit ONE JSON block per response
- After a tool result, continue reasoning or call the next tool
- When all steps are done, respond naturally with NO JSON block
- If a tool fails, explain the failure then try a different approach

## AVAILABLE TOOLS
${toolList}

## KEY TOOL PATTERNS
To scrape a website:
1. Use \`web_fetch\` with the URL to get content immediately
2. Use \`browser_scrape\` to also show it in the browser UI

To search + scrape:
1. Use \`search_web\` → it returns result links
2. Use \`web_fetch\` on one of those links
3. Use \`browser_save\` to save the result

To save data to workspace:
- Use \`browser_save\` with filename + content
- Or use \`save_to_workspace\` for general files`;

            const conversation: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
                { role: 'system', content: systemPrompt },
                ...localMessages
                    .filter(m => !m.isStreaming && m.role !== 'system' && m.content.trim())
                    .slice(-20)
                    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
                { role: 'user', content: text }
            ];

            let consecutiveErrors = 0;

            execLog('info', `▶ Starting: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`);

            for (let iteration = 0; iteration < MAX_ITER; iteration++) {
                let fullContent = '';

                // ── Live step for this generation pass ──────────────────
                const genStepId = addStep(
                    iteration === 0 ? 'thinking' : 'streaming',
                    iteration === 0 ? 'Processing your request…' : `Iteration ${iteration + 1}: Continuing…`
                );

                if (iteration === 0) {
                    execLog('action', `🧠 AI thinking…`);
                } else {
                    execLog('action', `🔄 Iteration ${iteration + 1}: AI reasoning…`);
                }

                if (llm.stream) {
                    await llm.stream(conversation, (chunk: string) => {
                        fullContent += chunk;
                        // Strip JSON blocks from what we show live in the bubble
                        const toolCalls = parseToolCalls(fullContent);
                        const prose = stripToolCalls(fullContent, toolCalls).trim();
                        // Stream prose DIRECTLY into message.content (main bubble) in real time
                        if (prose) streamToContent(prose);
                    }, controller.signal);
                } else {
                    const response = await llm.chat(conversation);
                    fullContent = response.content;
                }

                const toolCalls = parseToolCalls(fullContent);
                const visibleProse = stripToolCalls(fullContent, toolCalls).trim();

                // ── No tool call → FINAL ANSWER ──────────────────────────
                if (toolCalls.length === 0) {
                    if (visibleProse) {
                        patchStep(genStepId, {
                            kind: 'info',
                            text: `Responded with ${visibleProse.split(' ').length} words`,
                            body: undefined
                        });
                        setFinal(visibleProse);
                        addPersistentMessage('assistant', visibleProse);
                        execLog('info', `✅ Response complete (${visibleProse.split(' ').length} words)`);
                    } else {
                        patchStep(genStepId, { kind: 'info', text: 'Done (no text output)' });
                        setFinal('*(no response)*');
                        execLog('info', '✅ Done (no text output)');
                    }
                    break;
                }

                // ── There's a tool call ───────────────────────────────────
                // Update the gen step to show what the AI said before the tool call
                patchStep(genStepId, {
                    kind: visibleProse ? 'streaming' : 'info',
                    text: visibleProse
                        ? visibleProse.slice(0, 100) + (visibleProse.length > 100 ? '…' : '')
                        : 'Calling tool…',
                    body: undefined
                });

                // While a tool is executing, clear the streaming content so
                // the user sees the step timeline (not stale text)
                streamToContent('');

                const call = toolCalls[0];

                // ── Log tool call start ───────────────────────────────────
                execLog('action', `⚙ ${call.tool.replace(/_/g, ' ')} — ${JSON.stringify(call.args).slice(0, 80)}`);

                const toolStepId = addStep('tool-call', `Calling ${call.tool.replace(/_/g, ' ')}…`, {
                    tool: call.tool,
                    detail: JSON.stringify(call.args, null, 2)
                });

                let result: ToolResult;
                const t0 = Date.now();
                try {
                    result = await executeTool(call, toolContext);
                } catch (toolErr: any) {
                    result = { success: false, message: `Tool exception: ${toolErr?.message ?? toolErr}` };
                }
                const elapsed = Date.now() - t0;

                if (result.success) {
                    consecutiveErrors = 0;
                    patchStep(toolStepId, {
                        kind: 'tool-success',
                        text: result.message.slice(0, 120) + (result.message.length > 120 ? '…' : ''),
                        detail: result.data ? JSON.stringify(result.data, null, 2).slice(0, 1200) : undefined
                    });
                    execLog('info', `✓ ${call.tool.replace(/_/g, ' ')} → ${result.message.slice(0, 80)} (${elapsed}ms)`);
                } else {
                    consecutiveErrors++;
                    patchStep(toolStepId, {
                        kind: 'tool-error',
                        text: result.message.slice(0, 120) + (result.message.length > 120 ? '…' : ''),
                        detail: result.message
                    });
                    execLog('error', `✗ ${call.tool.replace(/_/g, ' ')} → ${result.message.slice(0, 80)}`);

                    if (consecutiveErrors >= 3) {
                        addStep('error', `Stopped after ${consecutiveErrors} consecutive tool failures.`);
                        setFinal(`⚠️ I encountered repeated errors and stopped.\n\nLast error:\n> ${result.message}`);
                        addPersistentMessage('assistant', `I encountered repeated errors: ${result.message}`);
                        execLog('error', `⛔ Stopped: ${consecutiveErrors} consecutive failures`);
                        break;
                    }
                }

                workingMemory.push({
                    step: iteration + 1, tool: call.tool, args: call.args,
                    success: result.success, message: result.message, data: result.data
                });

                const memSummary = workingMemory
                    .map(m => `[Step ${m.step}] ${m.tool}(${JSON.stringify(m.args)}) → ${m.success ? '✅' : '❌'} ${m.message}`)
                    .join('\n');

                conversation.push({ role: 'assistant', content: fullContent });
                conversation.push({
                    role: 'user',
                    content: [
                        `Tool result for **${call.tool}**:`,
                        result.success ? `✅ ${result.message}` : `❌ FAILED: ${result.message}`,
                        result.data?.content
                            ? `\nContent:\n${result.data.content.slice(0, 4000)}`
                            : result.data
                                ? `\nData: ${JSON.stringify(result.data).slice(0, 1000)}`
                                : '',
                        '',
                        `Steps so far:\n${memSummary}`,
                        '',
                        result.success
                            ? 'Continue to the next step, or if done respond naturally without a JSON block.'
                            : 'That tool failed. Try a different approach or explain what went wrong.'
                    ].filter(Boolean).join('\n')
                });
            }

        } catch (error: any) {
            if (error.name === 'AbortError') {
                setLocalMessages(prev => prev.map(m =>
                    m.timestamp === msgId ? { ...m, content: m.content || '*(stopped)*', isStreaming: false } : m
                ));
                execLog('info', '⏹ Stopped by user');
            } else {
                const errMsg = error?.message ?? 'Unknown error';
                const hint = classifyError(errMsg);
                setFinal(`⚠️ **Error:** ${errMsg}${hint ? `\n\n${hint}` : ''}`);
                execLog('error', `⚠ Error: ${errMsg}`);
            }
        } finally {
            setIsLoading(false);
            setAbortController(null);
            setLocalMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
        }
    }, [isLoading, localMessages, getToolContext, currentSessionId, memory, addPersistentMessage]);

    // External action handler (e.g. from Browser "Ask AI" button)
    useEffect(() => {
        if (windowData.lastAction) {
            const { type, payload, timestamp } = windowData.lastAction;
            if (timestamp > lastProcessedAction.current) {
                lastProcessedAction.current = timestamp;
                if (type === 'initial_query' && typeof payload === 'string') {
                    handleSend(payload);
                }
            }
        }
    }, [windowData.lastAction, handleSend]);

    const handleStop = () => {
        abortController?.abort();
        setIsLoading(false);
        setLocalMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
    };

    const handleClear = () => {
        const sid = createSession();
        switchSession(sid);
    };

    // ── Render ───────────────────────────────────────────────────────────
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col h-full bg-white font-sans text-zinc-900"
        >
            {/* Header */}
            <div className="h-12 border-b border-zinc-100 flex items-center justify-between px-4 bg-white/80 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
                        <BrainCircuit size={16} className="text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400">Neuro OS</span>
                            <span className={cn(
                                "w-1.5 h-1.5 rounded-full transition-colors duration-300",
                                isLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-500"
                            )} />
                        </div>
                        <div
                            className="flex items-center gap-1 group cursor-pointer"
                            onClick={(e) => {
                                const slist = Object.values(sessions).sort((a, b) => b.lastActive - a.lastActive);
                                showContextMenu(e.clientX, e.clientY, slist.map(s => ({
                                    label: `Session ${s.id.slice(0, 8)}…`,
                                    icon: Layers,
                                    action: () => switchSession(s.id),
                                    active: s.id === currentSessionId
                                })));
                            }}
                        >
                            <span className="text-xs font-bold text-zinc-600">Active Session</span>
                            <Layers size={10} className="text-zinc-400 group-hover:text-sky-500 ml-1" />
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => createSession()} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-sky-600 transition-colors" title="New Session">
                        <Plus size={16} />
                    </button>
                    <button onClick={handleClear} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-rose-500 transition-colors" title="Clear">
                        <Eraser size={16} />
                    </button>
                </div>
            </div>

            {/* Live Browser Activity Panel */}
            <BrowserActivityPanel />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
                {localMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-200 space-y-4 py-20">
                        <div className="p-10 rounded-full bg-zinc-50 border border-zinc-100/50 relative">
                            <BrainCircuit size={64} strokeWidth={0.5} />
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 4, repeat: Infinity }}
                                className="absolute inset-0 bg-sky-500/10 rounded-full blur-3xl -z-10"
                            />
                        </div>
                        <div className="text-center">
                            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Neural Core Initialized</h3>
                            <p className="text-[11px] text-zinc-400 mt-1 max-w-[220px]">Awaiting your command…</p>
                        </div>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {localMessages.map((msg) => (
                        <motion.div
                            key={msg.timestamp}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className={cn("flex gap-3 max-w-3xl mx-auto", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}
                        >
                            {/* Avatar */}
                            <div className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 mt-1",
                                msg.role === 'user'
                                    ? "bg-zinc-800"
                                    : cn("bg-gradient-to-br from-sky-500 to-indigo-500 shadow-sky-200 shadow-sm",
                                        msg.isStreaming && "animate-pulse")
                            )}>
                                {msg.role === 'user' ? <User size={14} /> : <BrainCircuit size={14} />}
                            </div>

                            {/* Body */}
                            <div className={cn("flex flex-col gap-1.5 min-w-0 flex-1",
                                msg.role === 'user' ? "items-end" : "items-start"
                            )}>
                                {/* ── Step Timeline (assistant only) ── */}
                                {msg.role === 'assistant' && msg.steps && msg.steps.length > 0 && (
                                    <div className="w-full pl-0.5 pt-0.5">
                                        {msg.steps.map((step, si) => (
                                            <StepItem
                                                key={step.id}
                                                step={step}
                                                isLast={si === (msg.steps?.length ?? 0) - 1}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* ── Prose bubble (streams live into msg.content, then stays as final answer) ── */}
                                {(msg.content || msg.isStreaming) && msg.role === 'assistant' && (
                                    <div className={cn(
                                        "px-5 py-3.5 rounded-3xl text-[14px] leading-relaxed w-full",
                                        "bg-white border border-zinc-100 text-zinc-800 rounded-tl-sm shadow-sm shadow-zinc-100"
                                    )}>
                                        <div className="prose prose-sm max-w-none prose-zinc prose-p:my-0.5 prose-pre:bg-zinc-900 prose-pre:text-xs prose-pre:rounded-2xl">
                                            <Markdown>{msg.content || ''}</Markdown>
                                            {msg.isStreaming && (
                                                <motion.span
                                                    animate={{ opacity: [1, 0, 1] }}
                                                    transition={{ duration: 0.7, repeat: Infinity }}
                                                    className="inline-block w-[2px] h-[1em] bg-sky-400 ml-0.5 align-middle rounded-sm"
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* User messages */}
                                {msg.role === 'user' && (
                                    <div className="px-5 py-3.5 rounded-3xl text-[14px] leading-relaxed w-full bg-zinc-900 text-white rounded-tr-sm">
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                )}

                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Initial thinking indicator (before first step appears) */}
                {isLoading &&
                    localMessages[localMessages.length - 1]?.role === 'assistant' &&
                    !localMessages[localMessages.length - 1]?.steps?.length && (
                        <div className="flex gap-3 max-w-3xl mx-auto">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white shrink-0 shadow-sm animate-pulse">
                                <BrainCircuit size={14} />
                            </div>
                            <div className="flex items-center gap-1.5 px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl rounded-tl-sm">
                                {[0, 150, 300].map(delay => (
                                    <motion.span
                                        key={delay}
                                        animate={{ y: [0, -4, 0] }}
                                        transition={{ duration: 0.6, repeat: Infinity, delay: delay / 1000 }}
                                        className="w-1.5 h-1.5 rounded-full bg-sky-400"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-zinc-100 bg-white/50 backdrop-blur-xl shrink-0">
                <div className="max-w-2xl mx-auto relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend(input)}
                        placeholder="Initialize neural request…"
                        disabled={isLoading}
                        className="w-full pl-5 pr-14 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-sky-500/10 focus:border-sky-400 outline-none text-zinc-900 placeholder:text-zinc-300 text-sm transition-all disabled:opacity-50"
                    />
                    <div className="absolute right-2 top-2 bottom-2">
                        {isLoading ? (
                            <button
                                onClick={handleStop}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-900 text-white hover:bg-rose-500 transition-all"
                            >
                                <StopCircle size={18} />
                            </button>
                        ) : (
                            <button
                                onClick={() => handleSend(input)}
                                disabled={!input.trim()}
                                className={cn(
                                    "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                                    input.trim()
                                        ? "bg-zinc-900 text-white hover:shadow-lg hover:scale-105"
                                        : "text-zinc-300"
                                )}
                            >
                                <Send size={18} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-center gap-3 mt-2">
                    <span className="text-[9px] text-zinc-300 uppercase tracking-[0.2em] font-bold">Neural Engine v2.2</span>
                    <div className="w-1 h-1 rounded-full bg-zinc-200" />
                    <span className="text-[9px] text-sky-400 uppercase tracking-[0.2em] font-bold">
                        Session: {currentSessionId?.slice(0, 8)}
                    </span>
                </div>
            </div>
        </motion.div>
    );
};
