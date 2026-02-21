import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, BrainCircuit, User, Eraser, StopCircle, Copy, Trash2, CheckCircle2, XCircle, Loader2, Wrench, Globe, FileText, Terminal, Layers, Plus } from 'lucide-react';
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
import { useAIStore } from '../stores/aiStore';
import {
    parseToolCalls,
    executeTool,
    stripToolCalls,
    getToolsForPrompt,
    ToolContext,
    ToolResult,
    getAllTools
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

const ActionCard: React.FC<{ exec: ToolExecution }> = ({ exec }) => {
    const toolDef = getAllTools().find(t => t.name === exec.tool);
    const category = toolDef?.category || 'os';

    const icons: Record<string, any> = {
        os: Wrench,
        file: FileText,
        shell: Terminal,
        browser: Globe,
        generate: BrainCircuit,
        automation: BrainCircuit
    };

    const Icon = icons[category] || Wrench;
    const isRunning = exec.status === 'running';
    const isSuccess = exec.status === 'success';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={cn(
                "group relative flex flex-col gap-2 p-3 rounded-2xl border transition-all duration-300",
                isRunning ? "bg-amber-50/50 border-amber-200/50 shadow-sm shadow-amber-100/20" :
                    isSuccess ? "bg-white border-zinc-100 shadow-sm shadow-zinc-100/50" :
                        "bg-red-50/50 border-red-200/50 shadow-sm shadow-red-100/20"
            )}
        >
            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center transition-colors",
                    isRunning ? "bg-amber-100 text-amber-600 animate-pulse" :
                        isSuccess ? "bg-zinc-100 text-zinc-500 group-hover:bg-sky-50 group-hover:text-sky-600" :
                            "bg-red-100 text-red-600"
                )}>
                    {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold tracking-wider uppercase text-zinc-400 group-hover:text-sky-500 transition-colors">
                            {exec.tool.replace(/_/g, ' ')}
                        </span>
                        {isRunning && <span className="text-[10px] text-amber-500 font-medium animate-pulse">Executing...</span>}
                    </div>
                    <div className="text-[13px] text-zinc-600 truncate opacity-80 group-hover:opacity-100 transition-opacity">
                        {Object.entries(exec.args).map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </div>
                </div>
            </div>

            {isSuccess && exec.result?.message && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-[12px] text-zinc-500 pl-11 pr-2 pb-1 border-t border-zinc-50 mt-1 pt-2 italic"
                >
                    {exec.result.message}
                </motion.div>
            )}
        </motion.div>
    );
};

export const ChatApp: React.FC<ChatAppProps> = ({ windowData }) => {
    const { aiConfig } = useSettingsStore();
    const { openApp, closeWindow, appWindows, sendAppAction, focusWindow } = useOS();
    const { workspacePath } = useWorkspaceStore();
    const { writeFile, readFile, listFiles, createDir, deleteFile } = useFileSystem();
    
    // AI Store Integration
    const { 
        sessions, 
        currentSessionId, 
        createSession, 
        switchSession, 
        addMessage: addPersistentMessage, 
        memory, 
        updateMemory 
    } = useAIStore();

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [localMessages, setLocalMessages] = useState<Message[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const lastProcessedAction = useRef<number>(0);

    // Sync local messages with current session
    useEffect(() => {
        if (!currentSessionId) {
            const sid = createSession();
            switchSession(sid);
        } else {
            const session = sessions[currentSessionId];
            if (session) {
                setLocalMessages(session.history as Message[]);
            }
        }
    }, [currentSessionId, sessions]);

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
            setLocalMessages(prev => [...prev, { role, content, timestamp: Date.now() }]);
        },
        updateMemory: (key, value) => updateMemory(key, value)
    }), [openApp, closeWindow, sendAppAction, appWindows, workspacePath, writeFile, readFile, listFiles, createDir, deleteFile, updateMemory]);

    // Better Auto-scroll
    useEffect(() => {
        if (!scrollRef.current) return;
        const scrollContainer = scrollRef.current;
        const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 200;
        if (isNearBottom || isLoading) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    }, [localMessages, isLoading]);

    const handleSend = useCallback(async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
        addPersistentMessage('user', text);
        setLocalMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        const assistantMsgId = Date.now() + Math.random();
        const assistantMsg: Message = {
            role: 'assistant',
            content: '',
            timestamp: assistantMsgId,
            isStreaming: true,
            toolExecutions: []
        };
        setLocalMessages(prev => [...prev, assistantMsg]);

        const controller = new AbortController();
        setAbortController(controller);

        try {
            const llm = getLLMProvider();
            const toolContext = getToolContext();

            interface MemoryEntry {
                step: number;
                tool: string;
                args: Record<string, any>;
                success: boolean;
                message: string;
                data?: any;
            }
            const workingMemory: MemoryEntry[] = [];

            const memoryContext = Object.entries(memory).length > 0
                ? `LONG-TERM MEMORY (Facts you learned previously):\n${JSON.stringify(memory, null, 2)}`
                : 'LONG-TERM MEMORY: Currently empty.';

            const buildSystemPrompt = () => `You are Neuro AI, the intelligent core of NeuroOS.
${memoryContext}
SESSION ID: ${currentSessionId}

AVAILABLE TOOLS:
${getToolsForPrompt()}

CRITICAL RULES:
- ONE tool call per response.
- Use Working Memory for data flow.
- Update LONG-TERM MEMORY using "update_memory" if you learn important facts about the user or system preferences.
- Be proactive and thorough.`;

            const conversation: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
                { role: 'system', content: buildSystemPrompt() },
                ...localMessages
                    .filter(m => !m.isStreaming && m.role !== 'system')
                    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
                { role: 'user', content: text }
            ];

            let iteration = 0;
            let continueLoop = true;
            let accumulatedDisplay = '';

            while (continueLoop && iteration < MAX_TOOL_ITERATIONS) {
                iteration++;
                let fullContent = '';

                if (llm.stream) {
                    await llm.stream(conversation, (chunk: string) => {
                        fullContent += chunk;
                        const currentToolCalls = parseToolCalls(fullContent);
                        const strippedContent = stripToolCalls(fullContent, currentToolCalls);
                        const liveDisplay = accumulatedDisplay + (accumulatedDisplay && strippedContent ? '\n\n' : '') + strippedContent;

                        setLocalMessages(prev => prev.map(m =>
                            m.timestamp === assistantMsgId ? { ...m, content: liveDisplay } : m
                        ));
                    }, controller.signal);
                } else {
                    const response = await llm.chat(conversation);
                    fullContent = response.content;
                }

                const toolCalls = parseToolCalls(fullContent);

                if (toolCalls.length === 0) {
                    continueLoop = false;
                    const finalContent = stripToolCalls(fullContent, []).trim();
                    const finalDisplay = (accumulatedDisplay + (accumulatedDisplay && finalContent ? '\n\n' : '') + finalContent).trim();

                    setLocalMessages(prev => prev.map(m =>
                        m.timestamp === assistantMsgId ? { ...m, content: finalDisplay, isStreaming: false } : m
                    ));
                    addPersistentMessage('assistant', finalDisplay);
                } else {
                    const call = toolCalls[0];
                    const displayText = stripToolCalls(fullContent, toolCalls);
                    if (displayText) accumulatedDisplay += (accumulatedDisplay ? '\n\n' : '') + displayText;

                    const toolExec: ToolExecution = { tool: call.tool, args: call.args, status: 'running' };

                    setLocalMessages(prev => prev.map(m =>
                        m.timestamp === assistantMsgId
                            ? { ...m, content: accumulatedDisplay, toolExecutions: [...(m.toolExecutions || []), toolExec] }
                            : m
                    ));

                    const result = await executeTool(call, toolContext);
                    const updatedStatus = result.success ? 'success' : 'error';

                    setLocalMessages(prev => prev.map(m =>
                        m.timestamp === assistantMsgId
                            ? {
                                ...m,
                                toolExecutions: m.toolExecutions?.map(te =>
                                    te.tool === call.tool && te.status === 'running' ? { ...te, status: updatedStatus as 'success' | 'error', result } : te
                                )
                            }
                            : m
                    ));

                    workingMemory.push({
                        step: iteration,
                        tool: call.tool,
                        args: call.args,
                        success: result.success,
                        message: result.message,
                        data: result.data
                    });

                    const memoryStr = workingMemory.map(m => `[STEP ${m.step}] ${m.tool} → ${m.success ? '✅' : '❌'}\n  RESULT: ${m.message}`).join('\n\n');

                    conversation.push({ role: 'assistant', content: fullContent });
                    conversation.push({
                        role: 'user',
                        content: `─── WORKING MEMORY ───\n${memoryStr}\n\nContinue with the next step.`
                    });
                }
            }

        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Chat error:', error);
                setLocalMessages(prev => prev.map(m =>
                    m.timestamp === assistantMsgId ? { ...m, content: "⚠️ Something went wrong.", isStreaming: false } : m
                ));
            }
        } finally {
            setIsLoading(false);
            setAbortController(null);
        }
    }, [isLoading, localMessages, getToolContext, currentSessionId, memory, addPersistentMessage]);

    // Handle external actions
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

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col h-full bg-white font-sans text-zinc-900"
        >
            {/* Header with Session Switcher */}
            <div className="h-12 border-b border-zinc-100 flex items-center justify-between px-4 bg-white/80 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
                        <BrainCircuit size={16} className="text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400">Neuro OS</span>
                            <span className="w-1 h-1 rounded-full bg-emerald-500" />
                        </div>
                        <div className="flex items-center gap-1 group cursor-pointer relative" onClick={(e) => {
                            const availableSessions = Object.values(sessions).sort((a,b) => b.lastActive - a.lastActive);
                            showContextMenu(e.clientX, e.clientY, availableSessions.map(s => ({
                                label: `Session ${s.id.slice(0, 8)}...`,
                                icon: Layers,
                                action: () => switchSession(s.id),
                                active: s.id === currentSessionId
                            })));
                        }}>
                            <span className="text-xs font-bold text-zinc-600">Active Session</span>
                            <Layers size={10} className="text-zinc-400 group-hover:text-sky-500" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button onClick={() => createSession()} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-sky-600 transition-colors" title="New Session">
                        <Plus size={16} />
                    </button>
                    <button onClick={handleClear} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-rose-500 transition-colors" title="Clear/New Session">
                        <Eraser size={16} />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
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
                            <p className="text-[11px] text-zinc-400 mt-1 max-w-[200px]">Awaiting your command to begin processing...</p>
                        </div>
                    </div>
                )}

                {localMessages.map((msg, idx) => (
                    <div key={idx} className={cn("flex gap-4 max-w-3xl mx-auto", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                        <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 mt-1 shadow-sm",
                            msg.role === 'user' ? "bg-zinc-800" : "bg-sky-500 shadow-sky-200"
                        )}>
                            {msg.role === 'user' ? <User size={14} /> : <BrainCircuit size={14} />}
                        </div>

                        <div className={cn("flex flex-col gap-3 min-w-0 flex-1", msg.role === 'user' ? "items-end" : "items-start")}>
                            <div className={cn(
                                "group relative px-5 py-4 rounded-3xl text-[14px] leading-relaxed transition-all",
                                msg.role === 'user'
                                    ? "bg-zinc-900 text-white rounded-tr-sm"
                                    : "bg-white border border-zinc-100 text-zinc-800 rounded-tl-sm shadow-sm shadow-zinc-200/20"
                            )}>
                                {msg.role === 'assistant' ? (
                                    <div className="prose prose-sm max-w-none prose-zinc prose-p:my-0.5 prose-pre:bg-zinc-900 prose-pre:rounded-2xl">
                                        <Markdown>{msg.content || (msg.isStreaming ? '▋' : '')}</Markdown>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                )}
                            </div>

                            {msg.toolExecutions && msg.toolExecutions.length > 0 && (
                                <div className="flex flex-col gap-2 w-full max-w-md">
                                    {msg.toolExecutions.map((exec, i) => (
                                        <ActionCard key={i} exec={exec} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && localMessages[localMessages.length-1]?.content === '' && (
                    <div className="flex gap-4 max-w-3xl mx-auto">
                        <div className="w-8 h-8 rounded-xl bg-sky-500 flex items-center justify-center text-white shrink-0 shadow-sky-200 shadow-sm animate-pulse">
                            <BrainCircuit size={14} />
                        </div>
                        <div className="flex items-center gap-2 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl rounded-tl-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce" />
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce [animation-delay:150ms]" />
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-zinc-100 bg-white/50 backdrop-blur-xl shrink-0">
                <div className="max-w-2xl mx-auto relative group">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend(input)}
                        placeholder="Initialize neural request..."
                        disabled={isLoading}
                        className="w-full pl-5 pr-14 py-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-4 focus:ring-sky-500/10 focus:border-sky-400 outline-none text-zinc-900 placeholder:text-zinc-300 text-sm transition-all"
                    />
                    <div className="absolute right-2 top-2 bottom-2 flex gap-1">
                        {isLoading ? (
                            <button onClick={handleStop} className="w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-900 text-white hover:bg-rose-500 transition-all">
                                <StopCircle size={18} />
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleSend(input)}
                                disabled={!input.trim()}
                                className={cn(
                                    "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                                    input.trim() ? "bg-zinc-900 text-white hover:shadow-lg shadow-zinc-900/20" : "text-zinc-300"
                                )}
                            >
                                <Send size={18} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex items-center justify-center gap-4 mt-3">
                    <span className="text-[9px] text-zinc-300 uppercase tracking-[0.2em] font-bold">Neural Engine v2.0</span>
                    <div className="w-1 h-1 rounded-full bg-zinc-200" />
                    <span className="text-[9px] text-sky-400 uppercase tracking-[0.2em] font-bold">Session: {currentSessionId?.slice(0, 8)}</span>
                </div>
            </div>
        </motion.div>
    );
};
