import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    Send, BrainCircuit, User, Eraser, Loader2, Sparkles, X, Pause, Play,
    ChevronDown, ChevronUp, Trash2, Copy, Check, FileText, Image as ImageIcon,
    Wifi, WifiOff, Users, MessageCircle, Hash, Volume2, VolumeX, SkipBack, SkipForward,
    AlertCircle, AlertTriangle, Lock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { showContextMenu } from '../components/ContextMenu';
import { useSettingsStore } from '../stores/settingsStore';
import { useComposioStore } from '../stores/composioStore';
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
import { getUserFriendlyError } from '../lib/llm/errors';


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
    error?: string;
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
    const [errorModal, setErrorModal] = useState<{ show: boolean; title: string; message: string } | null>(null);
    const [confirmationPending, setConfirmationPending] = useState<{ toolName: string; args: Record<string, any>; resolve: (confirmed: boolean) => void } | null>(null);
    const [permissionPending, setPermissionPending] = useState<{ toolId: string; toolName: string; appId: string; resolve: (authorized: boolean) => void } | null>(null);

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

    const confirmToolExecution = useCallback((toolName: string, args: Record<string, any>): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmationPending({ toolName, args, resolve });
        });
    }, []);

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
            
            // Check if we got any response
            if (!fullResponse.trim()) {
                const errorMsg = 'No response received from AI. Please try again.';
                setErrorModal({
                    show: true,
                    title: 'No Response',
                    message: errorMsg
                });
                addStep('error', 'No response', errorMsg);
                setMessages(prev => prev.map(m => 
                    m.id === assistantMessage.id 
                        ? { ...m, content: errorMsg, isStreaming: false }
                        : m
                ));
                setIsStreaming(false);
                return;
            }
            
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
                    
                    let retryCount = 0;
                    const maxRetries = 2;
                    let toolResult: any = null;
                    
                    // Retry mechanism for failed tools
                    while (retryCount <= maxRetries) {
                        try {
                            toolResult = await executeTool(toolCall, getToolContext(), confirmToolExecution);

                            // Check if tool requires permission (Composio)
                            if (!toolResult.success && toolResult.data?.requiresPermission) {
                                addStep('info', `Tool requires authorization`, `"${toolResult.data.toolName}" needs permission to use ${toolResult.data.appId}`);

                                // Show permission dialog
                                const permissionGranted = await new Promise<boolean>((resolve) => {
                                    setPermissionPending({
                                        toolId: toolResult.data.toolId,
                                        toolName: toolResult.data.toolName,
                                        appId: toolResult.data.appId,
                                        resolve
                                    });
                                });

                                if (permissionGranted) {
                                    addStep('tool-call', `Retrying ${toolCall.tool} with permission...`);
                                    continue; // Retry the tool
                                } else {
                                    toolResult = { success: false, message: `Tool authorization cancelled by user` };
                                    break;
                                }
                            }

                            if (toolResult.success) {
                                addStep('tool-result', `${toolCall.tool} completed`, toolResult.message.substring(0, 500));
                                break; // Success, exit retry loop
                            } else {
                                retryCount++;
                                if (retryCount <= maxRetries) {
                                    addStep('tool-call', `${toolCall.tool} failed, retrying... (${retryCount}/${maxRetries})`, toolResult.message);
                                    await new Promise(r => setTimeout(r, 1000)); // Wait before retry
                                }
                            }
                        } catch (error: any) {
                            retryCount++;
                            if (retryCount <= maxRetries) {
                                addStep('tool-call', `${toolCall.tool} error, retrying... (${retryCount}/${maxRetries})`, error.message);
                                await new Promise(r => setTimeout(r, 1000));
                            } else {
                                toolResult = { success: false, message: `Tool failed after ${maxRetries} retries: ${error.message}` };
                            }
                        }
                    }
                    
                    if (toolResult) {
                        fullResponse += `\n\n[${toolCall.tool}: ${toolResult.message}]`;
                        
                        const toolResultMessage: Message = {
                            id: `tool-${Date.now()}-${Math.random()}`,
                            role: 'assistant',
                            content: `\n\n**Tool: ${toolCall.tool}**\n${toolResult.message}`,
                            timestamp: Date.now()
                        };
                        setMessages(prev => [...prev, toolResultMessage]);
                    }
                }
            } else {
                // No tool calls found, but we have response content
                addStep('info', 'Response ready', fullResponse.slice(0, 200));
            }

            // Check if the response contains error messages from the AI
            const errorPatterns: RegExp[] = [
                /cannot read.*image/i,
                /does not support image/i,
                /image.*input/i,
                /vision.*not supported/i,
                /error.*tool/i,
                /tool.*failed/i
            ];
            
            const containsError = errorPatterns.some(pattern => pattern.test(fullResponse) && fullResponse.length < 500);
            
            // Final check - if message is still empty
            if (!fullResponse.trim()) {
                const errorMsg = 'The AI returned an empty response. This might be due to a configuration issue or the model not responding properly.';
                setErrorModal({
                    show: true,
                    title: 'Empty Response',
                    message: errorMsg
                });
                addStep('error', 'Empty response', errorMsg);
            } else if (containsError) {
                // AI responded with an error message - show it in modal
                setErrorModal({
                    show: true,
                    title: 'AI Response',
                    message: fullResponse.trim()
                });
                addStep('error', 'AI Error', fullResponse.slice(0, 300));
            }

            setMessages(prev => prev.map(m => 
                m.id === assistantMessage.id 
                    ? { ...m, content: fullResponse, isStreaming: false, steps: [...currentSteps] }
                    : m
            ));

        } catch (error: any) {
            console.error('Chat Error:', error);
            
            if (error.name === 'AbortError') {
                setMessages(prev => prev.map(m => 
                    m.id === assistantMessage.id 
                        ? { ...m, content: fullResponse + '\n\n*[Generation stopped]*', isStreaming: false }
                        : m
                ));
                addStep('info', 'Generation stopped by user');
            } else {
                const errorMessage = getUserFriendlyError(error);

                
                // Show error modal
                setErrorModal({
                    show: true,
                    title: 'Error',
                    message: errorMessage
                });
                
                setMessages(prev => prev.map(m => 
                    m.id === assistantMessage.id 
                        ? { ...m, content: `❌ Error: ${errorMessage}`, isStreaming: false, error: errorMessage }
                        : m
                ));
                addStep('error', 'Error', errorMessage);
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
            {/* Error Modal */}
            <AnimatePresence>
                {errorModal?.show && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                        onClick={() => setErrorModal(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                                    <AlertCircle size={24} className="text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-zinc-900 mb-2">{errorModal.title}</h3>
                                    <p className="text-sm text-zinc-600 mb-4">{errorModal.message}</p>
                                    <div className="flex gap-2 justify-end">
                                        <button
                                            onClick={() => setErrorModal(null)}
                                            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tool Confirmation Modal */}
            <AnimatePresence>
                {confirmationPending && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
                        >
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center shrink-0">
                                    <AlertTriangle size={24} className="text-yellow-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-zinc-900">Confirm Tool Execution</h3>
                                    <p className="text-sm text-zinc-600 mt-1">
                                        The AI wants to run: <span className="font-semibold text-zinc-900">{confirmationPending.toolName}</span>
                                    </p>
                                </div>
                            </div>
                            {Object.keys(confirmationPending.args).length > 0 && (
                                <div className="bg-zinc-50 rounded-lg p-3 mb-4 max-h-24 overflow-auto">
                                    <p className="text-xs font-medium text-zinc-700 mb-2">Arguments:</p>
                                    <pre className="text-xs text-zinc-600 whitespace-pre-wrap break-words">
                                        {JSON.stringify(confirmationPending.args, null, 2)}
                                    </pre>
                                </div>
                            )}
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => {
                                        confirmationPending?.resolve(false);
                                        setConfirmationPending(null);
                                    }}
                                    className="px-4 py-2 bg-zinc-200 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        confirmationPending?.resolve(true);
                                        setConfirmationPending(null);
                                    }}
                                    className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-medium hover:bg-zinc-800"
                                >
                                    Confirm
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tool Permission Modal */}
            <AnimatePresence>
                {permissionPending && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
                        >
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                                    <Lock size={24} className="text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-zinc-900">Authorize Tool</h3>
                                    <p className="text-sm text-zinc-600 mt-1">
                                        <span className="font-semibold text-zinc-900">"{permissionPending.toolName}"</span> requires authorization
                                    </p>
                                </div>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                <p className="text-sm text-blue-900">
                                    This tool needs permission to access {permissionPending.appId}. You'll be taken to authorize this connection.
                                </p>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={() => {
                                        permissionPending?.resolve(false);
                                        setPermissionPending(null);
                                    }}
                                    className="px-4 py-2 bg-zinc-200 text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        permissionPending?.resolve(true);
                                        setPermissionPending(null);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                >
                                    Authorize
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                {/* Thinking Display */}
                <AnimatePresence>
                    {isStreaming && thinkingPreview && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="max-w-full"
                        >
                            <div className="flex gap-2">
                                <div className="w-6 h-6 rounded flex items-center justify-center shrink-0 text-[10px] bg-blue-100 text-blue-600">
                                    <Sparkles size={12} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="inline-block max-w-full px-4 py-3 rounded-xl text-sm leading-relaxed text-left bg-blue-50 text-blue-900 border border-blue-200">
                                        <div className="text-xs font-semibold text-blue-700 mb-2">🧠 Thinking...</div>
                                        <div>
                                            <Markdown
                                                components={{
                                                    code: ({ className, children, ...props }) => (
                                                        <code className="bg-blue-200 px-1 py-0.5 rounded text-xs" {...props}>{children}</code>
                                                    )
                                                }}
                                            >
                                                {(thinkingPreview.slice(0, 500) + (thinkingPreview.length > 500 ? '...' : ''))}
                                            </Markdown>
                                            <motion.span
                                                animate={{ opacity: [1, 0.5, 1] }}
                                                transition={{ duration: 0.8, repeat: Infinity }}
                                                className="inline-block w-1 h-4 bg-blue-600 ml-1 align-text-top"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

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
                                        <>
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
                                                {message.content || (message.isStreaming ? '' : '')}
                                            </Markdown>
                                            {message.isStreaming && (
                                                <motion.span
                                                    animate={{ opacity: [1, 0.5, 1] }}
                                                    transition={{ duration: 0.8, repeat: Infinity }}
                                                    className="inline-block w-1 h-4 bg-zinc-600 ml-1"
                                                />
                                            )}
                                        </>
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
