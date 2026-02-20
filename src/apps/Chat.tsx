import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, BrainCircuit, User, Eraser, StopCircle, Copy, Trash2, CheckCircle2, XCircle, Loader2, Wrench } from 'lucide-react';
import { cn } from '../lib/utils';
import { showContextMenu } from '../components/ContextMenu';
import { useSettingsStore } from '../stores/settingsStore';
import { getLLMProvider } from '../lib/llm/factory';
import { useOS, OSAppWindow } from '../hooks/useOS';
import Markdown from 'react-markdown';
import { APPS_CONFIG } from '../lib/apps';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useFileSystem } from '../hooks/useFileSystem';
import {
    parseToolCalls,
    executeTool,
    stripToolCalls,
    getToolsForPrompt,
    ToolContext,
    ToolResult
} from '../lib/ai';

interface ChatAppProps {
    windowData: OSAppWindow;
}

interface ToolExecution {
    tool: string;
    args: Record<string, any>;
    status: 'running' | 'success' | 'error';
    result?: ToolResult;
}

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    isStreaming?: boolean;
    toolExecutions?: ToolExecution[];
}

const MAX_TOOL_ITERATIONS = 15;

export const ChatApp: React.FC<ChatAppProps> = ({ windowData }) => {
    const { aiConfig } = useSettingsStore();
    const { openApp, closeWindow, appWindows, sendAppAction } = useOS();
    const { workspacePath } = useWorkspaceStore();
    const { writeFile, readFile, listFiles, createDir, deleteFile } = useFileSystem();
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: `Hello! I'm **Neuro AI**, your OS core assistant, powered by **${aiConfig.activeProviderId}**.\n\nI can **control the entire OS** — open/close apps, manage files, run shell commands, browse the web, generate reports and images, and much more. Just tell me what to do!`,
            timestamp: Date.now()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const lastProcessedAction = useRef<number>(0);

    // Build tool context
    const getToolContext = useCallback((): ToolContext => ({
        openApp: (id: string, name: string) => openApp(id, name),
        closeWindow: (id: string) => closeWindow(id),
        sendAppAction: (idOrComponent: string, type: string, payload: any) => sendAppAction(idOrComponent, type, payload),
        getAppWindows: () => useOS.getState().appWindows,
        appWindows,
        workspacePath,
        writeFile,
        readFile,
        listFiles,
        createDir,
        deleteFile,
        addMessage: (role, content) => {
            setMessages(prev => [...prev, { role, content, timestamp: Date.now() }]);
        }
    }), [openApp, closeWindow, sendAppAction, appWindows, workspacePath, writeFile, readFile, listFiles, createDir, deleteFile]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    // Handle external actions (e.g. from SystemAssistant)
    useEffect(() => {
        if (windowData.lastAction && windowData.lastAction.type === 'initial_query') {
            const { payload, timestamp } = windowData.lastAction;
            if (timestamp > lastProcessedAction.current) {
                lastProcessedAction.current = timestamp;
                if (payload && typeof payload === 'string') {
                    handleSend(payload);
                }
            }
        }
    }, [windowData.lastAction]);

    const handleSend = useCallback(async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        const assistantMsgId = Date.now();
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: '',
            timestamp: assistantMsgId,
            isStreaming: true,
            toolExecutions: []
        }]);

        const controller = new AbortController();
        setAbortController(controller);

        try {
            const llm = getLLMProvider();
            const toolContext = getToolContext();

            // ─── WORKING MEMORY: tracks all tool results across iterations ───
            interface MemoryEntry {
                step: number;
                tool: string;
                args: Record<string, any>;
                success: boolean;
                message: string;
                data?: any;
            }
            const workingMemory: MemoryEntry[] = [];

            const buildSystemPrompt = () => `You are Neuro AI, the intelligent core of NeuroOS — a futuristic desktop operating system.
You have FULL CONTROL over the entire OS. You are an autonomous agent that chains multiple actions to complete complex tasks.

AVAILABLE TOOLS:
${getToolsForPrompt()}

HOW TO CALL TOOLS:
When you need to perform an action, output a JSON block:
\`\`\`json
{ "tool": "tool_name", "args": { "key": "value" } }
\`\`\`
Output ONE tool call per response. After each result, CONTINUE to the next step.

AUTONOMOUS MULTI-STEP WORKFLOWS:
1. **PLAN**: Briefly state what steps you'll take
2. **EXECUTE**: Call tools one at a time, using data from previous steps
3. **USE WORKING MEMORY**: You'll receive a WORKING MEMORY section with ALL previous results. Reference data from any step
4. **COMPLETE**: Only stop when the ENTIRE task is done. Provide a final summary

DATA FLOW BETWEEN TOOLS:
- Every tool result includes structured data (paths, content, entries, etc.)
- When you need content from a previous step, you ALREADY HAVE IT in Working Memory
- To append to an existing file, use the \`append_file\` tool
- To modify a section of a file, use the \`update_file\` tool
- To save new content based on previous data, use \`save_file\` with content derived from Working Memory

CRITICAL RULES:
- ONE tool call per response, then wait for result
- After each result, CONTINUE if more steps are needed
- Reference data from Working Memory by step number (e.g. "the content from Step 1")
- Keep explanations concise between tool calls — focus on action
- When done, provide a clear summary of everything accomplished

WORKSPACE: ${workspacePath || 'Not set'}
Personality: Autonomous, efficient, thorough. Plan ahead, execute decisively, confirm results.`;

            // Build conversation history
            const conversation: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
                { role: 'system', content: buildSystemPrompt() },
                ...messages
                    .filter(m => !m.isStreaming && m.role !== 'system')
                    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
                { role: 'user', content: text }
            ];

            // ─── Agentic Loop: stream → detect tool → execute → feed memory → repeat ──
            let iteration = 0;
            let continueLoop = true;
            let accumulatedDisplay = '';

            while (continueLoop && iteration < MAX_TOOL_ITERATIONS) {
                iteration++;
                let fullContent = '';

                // Stream the AI response
                if (llm.stream) {
                    await llm.stream(conversation, (chunk: string) => {
                        fullContent += chunk;
                        const liveDisplay = accumulatedDisplay + (accumulatedDisplay ? '\n\n' : '') + fullContent;
                        setMessages(prev => prev.map(m =>
                            m.timestamp === assistantMsgId
                                ? { ...m, content: liveDisplay, isStreaming: true }
                                : m
                        ));
                    });
                } else {
                    const response = await llm.chat(conversation);
                    fullContent = response.content;
                }

                // Parse tool calls
                const toolCalls = parseToolCalls(fullContent);

                if (toolCalls.length === 0) {
                    // Done — no more tool calls
                    continueLoop = false;
                    const finalDisplay = accumulatedDisplay + (accumulatedDisplay ? '\n\n' : '') + fullContent;
                    setMessages(prev => prev.map(m =>
                        m.timestamp === assistantMsgId
                            ? { ...m, content: finalDisplay, isStreaming: false }
                            : m
                    ));
                } else {
                    const call = toolCalls[0];
                    const displayText = stripToolCalls(fullContent, toolCalls);

                    if (displayText) {
                        accumulatedDisplay += (accumulatedDisplay ? '\n\n' : '') + displayText;
                    }

                    // Show tool running status
                    const toolExec: ToolExecution = {
                        tool: call.tool,
                        args: call.args,
                        status: 'running'
                    };

                    setMessages(prev => prev.map(m =>
                        m.timestamp === assistantMsgId
                            ? {
                                ...m,
                                content: accumulatedDisplay,
                                isStreaming: true,
                                toolExecutions: [...(m.toolExecutions || []), toolExec]
                            }
                            : m
                    ));

                    // Execute the tool
                    const result = await executeTool(call, toolContext);
                    const updatedStatus = result.success ? 'success' : 'error';

                    setMessages(prev => prev.map(m =>
                        m.timestamp === assistantMsgId
                            ? {
                                ...m,
                                toolExecutions: m.toolExecutions?.map(te =>
                                    te === toolExec ? { ...te, status: updatedStatus as 'success' | 'error', result } : te
                                )
                            }
                            : m
                    ));

                    // ─── Add to Working Memory ───
                    workingMemory.push({
                        step: iteration,
                        tool: call.tool,
                        args: call.args,
                        success: result.success,
                        message: result.message,
                        data: result.data
                    });

                    // ─── Build Working Memory Scratchpad ───
                    const memoryStr = workingMemory.map(m => {
                        const dataStr = m.data
                            ? `\n  DATA: ${JSON.stringify(m.data, null, 2).slice(0, 6000)}`
                            : '';
                        return `[STEP ${m.step}] ${m.tool}(${JSON.stringify(m.args)}) → ${m.success ? '✅' : '❌'}\n  RESULT: ${m.message.slice(0, 2000)}${dataStr}`;
                    }).join('\n\n');

                    // Feed full context back to the AI
                    conversation.push({
                        role: 'assistant',
                        content: fullContent
                    });

                    conversation.push({
                        role: 'user',
                        content: `─── WORKING MEMORY (${workingMemory.length} steps completed) ───\n${memoryStr}\n\n─── INSTRUCTION ───\nContinue with the next step of the user's original request. You have ALL data from previous steps above — use it directly in your next tool call.\nIf the task is fully complete, provide a final summary of what was accomplished.`
                    });

                    fullContent = '';
                }
            }

        } catch (error: any) {
            if (error?.name !== 'AbortError') {
                setMessages(prev => prev.map(m =>
                    m.timestamp === assistantMsgId
                        ? { ...m, content: "⚠️ Connection error. Please check your AI settings.", isStreaming: false }
                        : m
                ));
            } else {
                setMessages(prev => prev.map(m =>
                    m.timestamp === assistantMsgId
                        ? { ...m, isStreaming: false }
                        : m
                ));
            }
        } finally {
            setIsLoading(false);
            setAbortController(null);
        }
    }, [isLoading, messages, getToolContext]);

    const handleStop = () => {
        abortController?.abort();
        setIsLoading(false);
        setMessages(prev => prev.map(m => m.isStreaming ? { ...m, isStreaming: false } : m));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend(input);
        }
    };

    const handleClear = () => {
        setMessages([{
            role: 'assistant',
            content: `Hello! I'm **Neuro AI**. How can I help you?`,
            timestamp: Date.now()
        }]);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380, mass: 0.7 }}
            className="flex flex-col h-full bg-white font-sans text-zinc-900"
        >
            {/* Header */}
            <div className="h-11 border-b border-zinc-100 flex items-center justify-between px-4 bg-white shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-sky-500 flex items-center justify-center">
                        <BrainCircuit size={14} className="text-white" />
                    </div>
                    <span className="text-xs font-bold tracking-widest uppercase text-zinc-400">Neuro Assistant</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                </div>
                <button
                    onClick={handleClear}
                    className="p-1.5 hover:bg-zinc-100 rounded-md text-zinc-400 hover:text-zinc-600 transition-colors"
                    title="Clear history"
                >
                    <Eraser size={14} />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-200 space-y-3 py-16">
                        <BrainCircuit size={48} strokeWidth={1} />
                        <p className="text-xs font-semibold tracking-[0.25em] uppercase">Awaiting Input</p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "flex gap-3 max-w-2xl mx-auto",
                            msg.role === 'user' ? "justify-end" : "justify-start"
                        )}
                    >
                        {/* AI Avatar */}
                        {msg.role !== 'user' && (
                            <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm shadow-sky-200">
                                <BrainCircuit size={14} />
                            </div>
                        )}

                        <div className="flex flex-col gap-2 max-w-[85%]">
                            {/* Bubble */}
                            <div className={cn(
                                "relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
                                msg.role === 'user'
                                    ? "bg-zinc-900 text-white rounded-tr-sm"
                                    : "bg-zinc-50 border border-zinc-100 text-zinc-800 rounded-tl-sm"
                            )}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    showContextMenu(e.clientX, e.clientY, [
                                        { label: 'Copy Message', icon: Copy, action: () => navigator.clipboard.writeText(msg.content) },
                                        { type: 'divider' },
                                        { label: 'Delete Message', icon: Trash2, action: () => setMessages(prev => prev.filter(m => m !== msg)), danger: true },
                                    ]);
                                }}
                            >
                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-sm max-w-none prose-zinc prose-p:my-0.5 prose-headings:my-1 prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-pre:border prose-pre:border-zinc-800 prose-pre:rounded-xl prose-code:text-sky-600 prose-code:bg-sky-50 prose-code:px-1 prose-code:rounded">
                                        <Markdown>{msg.content || (msg.isStreaming ? '▋' : '')}</Markdown>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                )}
                                {msg.isStreaming && (
                                    <span className="inline-block w-1.5 h-4 bg-sky-500 rounded-sm ml-0.5 animate-pulse align-middle" />
                                )}
                            </div>

                            {/* Tool Execution Status Badges */}
                            <AnimatePresence>
                                {msg.toolExecutions && msg.toolExecutions.length > 0 && (
                                    <div className="flex flex-col gap-1.5">
                                        {msg.toolExecutions.map((exec, i) => (
                                            <motion.div
                                                key={`tool-${i}`}
                                                initial={{ opacity: 0, y: -8, scale: 0.9 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border",
                                                    exec.status === 'running'
                                                        ? "bg-amber-50 border-amber-200 text-amber-700"
                                                        : exec.status === 'success'
                                                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                                            : "bg-red-50 border-red-200 text-red-600"
                                                )}
                                            >
                                                {exec.status === 'running' ? (
                                                    <Loader2 size={12} className="animate-spin" />
                                                ) : exec.status === 'success' ? (
                                                    <CheckCircle2 size={12} />
                                                ) : (
                                                    <XCircle size={12} />
                                                )}
                                                <Wrench size={10} className="opacity-50" />
                                                <span className="font-mono">{exec.tool}</span>
                                                {exec.args && Object.keys(exec.args).length > 0 && (
                                                    <span className="text-[10px] opacity-60 truncate max-w-[200px]">
                                                        ({Object.entries(exec.args).map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 30) : v}`).join(', ')})
                                                    </span>
                                                )}
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* User Avatar */}
                        {msg.role === 'user' && (
                            <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
                                <User size={14} />
                            </div>
                        )}
                    </div>
                ))}

                {/* Loading dots */}
                {isLoading && messages[messages.length - 1]?.content === '' && !messages[messages.length - 1]?.toolExecutions?.length && (
                    <div className="flex gap-3 max-w-2xl mx-auto justify-start">
                        <div className="w-7 h-7 rounded-lg bg-sky-500 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm shadow-sky-200">
                            <BrainCircuit size={14} />
                        </div>
                        <div className="bg-zinc-50 border border-zinc-100 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-zinc-100 bg-white shrink-0">
                <div className="max-w-2xl mx-auto flex gap-2 items-center">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask anything or give a command…"
                        disabled={isLoading}
                        className="flex-1 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 outline-none text-zinc-900 placeholder:text-zinc-300 text-sm transition-all disabled:opacity-50"
                    />
                    {isLoading ? (
                        <button
                            onClick={handleStop}
                            className="p-2.5 rounded-xl bg-zinc-900 text-white hover:bg-red-600 transition-colors shrink-0"
                            title="Stop generation"
                        >
                            <StopCircle size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={() => handleSend(input)}
                            disabled={!input.trim()}
                            className={cn(
                                "p-2.5 rounded-xl transition-all shrink-0",
                                input.trim()
                                    ? "bg-zinc-900 text-white hover:bg-zinc-700 active:scale-95 shadow-sm"
                                    : "bg-zinc-100 text-zinc-300 cursor-not-allowed"
                            )}
                        >
                            <Send size={16} />
                        </button>
                    )}
                </div>
                <p className="text-center text-[10px] text-zinc-300 mt-2 tracking-[0.2em] uppercase font-medium">Neuro AI · {aiConfig.activeProviderId}</p>
            </div>
        </motion.div>
    );
};
