import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, X, Copy, Check, Sparkles, Wrench, ChevronDown, ChevronUp, StopCircle, Brain, Bot, User, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import { useComposioStore } from '../stores/composioStore';
import { getLLMProvider } from '../lib/llm/factory';
import { useOS, OSAppWindow } from '../hooks/useOS';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useSettingsStore } from '../stores/settingsStore';
import { parseToolCalls, executeTool, stripToolCalls, ToolContext, getAllTools, getToolsForPrompt } from '../lib/ai';
import { getUserFriendlyError } from '../lib/llm/errors';
import { getComposioToolsForPrompt, loadComposioTools } from '../lib/ai/tools/composioTools';
import { VISION_MODELS } from '../lib/llm/types';

interface ChatAppProps { windowData: OSAppWindow; }

interface ThinkingBlock {
    id: string;
    type: 'thought' | 'plan' | 'tool_call' | 'tool_result' | 'tool_error' | 'synthesis' | 'agent';
    content: string;
    detail?: string;
    tool?: string;
    agent?: string;
    timestamp: number;
    duration?: number;
}

interface ToolSummaryItem {
    tool: string;
    status: 'success' | 'error';
    preview: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    isStreaming?: boolean;
    thinking?: ThinkingBlock[];
    toolSummary?: ToolSummaryItem[];
    agentUsed?: string;
}

const MAX_CREW_ITERATIONS = 12;

// ─── Crew AI Agent Prompts ──────────────────────────────────────────
const AGENT_PROMPTS = {
    coordinator: `You are the Coordinator agent. Your job is to orchestrate the workflow by delegating tasks to the right tools and synthesizing results into a clear response.
You think step-by-step, break complex requests into sub-tasks, and coordinate tool usage efficiently.
Always explain your reasoning before calling tools.`,

    researcher: `You are the Researcher agent. You gather information from the web, scrape pages, and retrieve data.
You use browser_navigate, browser_scrape, web_fetch, and search_web tools effectively.`,

    executor: `You are the Executor agent. You perform actions: create files, run commands, execute tasks.
You use save_file, run_shell, open_app, and similar tools effectively.`,

    analyst: `You are the Analyst agent. You review results, identify patterns, and provide insights.
You synthesize information and present findings clearly.`,
};

// ─── Components ─────────────────────────────────────────────────────

const TypingDots = () => (
    <div className="flex gap-1.5 items-center py-2">
        {[0, 1, 2].map(i => (
            <motion.div key={i} className="w-1 h-1 rounded-full bg-zinc-400"
                animate={{ opacity: [0.2, 0.8, 0.2] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.25 }} />
        ))}
    </div>
);

const ThinkingBlockView: React.FC<{
    block: ThinkingBlock;
    expanded: boolean;
    onToggle: () => void;
    isDark: boolean;
}> = ({ block, expanded, onToggle, isDark }) => {
    const icons: Record<string, React.ReactNode> = {
        thought: <Brain size={11} />,
        plan: <Brain size={11} />,
        tool_call: <Wrench size={11} />,
        tool_result: <Check size={11} />,
        tool_error: <X size={11} />,
        synthesis: <Sparkles size={11} />,
        agent: <Bot size={11} />,
    };

    const labels: Record<string, string> = {
        thought: 'Thinking',
        plan: 'Planning',
        tool_call: 'Tool Call',
        tool_result: 'Tool Result',
        tool_error: 'Tool Error',
        synthesis: 'Synthesis',
        agent: 'Agent',
    };

    const isLive = block.type === 'thought' && !block.duration;

    return (
        <motion.div
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "rounded-lg overflow-hidden transition-colors",
                isDark ? "bg-white/[0.03]" : "bg-black/[0.02]"
            )}
        >
            <button onClick={onToggle}
                className={cn("w-full flex items-center gap-2 px-3 py-2 text-left text-[11px]", isDark ? "hover:bg-white/[0.05]" : "hover:bg-black/[0.03]")}>
                <span className={cn("shrink-0 opacity-50", isDark ? "text-zinc-400" : "text-zinc-500")}>{icons[block.type]}</span>
                <span className={cn("flex-1 truncate", isDark ? "text-zinc-400" : "text-zinc-500")}>
                    {block.agent && <span className="opacity-60">[{block.agent}] </span>}
                    {block.content}
                </span>
                {isLive && (
                    <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-1 h-1 rounded-full bg-zinc-500" />
                )}
                {block.detail && (
                    <ChevronDown size={11} className={cn("shrink-0 opacity-30 transition-transform", expanded && "rotate-180")} />
                )}
                {block.duration && (
                    <span className={cn("text-[9px] opacity-30", isDark ? "text-zinc-500" : "text-zinc-400")}>{block.duration}ms</span>
                )}
            </button>
            <AnimatePresence>
                {expanded && block.detail && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className={cn("px-3 pb-2 text-[10px] whitespace-pre-wrap break-words max-h-48 overflow-y-auto", isDark ? "text-zinc-500" : "text-zinc-400")}>
                            {block.detail}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const ToolSummaryView: React.FC<{ items: ToolSummaryItem[]; isDark: boolean }> = ({ items, isDark }) => (
    <div className={cn("flex flex-wrap gap-1.5 mt-2")}>
        {items.map((item, i) => (
            <div key={i} className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px]",
                isDark ? "bg-white/[0.04] text-zinc-500" : "bg-black/[0.03] text-zinc-400"
            )}>
                <Wrench size={9} className="opacity-50" />
                <span className="font-mono">{item.tool}</span>
                <span className={cn("opacity-40", item.status === 'error' && "text-red-400")}>
                    {item.status === 'success' ? '✓' : '✗'}
                </span>
            </div>
        ))}
    </div>
);

// ─── Main App ───────────────────────────────────────────────────────

export const ChatApp: React.FC<ChatAppProps> = ({ windowData }) => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [expandedThinking, setExpandedThinking] = useState<Set<string>>(new Set());
    const [showAllThinking, setShowAllThinking] = useState(false);
    const [imageInput, setImageInput] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { workspacePath } = useWorkspaceStore();
    const { openApp, appWindows, closeWindow, sendAppAction } = useOS();
    const { isAuthenticated: isComposioAuth } = useComposioStore();
    const { theme } = useSettingsStore();

    const allTools = useMemo(() => getAllTools(), []);
    const toolsPrompt = useMemo(() => getToolsForPrompt(), []);
    const composioToolsPrompt = useMemo(() => getComposioToolsForPrompt(), [isComposioAuth]);

    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    useEffect(() => { if (isComposioAuth) loadComposioTools(); }, [isComposioAuth]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const checkVisionSupport = useCallback((): boolean => {
        try {
            const { aiConfig } = useSettingsStore.getState();
            const provider = aiConfig.providers?.find((p: any) => p.id === aiConfig.activeProviderId);
            if (!provider) return false;
            const model = provider.selectedModel?.toLowerCase() || '';
            const visionList = VISION_MODELS[provider.type as keyof typeof VISION_MODELS] || [];
            return visionList.some(v => model.includes(v.toLowerCase()));
        } catch { return false; }
    }, []);

    const getToolContext = useCallback((): ToolContext => ({
        openApp: (id, name) => openApp(id, name),
        closeWindow: (id) => closeWindow(id),
        sendAppAction: (idOrComponent, type, payload) => sendAppAction(idOrComponent, type, payload),
        getAppWindows: () => appWindows,
        appWindows: appWindows.filter(w => w.component !== 'chat'),
        workspacePath,
        writeFile: async (path, content) => { const e = (window as any).electron; if (e?.fileSystem?.write) await e.fileSystem.write(path, content); },
        readFile: async (path) => { const e = (window as any).electron; if (e?.fileSystem?.read) return await e.fileSystem.read(path); throw new Error('File system not available'); },
        listFiles: async (path) => { const e = (window as any).electron; if (e?.fileSystem?.list) return await e.fileSystem.list(path); return []; },
        createDir: async (path) => { const e = (window as any).electron; if (e?.fileSystem?.createDir) await e.fileSystem.createDir(path); },
        deleteFile: async (path) => { const e = (window as any).electron; if (e?.fileSystem?.delete) await e.fileSystem.delete(path); },
        addMessage: () => {},
        updateMemory: (key, value) => {},
    }), [openApp, closeWindow, sendAppAction, appWindows, workspacePath]);

    const handleCopy = useCallback((content: string, id: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    }, []);

    const toggleThinking = useCallback((id: string) => {
        setExpandedThinking(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    }, []);

    // ─── CrewAI Agentic Loop ─────────────────────────────────────────
    const runCrewAgent = useCallback(async (userInput: string, image?: string | null) => {
        const userMessage: Message = { id: `u-${Date.now()}`, role: 'user', content: userInput, timestamp: Date.now() };
        const assistantId = `a-${Date.now()}`;
        const assistantMessage: Message = { id: assistantId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true, thinking: [], toolSummary: [] };

        setMessages(prev => [...prev, userMessage, assistantMessage]);
        setIsStreaming(true);

        const controller = new AbortController();
        setAbortController(controller);

        const thinking: ThinkingBlock[] = [];
        const toolSummary: ToolSummaryItem[] = [];

        const addBlock = (type: ThinkingBlock['type'], content: string, detail?: string, tool?: string, agent?: string) => {
            const block: ThinkingBlock = {
                id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                type, content, detail, tool, agent, timestamp: Date.now()
            };
            thinking.push(block);
            updateUI();
        };

        const completeBlock = (id: string, finalContent?: string) => {
            const block = thinking.find(b => b.id === id);
            if (block) {
                block.duration = Date.now() - block.timestamp;
                if (finalContent) block.content = finalContent;
            }
            updateUI();
        };

        const updateUI = () => {
            setMessages(prev => prev.map(m =>
                m.id === assistantId
                    ? { ...m, thinking: [...thinking], toolSummary: [...toolSummary] }
                    : m
            ));
        };

        // Phase 1: Coordinator analyzes the request
        addBlock('thought', 'Analyzing your request...');

        const systemPrompt = `You are Neuro, an intelligent agentic AI assistant powered by a CrewAI-style multi-agent system.

AVAILABLE TOOLS:
${toolsPrompt}
${composioToolsPrompt}

WORKSPACE: ${workspacePath || 'Not set'}

CREW AGENTS AVAILABLE:
${Object.entries(AGENT_PROMPTS).map(([role, desc]) => `- ${role}: ${desc.split('\n')[0]}`).join('\n')}

INSTRUCTIONS:
1. THINK step-by-step. Explain your reasoning before acting.
2. When you need a tool, respond with ONLY the JSON: {"tool": "name", "args": {...}}
3. You can chain MULTIPLE tools. After each result, decide next steps.
4. After all tools complete, SYNTHESIZE results into a clear summary.
5. For complex tasks, break them into sub-tasks and tackle each one.

TOOL FORMAT (respond with ONLY this JSON, no markdown):
{"tool": "tool_name", "args": {"param1": "value1"}}`;

        const conversationHistory = messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        const messagesForLLM: Array<{ role: 'system' | 'user' | 'assistant'; content: any }> = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory
        ];

        if (image && checkVisionSupport()) {
            messagesForLLM.push({ role: 'user', content: [{ type: 'text', text: userInput }, { type: 'image_url', image_url: { url: image } }] });
        } else if (image) {
            // Model doesn't support vision - send text only with a note
            addBlock('tool_error', 'Image attached but this model does not support vision analysis. Sending text only.');
            messagesForLLM.push({ role: 'user', content: `${userInput}\n\n[Note: An image was attached but this model (${useSettingsStore.getState().aiConfig.providers.find(p => p.id === useSettingsStore.getState().aiConfig.activeProviderId)?.selectedModel || 'unknown'}) does not support vision. Please inform the user to switch to a vision-capable model like gpt-4o, gemini-2.0-flash, or opencode-vision to analyze images.]` });
        } else {
            messagesForLLM.push({ role: 'user', content: userInput });
        }

        let fullResponse = '';
        let iteration = 0;

        try {
            const llm = getLLMProvider();
            let currentBlockId = thinking[thinking.length - 1]?.id;

            // Phase 2: Iterative agent execution
            while (iteration < MAX_CREW_ITERATIONS) {
                iteration++;
                let currentResponse = '';
                const startTime = Date.now();

                if (iteration > 1) {
                    addBlock('thought', `Iteration ${iteration}: Continuing analysis...`);
                    currentBlockId = thinking[thinking.length - 1]?.id;
                }

                // Stream LLM response
                await llm.stream(messagesForLLM, (chunk) => {
                    currentResponse += chunk;
                    fullResponse += chunk;

                    // Update thinking block with streaming content
                    if (currentBlockId) {
                        const block = thinking.find(b => b.id === currentBlockId);
                        if (block) {
                            const preview = currentResponse.slice(-80).replace(/\n/g, ' ').trim();
                            block.content = preview.length > 3 ? preview : block.content;
                        }
                    }

                    const displayContent = stripToolCalls(fullResponse, parseToolCalls(fullResponse));
                    setMessages(prev => prev.map(m =>
                        m.id === assistantId ? { ...m, content: displayContent, thinking: [...thinking] } : m
                    ));
                }, controller.signal);

                // Complete the thinking block
                if (currentBlockId) completeBlock(currentBlockId);

                // Parse tool calls
                const toolCalls = parseToolCalls(currentResponse);

                // No tool calls = final response
                if (toolCalls.length === 0) {
                    messagesForLLM.push({ role: 'assistant', content: currentResponse });

                    if (currentResponse.includes('"tool"')) {
                        const fixedCalls = parseToolCalls(currentResponse.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
                        if (fixedCalls.length > 0) continue;
                    }

                    addBlock('synthesis', 'Response complete');
                    break;
                }

                // Execute tool calls
                messagesForLLM.push({ role: 'assistant', content: currentResponse });

                for (const toolCall of toolCalls) {
                    const callId = `tc-${Date.now()}`;
                    addBlock('tool_call', `Executing: ${toolCall.tool}`, JSON.stringify(toolCall.args, null, 2), toolCall.tool);

                    const toolStartTime = Date.now();
                    try {
                        const result = await executeTool(toolCall, getToolContext());
                        const duration = Date.now() - toolStartTime;

                        if (result.success) {
                            addBlock('tool_result', `${toolCall.tool} completed (${duration}ms)`, result.message?.slice(0, 500), toolCall.tool);
                            toolSummary.push({ tool: toolCall.tool, status: 'success', preview: result.message?.slice(0, 60) || 'done' });
                        } else {
                            addBlock('tool_error', `${toolCall.tool} failed: ${result.message?.slice(0, 80)}`, result.message, toolCall.tool);
                            toolSummary.push({ tool: toolCall.tool, status: 'error', preview: result.message?.slice(0, 60) || 'failed' });
                        }

                        messagesForLLM.push({
                            role: 'user',
                            content: result.success
                                ? `Tool ${toolCall.tool} succeeded: ${result.message}`
                                : `Tool ${toolCall.tool} failed: ${result.message}`
                        });
                    } catch (err: any) {
                        addBlock('tool_error', `${toolCall.tool} error: ${err.message?.slice(0, 80)}`, err.message, toolCall.tool);
                        toolSummary.push({ tool: toolCall.tool, status: 'error', preview: err.message?.slice(0, 60) || 'error' });
                        messagesForLLM.push({ role: 'user', content: `Tool ${toolCall.tool} error: ${err.message}` });
                    }

                    updateUI();
                }

                fullResponse = '';
            }

            // Final synthesis
            setMessages(prev => prev.map(m =>
                m.id === assistantId
                    ? { ...m, content: m.content || 'Task completed.', isStreaming: false, thinking: [...thinking], toolSummary: [...toolSummary] }
                    : m
            ));

        } catch (error: any) {
            console.error('Crew Agent Error:', error);
            const errorMsg = error.name === 'AbortError' ? 'Stopped by user.' : getUserFriendlyError(error);
            addBlock('tool_error', errorMsg);
            setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content || errorMsg, isStreaming: false, thinking: [...thinking], toolSummary: [...toolSummary] } : m
            ));
        } finally {
            setIsStreaming(false);
            setAbortController(null);
        }
    }, [messages, workspacePath, toolsPrompt, composioToolsPrompt, getToolContext, checkVisionSupport]);

    const handleSubmit = useCallback((e?: React.FormEvent) => {
        e?.preventDefault?.();
        if ((!input.trim() && !imageInput) || isStreaming) return;
        runCrewAgent(input.trim() || 'Analyze this image', imageInput);
        setInput('');
        setImageInput(null);
    }, [input, imageInput, isStreaming, runCrewAgent]);

    const handleStop = useCallback(() => abortController?.abort(), [abortController]);
    const handleClear = useCallback(() => setMessages([]), []);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        for (const item of (e.clipboardData?.items || [])) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const blob = item.getAsFile();
                if (blob) { const r = new FileReader(); r.onload = () => setImageInput(r.result as string); r.readAsDataURL(blob); }
                break;
            }
        }
    }, []);

    return (
        <div className={cn("flex flex-col h-full font-sans", isDark ? "bg-zinc-950 text-zinc-100" : "bg-white text-zinc-900")}>
            {/* Header */}
            <div className={cn("flex items-center justify-between px-5 py-3 border-b", isDark ? "border-white/[0.06]" : "border-black/[0.06]")}>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
                        <Sparkles size={12} className="opacity-50" />
                    </div>
                    <span className="text-sm font-medium">Neuro</span>
                    <span className={cn("text-[9px] uppercase tracking-wider", isDark ? "text-zinc-600" : "text-zinc-400")}>crew-agentic</span>
                </div>
                <button onClick={handleClear} className={cn("text-[11px] px-2 py-1 rounded-md transition-colors", isDark ? "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-black/[0.03]")}>
                    New chat
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full px-6">
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
                            <Sparkles size={24} className="opacity-30" />
                        </div>
                        <h2 className={cn("text-lg font-medium mb-1.5", isDark ? "text-zinc-200" : "text-zinc-800")}>Crew Agent Ready</h2>
                        <p className={cn("text-xs text-center max-w-xs mb-6", isDark ? "text-zinc-600" : "text-zinc-400")}>
                            Multi-agent system with planning, research, execution, and analysis capabilities.
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 w-full max-w-sm">
                            {[
                                'Search and summarize web pages',
                                'Analyze and organize files',
                                'Execute complex multi-step tasks',
                                'Research and write reports',
                            ].map(s => (
                                <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                                    className={cn("text-left px-3 py-2.5 rounded-lg text-[11px] transition-colors", isDark ? "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300" : "text-zinc-400 hover:bg-black/[0.03] hover:text-zinc-600")}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
                        {messages.map(msg => (
                            <div key={msg.id} className={cn("group", msg.role === 'user' && "flex justify-end")}>
                                {msg.role === 'user' ? (
                                    <div className="max-w-[80%]">
                                        <div className={cn("rounded-xl px-3.5 py-2.5 text-sm", isDark ? "bg-white/[0.06]" : "bg-black/[0.04]")}>
                                            {msg.content}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Thinking blocks - expanded by default */}
                                        {msg.thinking && msg.thinking.length > 0 && (
                                            <div className="space-y-0.5">
                                                {/* Show first 3 or all if expanded */}
                                                {(showAllThinking ? msg.thinking : msg.thinking.slice(0, 3)).map(block => (
                                                    <ThinkingBlockView
                                                        key={block.id}
                                                        block={block}
                                                        expanded={expandedThinking.has(block.id)}
                                                        onToggle={() => toggleThinking(block.id)}
                                                        isDark={isDark}
                                                    />
                                                ))}
                                                {msg.thinking.length > 3 && (
                                                    <button onClick={() => setShowAllThinking(!showAllThinking)}
                                                        className={cn("text-[10px] px-2 py-1 rounded-md", isDark ? "text-zinc-600 hover:text-zinc-400" : "text-zinc-400 hover:text-zinc-600")}>
                                                        {showAllThinking ? 'Show less' : `Show all ${msg.thinking.length} steps`}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Tool Summary */}
                                        {msg.toolSummary && msg.toolSummary.length > 0 && (
                                            <ToolSummaryView items={msg.toolSummary} isDark={isDark} />
                                        )}

                                        {/* Main Response */}
                                        <div className={cn("text-sm leading-relaxed", isDark ? "text-zinc-300" : "text-zinc-700")}>
                                            {msg.isStreaming && !msg.content ? <TypingDots /> : (
                                                <Markdown components={{
                                                    code: ({ className, children, ...props }) => {
                                                        const match = /language-(\w+)/.exec(className || '');
                                                        return match ? (
                                                            <pre className={cn("p-2.5 rounded-lg overflow-x-auto text-[11px] my-1.5", isDark ? "bg-white/[0.04]" : "bg-black/[0.03]")}>
                                                                <code {...props}>{children}</code>
                                                            </pre>
                                                        ) : (
                                                            <code className={cn("px-1 py-0.5 rounded text-[11px]", isDark ? "bg-white/[0.06]" : "bg-black/[0.05]")} {...props}>{children}</code>
                                                        );
                                                    },
                                                    p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                                                    ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                                                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                                                    a: ({ href, children }) => <a href={href} className="underline opacity-80 hover:opacity-100" target="_blank" rel="noopener noreferrer">{children}</a>,
                                                }}>
                                                    {msg.content}
                                                </Markdown>
                                            )}
                                            {msg.isStreaming && msg.content && (
                                                <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.8, repeat: Infinity }}
                                                    className={cn("inline-block w-1 h-3.5 ml-0.5 rounded-sm", isDark ? "bg-zinc-500" : "bg-zinc-300")} />
                                            )}
                                        </div>

                                        {/* Copy */}
                                        {!msg.isStreaming && msg.content && (
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleCopy(msg.content, msg.id)}
                                                    className={cn("p-1 rounded-md", isDark ? "text-zinc-600 hover:text-zinc-400" : "text-zinc-300 hover:text-zinc-500")}>
                                                    {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input */}
            <div className={cn("border-t p-4", isDark ? "border-white/[0.06]" : "border-black/[0.06]")}>
                <div className="max-w-3xl mx-auto">
                    <AnimatePresence>
                        {imageInput && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-2">
                                <div className="relative inline-block">
                                    <img src={imageInput} alt="" className={cn("h-16 rounded-lg border", isDark ? "border-white/[0.1]" : "border-black/[0.08]")} />
                                    <button onClick={() => setImageInput(null)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-600 flex items-center justify-center">
                                        <X size={10} className="text-white" />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <form onSubmit={handleSubmit} className="relative">
                        <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onPaste={handlePaste}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                            placeholder="Ask anything..."
                            className={cn("w-full border rounded-xl px-3.5 py-3 pr-11 text-sm resize-none focus:outline-none min-h-[44px] max-h-28 transition-colors",
                                isDark ? "bg-white/[0.03] border-white/[0.06] text-zinc-100 placeholder:text-zinc-600 focus:border-white/[0.1]" : "bg-black/[0.02] border-black/[0.06] text-zinc-900 placeholder:text-zinc-400 focus:border-black/[0.12]")}
                            rows={1} disabled={isStreaming}
                            style={{ height: input.split('\n').length > 3 ? '112px' : '44px' }} />
                        <div className="absolute right-1.5 bottom-1.5">
                            {isStreaming ? (
                                <button type="button" onClick={handleStop} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10">
                                    <StopCircle size={15} className="text-red-400" />
                                </button>
                            ) : (
                                <button type="submit" disabled={!input.trim() && !imageInput}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors disabled:opacity-20 hover:bg-black/5">
                                    <Send size={14} className="opacity-60" />
                                </button>
                            )}
                        </div>
                    </form>
                    <div className={cn("flex items-center justify-between mt-1.5 text-[9px]", isDark ? "text-zinc-700" : "text-zinc-300")}>
                        <span>Enter ↵ · Shift+Enter ↵ · Paste image</span>
                        <span>{allTools.length} tools · CrewAI v1</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
