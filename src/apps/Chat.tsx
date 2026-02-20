import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, BrainCircuit, User, Eraser, StopCircle, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettingsStore } from '../stores/settingsStore';
import { getLLMProvider } from '../lib/llm/factory';
import { useOS, OSAppWindow } from '../hooks/useOS';
import Markdown from 'react-markdown';
import { APPS_CONFIG } from '../lib/apps';
import { motion } from 'motion/react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useFileSystem } from '../hooks/useFileSystem';

interface ChatAppProps {
    windowData: OSAppWindow;
}

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    isStreaming?: boolean;
}

const controlTools = [
    {
        name: "open_app",
        description: "Opens a system application by its ID.",
        parameters: {
            app_id: {
                type: "string",
                description: `The ID of the app to open. Available: ${Object.keys(APPS_CONFIG).join(', ')}`,
                enum: Object.keys(APPS_CONFIG)
            }
        },
        required: ["app_id"]
    },
    {
        name: "list_running_apps",
        description: "Returns a list of currently open windows and their IDs.",
        parameters: {}
    },
    {
        name: "save_file",
        description: "Saves a file with the given name and content to the user's workspace folder. Use this when asked to generate code, scripts, documents or any file. The filename should include the proper extension (e.g. 'app.py', 'notes.md', 'config.json').",
        parameters: {
            filename: { type: "string", description: "The file name including extension, e.g. 'hello.py'" },
            content: { type: "string", description: "The full content to write to the file" }
        },
        required: ["filename", "content"]
    },
    {
        name: "list_workspace_files",
        description: "Lists the files and folders in the user's current workspace.",
        parameters: {}
    }
];

export const ChatApp: React.FC<ChatAppProps> = ({ windowData }) => {
    const { aiConfig } = useSettingsStore();
    const { openApp, appWindows } = useOS();
    const { workspacePath } = useWorkspaceStore();
    const { writeFile, listFiles } = useFileSystem();
    const [savedFiles, setSavedFiles] = useState<string[]>([]);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: `Hello! I'm **Neuro AI**, your OS core assistant, powered by **${aiConfig.activeProviderId}**.\n\nI can open apps, generate and save files to your workspace, and answer questions. What can I do for you?`,
            timestamp: Date.now()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const lastProcessedAction = useRef<number>(0);

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

    const handleAction = async (name: string, args: any): Promise<string> => {
        switch (name) {
            case 'open_app':
                const app = APPS_CONFIG[args.app_id];
                if (app) {
                    openApp(app.id, app.name);
                    return `Successfully launched **${app.name}**.`;
                }
                return `Could not find app with ID "${args.app_id}".`;
            case 'list_running_apps':
                if (appWindows.length === 0) return "No applications are currently running.";
                const list = appWindows.map(w => `• **${w.title}** (ID: \`${w.id}\`)`).join('\n');
                return `Currently running:\n${list}`;
            case 'save_file': {
                if (!workspacePath) {
                    return 'No workspace is set. Please open File Explorer and select a workspace folder first.';
                }
                const sep = workspacePath.includes('/') ? '/' : '\\';
                const filePath = `${workspacePath}${sep}${args.filename}`;
                try {
                    await writeFile(filePath, args.content);
                    setSavedFiles(prev => [...prev, args.filename]);
                    return `✅ Saved **${args.filename}** to your workspace at \`${filePath}\``;
                } catch (e: any) {
                    return `❌ Failed to save file: ${e.message}`;
                }
            }
            case 'list_workspace_files': {
                if (!workspacePath) {
                    return 'No workspace is set. Please open File Explorer and select a workspace folder first.';
                }
                try {
                    const entries = await listFiles(workspacePath);
                    if (!entries.length) return 'The workspace is empty.';
                    return `Workspace \`${workspacePath}\` contains:\n` + entries.map((e: any) => `• ${e.isDirectory ? '📁' : '📄'} ${e.name}`).join('\n');
                } catch (e: any) {
                    return `❌ Could not list workspace: ${e.message}`;
                }
            }
            default:
                return "That system action was not recognized.";
        }
    };

    const handleSend = useCallback(async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        // Placeholder streaming message
        const assistantMsgId = Date.now();
        setMessages(prev => [...prev, {
            role: 'assistant',
            content: '',
            timestamp: assistantMsgId,
            isStreaming: true
        }]);

        const controller = new AbortController();
        setAbortController(controller);

        try {
            const llm = getLLMProvider();

            const systemPrompt = `You are Neuro AI, the intelligent core of NeuroOS — a futuristic operating system.
You have full control over the OS interface and can launch applications.

Available Tools (call with JSON block only when action is needed):
${controlTools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

To call a tool, output ONLY this JSON (nothing else around it):
{ "tool": "tool_name", "args": { "key": "value" } }

Personality: Precise, intelligent, and helpful. Confirm actions clearly. Use markdown for clarity.`;

            const conversation = [
                { role: 'system' as const, content: systemPrompt },
                // Build context from previous non-streaming messages
                ...messages
                    .filter(m => !m.isStreaming && m.role !== 'system')
                    .map(m => ({ role: m.role, content: m.content })),
                { role: 'user' as const, content: text }
            ];

            let fullContent = '';

            // Use streaming if available
            if (llm.stream) {
                await llm.stream(conversation, (chunk: string) => {
                    fullContent += chunk;
                    setMessages(prev => prev.map(m =>
                        m.timestamp === assistantMsgId
                            ? { ...m, content: fullContent, isStreaming: true }
                            : m
                    ));
                });
            } else {
                const response = await llm.chat(conversation);
                fullContent = response.content;
            }

            // Check for tool call in final response
            try {
                const jsonMatch = fullContent.match(/\{[\s\S]*?\}/);
                if (jsonMatch) {
                    const toolCall = JSON.parse(jsonMatch[0]);
                    if (toolCall.tool && toolCall.args !== undefined) {
                        const result = await handleAction(toolCall.tool, toolCall.args);

                        // Get a follow-up confirmation from the AI
                        const followUpConversation = [
                            ...conversation,
                            { role: 'assistant' as const, content: fullContent },
                            { role: 'user' as const, content: `System executed. Result: ${result}. Please give a concise, friendly confirmation to the user.` }
                        ];

                        fullContent = '';
                        if (llm.stream) {
                            await llm.stream(followUpConversation, (chunk: string) => {
                                fullContent += chunk;
                                setMessages(prev => prev.map(m =>
                                    m.timestamp === assistantMsgId
                                        ? { ...m, content: fullContent, isStreaming: true }
                                        : m
                                ));
                            });
                        } else {
                            const finalResponse = await llm.chat(followUpConversation);
                            fullContent = finalResponse.content;
                        }
                    }
                }
            } catch (e) {
                // Not a tool call
            }

            // Mark streaming as complete
            setMessages(prev => prev.map(m =>
                m.timestamp === assistantMsgId
                    ? { ...m, content: fullContent, isStreaming: false }
                    : m
            ));

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
    }, [isLoading, messages, appWindows, openApp]);

    const handleStop = () => {
        abortController?.abort();
        setIsLoading(false);
        // Mark current streaming message as done
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

                        {/* Bubble */}
                        <div className={cn(
                            "relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed max-w-[85%]",
                            msg.role === 'user'
                                ? "bg-zinc-900 text-white rounded-tr-sm"
                                : "bg-zinc-50 border border-zinc-100 text-zinc-800 rounded-tl-sm"
                        )}>
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

                        {/* User Avatar */}
                        {msg.role === 'user' && (
                            <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
                                <User size={14} />
                            </div>
                        )}
                    </div>
                ))}

                {/* Loading dots (before first stream token) */}
                {isLoading && messages[messages.length - 1]?.content === '' && (
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
