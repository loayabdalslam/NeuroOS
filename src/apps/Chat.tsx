import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Send, BrainCircuit, User, Eraser, Loader2, Sparkles, X, Pause, Play,
    ChevronDown, ChevronUp, Trash2, Copy, Check, FileText, Image as ImageIcon,
    Wifi, WifiOff, Users, MessageCircle, Hash, Volume2, VolumeX, SkipBack, SkipForward
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
    ToolContext, ToolResult, getAllTools, getToolsForPrompt
} from '../lib/ai';

interface ChatAppProps { windowData: OSAppWindow; }

type StepKind = 'thinking' | 'streaming' | 'tool-call' | 'tool-result' | 'tool-error' | 'info' | 'error' | 'success';

interface StepLog {
    id: number;
    kind: StepKind;
    text: string;
    body?: string;
    detail?: string;
    tool?: string;
    timestamp: number;
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    isStreaming?: boolean;
    steps?: StepLog[];
}

const MAX_ITER = 12;

const kindConfig: Record<StepKind, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
    thinking: { icon: BrainCircuit, color: 'text-zinc-400', bg: 'bg-zinc-50', border: 'border-zinc-200', label: 'Thinking' },
    streaming: { icon: Sparkles, color: 'text-zinc-600', bg: 'bg-zinc-100', border: 'border-zinc-300', label: 'Generating' },
    'tool-call': { icon: Sparkles, color: 'text-zinc-800', bg: 'bg-zinc-200', border: 'border-zinc-400', label: 'Tool Call' },
    'tool-result': { icon: Check, color: 'text-zinc-800', bg: 'bg-zinc-100', border: 'border-zinc-300', label: 'Result' },
    'tool-error': { icon: X, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Error' },
    info: { icon: Sparkles, color: 'text-zinc-400', bg: 'bg-zinc-50', border: 'border-zinc-200', label: 'Info' },
    error: { icon: X, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Error' },
    success: { icon: Check, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Success' },
};

const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const ChatApp: React.FC<ChatAppProps> = ({ windowData }) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentSteps, setCurrentSteps] = useState<StepLog[]>([]);
    const [showTools, setShowTools] = useState(false);
    const [thinkingPreview, setThinkingPreview] = useState('');
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { workspacePath } = useWorkspaceStore();
    const { openApp, appWindows, closeWindow, sendAppAction, focusWindow } = useOS();
    
    const getAppWindows = useCallback(() => {
        return appWindows;
    }, [appWindows]);
    
    const allTools = useMemo(() => getAllTools(), []);
    const toolsPrompt = useMemo(() => getToolsForPrompt(), []);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => {
        if (messages.length === 0) {
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                content: '# Welcome to Neuro Chat\n\nI\'m your AI assistant powered by **agentic AI**. I can help you with:\n\n• **Research** - Search the web, browse pages, gather information\n• **File Operations** - Read, write, create, and manage files\n• **Automation** - Execute commands, run scripts, automate tasks\n• **Analysis** - Analyze data, review code, provide insights\n\nJust type your request and I\'ll think through it step by step.\n\n> 💡 Each thought and action will be shown in real-time below my response.',
                timestamp: Date.now()
            }]);
        }
    }, []);

    const getToolContext = useCallback((): ToolContext => ({
        openApp: (id, name) => openApp(id, name),
        closeWindow: (id) => closeWindow(id),
        sendAppAction: (idOrComponent, type, payload) => sendAppAction(idOrComponent, type, payload),
        getAppWindows: () => getAppWindows(),
        appWindows: appWindows.filter(w => w.component !== 'chat'),
        workspacePath,
        writeFile: async (path: string, content: string) => {
            const electron = (window as any).electron;
            if (electron?.fileSystem?.write) {
                await electron.fileSystem.write(path, content);
            }
        },
        readFile: async (path) => {
            const electron = (window as any).electron;
            if (electron?.fileSystem?.read) {
                return await electron.fileSystem.read(path);
            }
            throw new Error('File system not available');
        },
        listFiles: async (path) => {
            const electron = (window as any).electron;
            if (electron?.fileSystem?.list) {
                return await electron.fileSystem.list(path);
            }
            return [];
        },
        createDir: async (path) => {
            const electron = (window as any).electron;
            if (electron?.fileSystem?.createDir) {
                await electron.fileSystem.createDir(path);
            }
        },
        deleteFile: async (path) => {
            const electron = (window as any).electron;
            if (electron?.fileSystem?.delete) {
                await electron.fileSystem.delete(path);
            }
        },
        addMessage: (role, content) => {
            // Used for memory/context
        },
        updateMemory: (key, value) => {
            useAIStore.getState().updateMemory(key, value);
        }
    }), [openApp, closeWindow, sendAppAction, getAppWindows, appWindows, workspacePath]);

    const addStep = useCallback((kind: StepKind, text: string, detail?: string, tool?: string) => {
        const step: StepLog = {
            id: Date.now() + Math.random(),
            kind,
            text,
            detail,
            tool,
            timestamp: Date.now()
        };
        setCurrentSteps(prev => [...prev, step]);
    }, []);

    const handleCopy = useCallback((content: string, id: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }, []);

    const runAI = useCallback(async (userInput: string) => {
        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: userInput,
            timestamp: Date.now()
        };
        
        const assistantMessage: Message = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
            steps: []
        };

        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setIsStreaming(true);
        setCurrentSteps([]);
        
        const controller = new AbortController();
        setAbortController(controller);

        let fullResponse = '';
        
        try {
            const llm = getLLMProvider();
            const systemPrompt = `You are Neuro, an intelligent AI assistant. You have access to various tools to help users.
            
AVAILABLE TOOLS:
${toolsPrompt}

WORKSPACE: ${workspacePath || 'Not set'}

Guidelines:
1. Think step by step before taking actions
2. Use tools when needed to accomplish tasks
3. Always provide clear, actionable results
4. If you encounter errors, explain what happened and suggest alternatives
5. Show your thinking process

When you need to use a tool, respond in this JSON format:
{ "tool": "tool_name", "args": { "param1": "value1" } }

Otherwise, provide your response directly.`;

            const conversationHistory = messages
                .filter(m => m.role !== 'system')
                .map(m => ({ role: m.role, content: m.content }));

            const messagesForLLM = [
                { role: 'system' as const, content: systemPrompt },
                ...conversationHistory,
                { role: 'user' as const, content: userInput }
            ];

            let iterCount = 0;
            let currentStepId = 0;

            await llm.stream(messagesForLLM, (chunk) => {
                fullResponse += chunk;
                setThinkingPreview(fullResponse);
                
                setMessages(prev => prev.map(m => 
                    m.id === assistantMessage.id 
                        ? { ...m, content: stripToolCalls(fullResponse, parseToolCalls(fullResponse)) }
                        : m
                ));
            }, controller.signal);

            setThinkingPreview('');
            addStep('success', 'Response complete');

            const toolCalls = parseToolCalls(fullResponse);

            if (toolCalls.length > 0) {
                addStep('tool-call', `Executing ${toolCalls.length} tool(s)...`);
                
                for (const toolCall of toolCalls) {
                    iterCount++;
                    if (iterCount > MAX_ITER) {
                        addStep('error', 'Maximum iterations reached', 'Stopped to prevent infinite loops');
                        break;
                    }

                    currentStepId++;
                    addStep('tool-call', `Running: ${toolCall.tool}`, JSON.stringify(toolCall.args), toolCall.tool);
                    
                    try {
                        const result = await executeTool(toolCall, getToolContext());
                        
                        if (result.success) {
                            addStep('tool-result', `${toolCall.tool} completed`, result.message.substring(0, 500));
                        } else {
                            addStep('tool-error', `${toolCall.tool} failed`, result.message);
                        }

                        fullResponse += `\n\n[${toolCall.tool}: ${result.message}]`;
                        
                        const toolResultMessage: Message = {
                            id: `tool-${Date.now()}-${Math.random()}`,
                            role: 'assistant',
                            content: `\n\n**Tool: ${toolCall.tool}**\n${result.message}`,
                            timestamp: Date.now()
                        };
                        setMessages(prev => [...prev, toolResultMessage]);

                    } catch (error: any) {
                        addStep('tool-error', `Error in ${toolCall.tool}`, error.message);
                    }
                }
            }

            setMessages(prev => prev.map(m => 
                m.id === assistantMessage.id 
                    ? { ...m, content: fullResponse, isStreaming: false, steps: [...currentSteps] }
                    : m
            ));

        } catch (error: any) {
            if (error.name === 'AbortError') {
                setMessages(prev => prev.map(m => 
                    m.id === assistantMessage.id 
                        ? { ...m, content: fullResponse + '\n\n*[Generation stopped]*', isStreaming: false }
                        : m
                ));
                addStep('info', 'Generation stopped by user');
            } else {
                setMessages(prev => prev.map(m => 
                    m.id === assistantMessage.id 
                        ? { ...m, content: `Error: ${error.message}`, isStreaming: false }
                        : m
                ));
                addStep('error', 'Error', error.message);
            }
        } finally {
            setIsStreaming(false);
            setAbortController(null);
            setMessages(prev => prev.map(m => 
                m.id === assistantMessage.id 
                    ? { ...m, steps: [...currentSteps], isStreaming: false }
                    : m
            ));
        }
    }, [messages, workspacePath, toolsPrompt, getToolContext, currentSteps, addStep]);

    const handleSubmit = useCallback((e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isStreaming) return;
        runAI(input.trim());
        setInput('');
    }, [input, isStreaming, runAI]);

    const handleStop = useCallback(() => {
        abortController?.abort();
    }, [abortController]);

    const handleClear = useCallback(() => {
        setMessages([{
            id: 'welcome',
            role: 'assistant',
            content: '# Welcome to Neuro Chat\n\nI\'m your AI assistant powered by **agentic AI**. Start typing to begin...',
            timestamp: Date.now()
        }]);
        setCurrentSteps([]);
    }, []);

    const toggleStepExpand = useCallback((stepId: number) => {
        setExpandedSteps(prev => {
            const next = new Set(prev);
            if (next.has(stepId)) {
                next.delete(stepId);
            } else {
                next.add(stepId);
            }
            return next;
        });
    }, []);

    return (
        <div className="flex flex-col h-full bg-white text-zinc-900 font-mono">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 bg-zinc-50">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-900 text-white flex items-center justify-center rounded-lg">
                        <BrainCircuit size={18} />
                    </div>
                    <div>
                        <h1 className="text-sm font-semibold tracking-tight">Neuro Chat</h1>
                        <p className="text-[10px] text-zinc-500">Agentic AI Assistant</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowTools(!showTools)}
                        className={cn(
                            "px-3 py-1.5 text-xs rounded-lg border transition-all",
                            showTools ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                        )}
                    >
                        Tools ({allTools.length})
                    </button>
                    <button
                        onClick={handleClear}
                        className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                        title="Clear chat"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Tools Panel */}
            <AnimatePresence>
                {showTools && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-b border-zinc-200 bg-zinc-50 overflow-hidden"
                    >
                        <div className="p-4 max-h-48 overflow-y-auto">
                            <div className="grid grid-cols-4 gap-2">
                                {allTools.map(tool => (
                                    <div
                                        key={tool.name}
                                        className="px-2 py-1.5 bg-white border border-zinc-200 rounded text-[10px] text-zinc-600 truncate"
                                        title={tool.description}
                                    >
                                        {tool.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(message => (
                    <div key={message.id} className={cn(
                        "group",
                        message.role === 'user' ? "ml-auto max-w-[85%]" : "max-w-full"
                    )}>
                        <div className={cn(
                            "flex gap-2",
                            message.role === 'user' ? "flex-row-reverse" : "flex-row"
                        )}>
                            <div className={cn(
                                "w-6 h-6 rounded flex items-center justify-center shrink-0 text-[10px]",
                                message.role === 'user' ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
                            )}>
                                {message.role === 'user' ? <User size={12} /> : <BrainCircuit size={12} />}
                            </div>
                            
                            <div className={cn(
                                "flex-1 min-w-0",
                                message.role === 'user' ? "text-right" : "text-left"
                            )}>
                                <div className={cn(
                                    "inline-block max-w-full px-4 py-3 rounded-xl text-sm leading-relaxed text-left",
                                    message.role === 'user' 
                                        ? "bg-zinc-900 text-white" 
                                        : "bg-zinc-50 text-zinc-900 border border-zinc-200"
                                )}>
                                    {message.role === 'assistant' ? (
                                        <Markdown
                                            components={{
                                                code: ({ className, children, ...props }) => {
                                                    const match = /language-(\w+)/.exec(className || '');
                                                    return match ? (
                                                        <pre className="bg-zinc-900 text-zinc-100 p-3 rounded-lg overflow-x-auto text-xs my-2">
                                                            <code {...props}>{children}</code>
                                                        </pre>
                                                    ) : (
                                                        <code className="bg-zinc-200 px-1 py-0.5 rounded text-xs" {...props}>{children}</code>
                                                    );
                                                }
                                            }}
                                        >
                                            {message.content || (message.isStreaming ? '...' : '')}
                                        </Markdown>
                                    ) : (
                                        <p className="whitespace-pre-wrap">{message.content}</p>
                                    )}
                                    
                                    {message.isStreaming && (
                                        <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse ml-1" />
                                    )}
                                </div>
                                
                                <div className="flex items-center justify-between mt-1 px-1">
                                    <span className="text-[10px] text-zinc-400">
                                        {formatTimestamp(message.timestamp)}
                                    </span>
                                    {message.role === 'assistant' && (
                                        <button
                                            onClick={() => handleCopy(message.content, message.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600"
                                        >
                                            {copiedId === message.id ? <Check size={12} /> : <Copy size={12} />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Steps/Thinking Preview for Assistant Messages */}
                        {message.role === 'assistant' && message.steps && message.steps.length > 0 && (
                            <div className="ml-8 mt-2 space-y-1">
                                {message.steps.map((step, idx) => {
                                    const cfg = kindConfig[step.kind];
                                    const isExpanded = expandedSteps.has(step.id);
                                    
                                    return (
                                        <motion.div
                                            key={step.id}
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className={cn(
                                                "border rounded-lg overflow-hidden text-xs",
                                                cfg.bg, cfg.border
                                            )}
                                        >
                                            <button
                                                onClick={() => toggleStepExpand(step.id)}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/5"
                                            >
                                                <cfg.icon size={12} className={cfg.color} />
                                                <span className="flex-1 truncate">{step.text}</span>
                                                {step.detail && (
                                                    isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                                )}
                                            </button>
                                            
                                            <AnimatePresence>
                                                {isExpanded && step.detail && (
                                                    <motion.div
                                                        initial={{ height: 0 }}
                                                        animate={{ height: 'auto' }}
                                                        exit={{ height: 0 }}
                                                        className="px-3 pb-2 overflow-hidden"
                                                    >
                                                        <pre className="text-[10px] text-zinc-600 whitespace-pre-wrap bg-white/50 p-2 rounded">
                                                            {step.detail}
                                                        </pre>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}

                {/* Live Thinking Preview */}
                {thinkingPreview && (
                    <div className="ml-8 mt-2 p-3 bg-zinc-100 border border-zinc-200 rounded-lg">
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                            <Loader2 size={12} className="animate-spin" />
                            <span>Thinking...</span>
                        </div>
                        <pre className="text-xs text-zinc-600 whitespace-pre-wrap font-mono">
                            {thinkingPreview.slice(-500)}
                        </pre>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-zinc-200 p-4 bg-white">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit();
                                }
                            }}
                            placeholder="Type your message... (Shift+Enter for new line)"
                            className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm resize-none focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200"
                            rows={2}
                            disabled={isStreaming}
                        />
                        <div className="absolute bottom-2 right-2 text-[10px] text-zinc-400">
                            {input.length} chars
                        </div>
                    </div>
                    
                    {isStreaming ? (
                        <button
                            type="button"
                            onClick={handleStop}
                            className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
                        >
                            <Pause size={18} />
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={!input.trim()}
                            className="px-4 py-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send size={18} />
                        </button>
                    )}
                </form>
                
                <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400">
                    <span>Press Enter to send, Shift+Enter for new line</span>
                    <span>{allTools.length} tools available</span>
                </div>
            </div>
        </div>
    );
};
