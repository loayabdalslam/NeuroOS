import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, X, Copy, Check, Sparkles, Wrench, ChevronDown, StopCircle, Brain, Clock, Trash2, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useComposioStore } from '../stores/composioStore';
import { useSessionStore, ChatMessage } from '../stores/sessionStore';
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
  type: 'thought' | 'plan' | 'tool_call' | 'tool_result' | 'tool_error' | 'synthesis';
  content: string;
  detail?: string;
  tool?: string;
  timestamp: number;
  duration?: number;
}

interface ToolSummaryItem { tool: string; status: 'success' | 'error'; preview: string; }

interface Message {
  id: string; role: 'user' | 'assistant'; content: string; timestamp: number;
  isStreaming?: boolean; thinking?: ThinkingBlock[]; toolSummary?: ToolSummaryItem[];
}

const MAX_ITER = 12;

function getFallbacks(tool: string, args: Record<string, any>): Array<{ tool: string; args: Record<string, any>; rawMatch: string }> {
  const map: Record<string, Array<{ tool: string; args: Record<string, any>; rawMatch: string }>> = {
    search_web: [
      { tool: 'web_fetch', args: { url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query || '')}` }, rawMatch: '' },
      { tool: 'browser_navigate', args: { url: `https://www.bing.com/search?q=${encodeURIComponent(args.query || '')}` }, rawMatch: '' },
    ],
    web_fetch: [
      { tool: 'browser_navigate', args: { url: args.url }, rawMatch: '' },
      { tool: 'browser_scrape', args: { url: args.url }, rawMatch: '' },
    ],
    browser_navigate: [{ tool: 'web_fetch', args: { url: args.url }, rawMatch: '' }],
    browser_scrape: [{ tool: 'web_fetch', args: { url: args.url }, rawMatch: '' }, { tool: 'browser_get_html', args: {}, rawMatch: '' }],
  };
  return map[tool] || [];
}

const Dots = () => (
  <div className="flex gap-1.5 items-center py-2">
    {[0, 1, 2].map(i => (
      <motion.div key={i} className="w-1 h-1 rounded-full bg-zinc-400"
        animate={{ opacity: [0.2, 0.8, 0.2] }}
        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.25 }} />
    ))}
  </div>
);

const ThinkBlock: React.FC<{ b: ThinkingBlock; exp: boolean; tog: () => void; dark: boolean }> = ({ b, exp, tog, dark }) => {
  const icons: Record<string, React.ReactNode> = {
    thought: <Brain size={11} />, plan: <Brain size={11} />, tool_call: <Wrench size={11} />,
    tool_result: <Check size={11} />, tool_error: <X size={11} />, synthesis: <Sparkles size={11} />,
  };
  const live = b.type === 'thought' && !b.duration;
  return (
    <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
      className={cn("rounded-lg overflow-hidden", dark ? "bg-white/[0.03]" : "bg-black/[0.02]")}>
      <button onClick={tog} className={cn("w-full flex items-center gap-2 px-3 py-2 text-left text-[11px]", dark ? "hover:bg-white/[0.05]" : "hover:bg-black/[0.03]")}>
        <span className={cn("shrink-0 opacity-50", dark ? "text-zinc-400" : "text-zinc-500")}>{icons[b.type]}</span>
        <span className={cn("flex-1 truncate", dark ? "text-zinc-400" : "text-zinc-500")}>{b.content}</span>
        {live && <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1 h-1 rounded-full bg-zinc-500" />}
        {b.detail && <ChevronDown size={11} className={cn("shrink-0 opacity-30 transition-transform", exp && "rotate-180")} />}
        {b.duration && <span className={cn("text-[9px] opacity-30", dark ? "text-zinc-500" : "text-zinc-400")}>{b.duration}ms</span>}
      </button>
      <AnimatePresence>
        {exp && b.detail && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className={cn("px-3 pb-2 text-[10px] whitespace-pre-wrap break-words max-h-48 overflow-y-auto", dark ? "text-zinc-500" : "text-zinc-400")}>{b.detail}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const ToolSum: React.FC<{ items: ToolSummaryItem[]; dark: boolean }> = ({ items, dark }) => (
  <div className="flex flex-wrap gap-1.5 mt-2">
    {items.map((it, i) => (
      <div key={i} className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px]", dark ? "bg-white/[0.04] text-zinc-500" : "bg-black/[0.03] text-zinc-400")}>
        <Wrench size={9} className="opacity-50" />
        <span className="font-mono">{it.tool}</span>
        <span className={cn("opacity-40", it.status === 'error' && "text-red-400")}>{it.status === 'success' ? '✓' : '✗'}</span>
      </div>
    ))}
  </div>
);

export const ChatApp: React.FC<ChatAppProps> = ({ windowData }) => {
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [abort, setAbort] = useState<AbortController | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [imgInput, setImgInput] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { workspacePath } = useWorkspaceStore();
  const { openApp, appWindows, closeWindow, sendAppAction } = useOS();
  const { isAuthenticated: isComp } = useComposioStore();
  const { theme, aiConfig } = useSettingsStore();
  const { sessions, activeSessionId, createSession, setActiveSession, updateSessionMessages, deleteSession, saveSessionToWorkspace } = useSessionStore();

  const allTools = useMemo(() => getAllTools(), []);
  const toolsP = useMemo(() => getToolsForPrompt(), []);
  const compP = useMemo(() => getComposioToolsForPrompt(), [isComp]);
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Get current model info
  const currentProvider = aiConfig.providers?.find((p: any) => p.id === aiConfig.activeProviderId);
  const currentModel = currentProvider?.selectedModel || 'unknown';
  const currentProviderName = currentProvider?.name || 'unknown';

  // Load active session on mount
  useEffect(() => {
    const active = sessions.find(s => s.id === activeSessionId);
    if (active && active.messages.length > 0) {
      setMsgs(active.messages as Message[]);
    } else if (!activeSessionId) {
      const newSession = createSession(currentModel, currentProviderName, workspacePath);
      // Auto-save to workspace after creating
      if (workspacePath) {
        setTimeout(() => saveSessionToWorkspace(newSession.id, workspacePath), 1000);
      }
    }
  }, []);

  // Auto-save messages to session
  useEffect(() => {
    if (activeSessionId && msgs.length > 0 && !streaming) {
      updateSessionMessages(activeSessionId, msgs as ChatMessage[]);
      // Save to workspace
      if (workspacePath) {
        saveSessionToWorkspace(activeSessionId, workspacePath);
      }
    }
  }, [msgs, streaming]);

  useEffect(() => { if (isComp) loadComposioTools(); }, [isComp]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const checkVision = useCallback((): boolean => {
    try {
      const { aiConfig } = useSettingsStore.getState();
      const p = aiConfig.providers?.find((x: any) => x.id === aiConfig.activeProviderId);
      if (!p) return false;
      const m = p.selectedModel?.toLowerCase() || '';
      const vl = VISION_MODELS[p.type as keyof typeof VISION_MODELS] || [];
      return vl.some((v: string) => m.includes(v.toLowerCase()));
    } catch { return false; }
  }, []);

  const getCtx = useCallback((): ToolContext => ({
    openApp: (id, name) => openApp(id, name),
    closeWindow: (id) => closeWindow(id),
    sendAppAction: (a, t, p) => sendAppAction(a, t, p),
    getAppWindows: () => appWindows,
    appWindows: appWindows.filter(w => w.component !== 'chat'),
    workspacePath,
    writeFile: async (p, c) => { const e = (window as any).electron; if (e?.fileSystem?.write) await e.fileSystem.write(p, c); },
    readFile: async (p) => { const e = (window as any).electron; if (e?.fileSystem?.read) return await e.fileSystem.read(p); throw new Error('FS unavailable'); },
    listFiles: async (p) => { const e = (window as any).electron; if (e?.fileSystem?.list) return await e.fileSystem.list(p); return []; },
    createDir: async (p) => { const e = (window as any).electron; if (e?.fileSystem?.createDir) await e.fileSystem.createDir(p); },
    deleteFile: async (p) => { const e = (window as any).electron; if (e?.fileSystem?.delete) await e.fileSystem.delete(p); },
    addMessage: () => {},
    updateMemory: () => {},
  }), [openApp, closeWindow, sendAppAction, appWindows, workspacePath]);

  const copy = useCallback((c: string, id: string) => { navigator.clipboard.writeText(c); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); }, []);
  const tog = useCallback((id: string) => { setExpanded(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }, []);

  const runAgent = useCallback(async (userInput: string, image?: string | null) => {
    const uMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: userInput, timestamp: Date.now() };
    const aId = `a-${Date.now()}`;
    const aMsg: Message = { id: aId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true, thinking: [], toolSummary: [] };

    setMsgs(prev => [...prev, uMsg, aMsg]);
    setStreaming(true);

    const ctrl = new AbortController();
    setAbort(ctrl);

    const think: ThinkingBlock[] = [];
    const tSum: ToolSummaryItem[] = [];
    const done: Array<{ tool: string; success: boolean; message: string; data?: any }> = [];

    const addB = (type: ThinkingBlock['type'], content: string, detail?: string, tool?: string) => {
      think.push({ id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, type, content, detail, tool, timestamp: Date.now() });
      upd();
    };
    const compB = (id: string) => { const b = think.find(x => x.id === id); if (b) b.duration = Date.now() - b.timestamp; upd(); };
    const upd = () => setMsgs(p => p.map(m => m.id === aId ? { ...m, thinking: [...think], toolSummary: [...tSum] } : m));

    addB('thought', 'Analyzing your request...');

    const sysPrompt = `You are Neuro AI. You are a helpful assistant that uses tools to complete tasks.

═══ IMPORTANT RULES ═══
1. After using ANY tool, you MUST write a detailed response explaining what you found
2. NEVER just call tools and stop - ALWAYS write your findings
3. Format links as: [Title](URL) - use the actual page title
4. If user asks to save something, USE the save_file tool

═══ YOUR RESPONSE FORMAT ═══
After calling tools, write your response like this:
- Explain what you did
- List findings with proper link titles
- Provide summary

Example:
"I searched for [topic]. Here's what I found:

1. [Article Title](https://example.com/article) - Summary of the article
2. [Another Title](https://other.com/page) - What this covers

Summary: [conclusion]"

═══ TOOLS ═══
${toolsP}
${compP}

WORKSPACE: ${workspacePath || 'Not set'}

═══ WHEN TO USE SAVE TOOLS ═══
- If user says "save" or "save to neuroboard" → use add_board_widget or save_file
- If user asks to write/create something → use save_file

═══ LINK TITLES ═══
When you get search results, use the TITLE from the result, not the URL.
Example: If result is "CNN - Breaking News" at https://cnn.com, write [CNN - Breaking News](https://cnn.com)

TOOL CALL FORMAT:
{"tool": "tool_name", "args": {"param1": "value1"}}`;

    const hist = msgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const llmMsgs: Array<{ role: 'system' | 'user' | 'assistant'; content: any }> = [{ role: 'system', content: sysPrompt }, ...hist];

    if (image && checkVision()) {
      llmMsgs.push({ role: 'user', content: [{ type: 'text', text: userInput }, { type: 'image_url', image_url: { url: image } }] });
    } else if (image) {
      addB('tool_error', 'Model does not support vision. Sending text only.');
      llmMsgs.push({ role: 'user', content: `${userInput}\n\n[Image attached but model does not support vision. Tell user to switch to gpt-4o, gemini-2.0-flash, or opencode-vision.]` });
    } else {
      llmMsgs.push({ role: 'user', content: userInput });
    }

    let full = '';
    let iter = 0;

    try {
      const llm = getLLMProvider();
      let curBId = think[think.length - 1]?.id;

      while (iter < MAX_ITER) {
        iter++;
        let cur = '';

        if (iter > 1) { addB('thought', `Iteration ${iter}: Continuing...`); curBId = think[think.length - 1]?.id; }

        await llm.stream(llmMsgs, (chunk) => {
          cur += chunk; full += chunk;
          if (curBId) { const b = think.find(x => x.id === curBId); if (b) { const p = cur.slice(-80).replace(/\n/g, ' ').trim(); if (p.length > 3) b.content = p; } }
          const dc = stripToolCalls(full, parseToolCalls(full));
          setMsgs(p => p.map(m => m.id === aId ? { ...m, content: dc, thinking: [...think] } : m));
        }, ctrl.signal);

        if (curBId) compB(curBId);

        const calls = parseToolCalls(cur);

        // If no tool calls were found in this response, check if we should force a summary
        if (calls.length === 0) {
          llmMsgs.push({ role: 'assistant', content: cur });
          if (cur.includes('"tool"')) {
            const fixed = parseToolCalls(cur.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
            if (fixed.length > 0) continue;
          }
          
          // If we have completed tasks but no response content, force a summary
          if (done.length > 0 && cur.trim().length < 50) {
            llmMsgs.push({ role: 'user', content: 'Based on the tool results above, please write a detailed summary of what you found. Format links as [Title](URL). Explain your findings clearly.' });
            addB('thought', 'Generating summary...');
            continue;
          }
          
          addB('synthesis', `Task complete. ${done.length} tools executed.`);
          break;
        }

        llmMsgs.push({ role: 'assistant', content: cur });

        for (const tc of calls) {
          addB('tool_call', `Executing: ${tc.tool}`, JSON.stringify(tc.args, null, 2), tc.tool);
          const t0 = Date.now();
          let result: any = null;
          let usedFB = false;

          try { result = await executeTool(tc, getCtx()); } catch (e: any) { result = { success: false, message: e.message }; }

          if (!result.success) {
            for (const fb of getFallbacks(tc.tool, tc.args)) {
              addB('thought', `Primary failed, trying: ${fb.tool}`, undefined, fb.tool);
              try { result = await executeTool(fb, getCtx()); if (result.success) { usedFB = true; addB('tool_result', `Fallback ${fb.tool} succeeded`, result.message?.slice(0, 300), fb.tool); break; } } catch {}
            }
          }

          const dur = Date.now() - t0;
          if (result.success) {
            addB('tool_result', `${tc.tool} done (${dur}ms)`, result.message?.slice(0, 500), tc.tool);
            tSum.push({ tool: usedFB ? `${tc.tool}*` : tc.tool, status: 'success', preview: result.message?.slice(0, 60) || 'done' });
            done.push({ tool: tc.tool, success: true, message: result.message?.slice(0, 500) || 'done', data: result.data });
          } else {
            addB('tool_error', `${tc.tool} failed: ${result.message?.slice(0, 80)}`, result.message, tc.tool);
            tSum.push({ tool: tc.tool, status: 'error', preview: result.message?.slice(0, 60) || 'failed' });
            done.push({ tool: tc.tool, success: false, message: result.message?.slice(0, 200) || 'failed' });
          }

          llmMsgs.push({ role: 'user', content: result.success ? `Tool ${tc.tool} succeeded: ${result.message}` : `Tool ${tc.tool} failed: ${result.message}\n\nTry alternative.` });
          upd();
        }
        full = '';
      }

      // Generate detailed task completion report
      const successfulTasks = done.filter(t => t.success);
      const failedTasks = done.filter(t => !t.success);
      
      let report = '';
      if (done.length > 0) {
        report = '\n\n---\n**Task Summary:**\n';
        report += `Completed ${successfulTasks.length}/${done.length} steps successfully.\n\n`;
        
        if (successfulTasks.length > 0) {
          report += '**What was accomplished:**\n';
          successfulTasks.forEach((t, i) => {
            report += `${i + 1}. **${t.tool}**: ${t.message?.slice(0, 150)}\n`;
          });
        }
        
        if (failedTasks.length > 0) {
          report += '\n**What failed:**\n';
          failedTasks.forEach((t, i) => {
            report += `- **${t.tool}**: ${t.message?.slice(0, 100)}\n`;
          });
        }
      }

      // If the last successful tool was a search, include the results with proper formatting
      const lastSearchResult = successfulTasks.find(t => t.tool === 'search_web' || t.tool === 'web_fetch' || t.tool === 'browser_scrape');
      if (lastSearchResult?.data?.results) {
        report += '\n**Sources:**\n';
        lastSearchResult.data.results.slice(0, 5).forEach((r: any, i: number) => {
          if (r.title && r.url) {
            report += `${i + 1}. [${r.title}](${r.url})\n`;
          }
        });
      }

      setMsgs(p => p.map(m => m.id === aId ? { ...m, content: (m.content || 'Task completed.') + report, isStreaming: false, thinking: [...think], toolSummary: [...tSum] } : m));

    } catch (error: any) {
      console.error('Agent Error:', error);
      const errMsg = error.name === 'AbortError' ? 'Stopped.' : getUserFriendlyError(error);
      addB('tool_error', errMsg);
      setMsgs(p => p.map(m => m.id === aId ? { ...m, content: m.content || errMsg, isStreaming: false, thinking: [...think], toolSummary: [...tSum] } : m));
    } finally {
      setStreaming(false);
      setAbort(null);
    }
  }, [msgs, workspacePath, toolsP, compP, getCtx, checkVision]);

  const submit = useCallback((e?: React.FormEvent) => { e?.preventDefault?.(); if ((!input.trim() && !imgInput) || streaming) return; runAgent(input.trim() || 'Analyze this image', imgInput); setInput(''); setImgInput(null); }, [input, imgInput, streaming, runAgent]);
  const stop = useCallback(() => abort?.abort(), [abort]);
  
  // Create new session
  const clear = useCallback(() => {
    const newSession = createSession(currentModel, currentProviderName, workspacePath);
    setMsgs([]);
    if (workspacePath) {
      setTimeout(() => saveSessionToWorkspace(newSession.id, workspacePath), 1000);
    }
  }, [currentModel, currentProviderName, workspacePath]);
  
  // Load a previous session
  const loadSession = useCallback((sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSession(sessionId);
      setMsgs(session.messages as Message[]);
      setShowHistory(false);
    }
  }, [sessions]);
  
  // Delete a session
  const removeSession = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSession(sessionId);
    if (activeSessionId === sessionId) {
      setMsgs([]);
      const newSession = createSession(currentModel, currentProviderName, workspacePath);
    }
  }, [activeSessionId, currentModel, currentProviderName, workspacePath]);
  
  const paste = useCallback((e: React.ClipboardEvent) => { for (const it of (e.clipboardData?.items || [])) { if (it.type.startsWith('image/')) { e.preventDefault(); const b = it.getAsFile(); if (b) { const r = new FileReader(); r.onload = () => setImgInput(r.result as string); r.readAsDataURL(b); } break; } } }, []);

  // Format time ago
  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  };

  return (
    <div className={cn("flex flex-col h-full font-sans", dark ? "bg-zinc-950 text-zinc-100" : "bg-white text-zinc-900")}>
      <div className={cn("flex items-center justify-between px-5 py-3 border-b", dark ? "border-white/[0.06]" : "border-black/[0.06]")}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }}>
            <Sparkles size={12} className="opacity-50" />
          </div>
          <span className="text-sm font-medium">Neuro</span>
          <span className={cn("text-[9px] uppercase tracking-wider", dark ? "text-zinc-600" : "text-zinc-400")}>crew-agentic</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowHistory(!showHistory)}
            className={cn("text-[11px] px-2 py-1 rounded-md transition-colors flex items-center gap-1", dark ? "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-black/[0.03]")}>
            <Clock size={12} />
            <span>{sessions.length}</span>
          </button>
          <button onClick={clear} className={cn("text-[11px] px-2 py-1 rounded-md transition-colors", dark ? "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05]" : "text-zinc-400 hover:text-zinc-600 hover:bg-black/[0.03]")}>New chat</button>
        </div>
      </div>

      {/* Session History Panel */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={cn("border-b overflow-hidden", dark ? "border-white/[0.06] bg-zinc-900/50" : "border-black/[0.06] bg-zinc-50/50")}
          >
            <div className="max-h-64 overflow-y-auto p-2 space-y-1">
              <div className="flex items-center justify-between px-2 py-1">
                <span className={cn("text-[10px] font-medium uppercase tracking-wider", dark ? "text-zinc-500" : "text-zinc-400")}>Chat History</span>
                <button onClick={() => setShowHistory(false)} className={cn("p-0.5 rounded", dark ? "hover:bg-white/[0.05]" : "hover:bg-black/[0.05]")}>
                  <X size={12} className="opacity-50" />
                </button>
              </div>
              {sessions.length === 0 ? (
                <div className={cn("text-[11px] text-center py-4", dark ? "text-zinc-600" : "text-zinc-400")}>No chat history yet</div>
              ) : (
                sessions.slice(0, 20).map(session => (
                  <div
                    key={session.id}
                    onClick={() => loadSession(session.id)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors",
                      session.id === activeSessionId
                        ? (dark ? "bg-white/[0.06]" : "bg-black/[0.04]")
                        : (dark ? "hover:bg-white/[0.03]" : "hover:bg-black/[0.02]")
                    )}
                  >
                    <MessageSquare size={12} className={cn("shrink-0", dark ? "text-zinc-600" : "text-zinc-400")} />
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-[11px] truncate", dark ? "text-zinc-300" : "text-zinc-700")}>{session.title}</div>
                      <div className={cn("text-[9px]", dark ? "text-zinc-600" : "text-zinc-400")}>
                        {session.messages.length} messages · {timeAgo(session.updatedAt)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => removeSession(session.id, e)}
                      className={cn("p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity", dark ? "hover:bg-white/[0.05] text-zinc-500" : "hover:bg-black/[0.05] text-zinc-400")}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto">
        {msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5" style={{ background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }}>
              <Sparkles size={24} className="opacity-30" />
            </div>
            <h2 className={cn("text-lg font-medium mb-1.5", dark ? "text-zinc-200" : "text-zinc-800")}>Crew Agent Ready</h2>
            <p className={cn("text-xs text-center max-w-xs mb-6", dark ? "text-zinc-600" : "text-zinc-400")}>Multi-agent system with smart fallbacks.</p>
            <div className="grid grid-cols-2 gap-1.5 w-full max-w-sm">
              {['Search and summarize web pages', 'Analyze and organize files', 'Execute complex tasks', 'Research and write reports'].map(s => (
                <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className={cn("text-left px-3 py-2.5 rounded-lg text-[11px] transition-colors", dark ? "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300" : "text-zinc-400 hover:bg-black/[0.03] hover:text-zinc-600")}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
            {msgs.map(msg => (
              <div key={msg.id} className={cn("group", msg.role === 'user' && "flex justify-end")}>
                {msg.role === 'user' ? (
                  <div className="max-w-[80%]"><div className={cn("rounded-xl px-3.5 py-2.5 text-sm", dark ? "bg-white/[0.06]" : "bg-black/[0.04]")}>{msg.content}</div></div>
                ) : (
                  <div className="space-y-2">
                    {msg.thinking && msg.thinking.length > 0 && (
                      <div className="space-y-0.5">
                        {(showAll ? msg.thinking : msg.thinking.slice(0, 4)).map(b => (
                          <ThinkBlock key={b.id} b={b} exp={expanded.has(b.id)} tog={() => tog(b.id)} dark={dark} />
                        ))}
                        {msg.thinking.length > 4 && (
                          <button onClick={() => setShowAll(!showAll)} className={cn("text-[10px] px-2 py-1 rounded-md", dark ? "text-zinc-600 hover:text-zinc-400" : "text-zinc-400 hover:text-zinc-600")}>
                            {showAll ? 'Show less' : `Show all ${msg.thinking.length} steps`}
                          </button>
                        )}
                      </div>
                    )}
                    {msg.toolSummary && msg.toolSummary.length > 0 && <ToolSum items={msg.toolSummary} dark={dark} />}
                    <div className={cn("text-sm leading-relaxed", dark ? "text-zinc-300" : "text-zinc-700")}>
                      {msg.isStreaming && !msg.content ? <Dots /> : (
                        <Markdown components={{
                          code: ({ className, children, ...props }) => {
                            const m = /language-(\w+)/.exec(className || '');
                            return m ? <pre className={cn("p-2.5 rounded-lg overflow-x-auto text-[11px] my-1.5", dark ? "bg-white/[0.04]" : "bg-black/[0.03]")}><code {...props}>{children}</code></pre>
                              : <code className={cn("px-1 py-0.5 rounded text-[11px]", dark ? "bg-white/[0.06]" : "bg-black/[0.05]")} {...props}>{children}</code>;
                          },
                          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
                          a: ({ href, children }) => (
                            <a href={href}
                              className="underline opacity-80 hover:opacity-100 cursor-pointer"
                              onClick={(e) => {
                                e.preventDefault();
                                if (href && href.startsWith('http')) {
                                  openApp('browser', 'Browser');
                                  setTimeout(() => {
                                    const all = useOS.getState().appWindows;
                                    const browser = all.filter(w => w.component === 'browser').pop();
                                    if (browser) {
                                      useOS.getState().sendAppAction(browser.id, 'navigate', { url: href });
                                    }
                                  }, 100);
                                }
                              }}
                            >{children}</a>
                          ),
                        }}>{msg.content}</Markdown>
                      )}
                      {msg.isStreaming && msg.content && <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.8, repeat: Infinity }} className={cn("inline-block w-1 h-3.5 ml-0.5 rounded-sm", dark ? "bg-zinc-500" : "bg-zinc-300")} />}
                    </div>
                    {!msg.isStreaming && msg.content && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => copy(msg.content, msg.id)} className={cn("p-1 rounded-md", dark ? "text-zinc-600 hover:text-zinc-400" : "text-zinc-300 hover:text-zinc-500")}>
                          {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className={cn("border-t p-4", dark ? "border-white/[0.06]" : "border-black/[0.06]")}>
        <div className="max-w-3xl mx-auto">
          <AnimatePresence>
            {imgInput && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-2">
                <div className="relative inline-block">
                  <img src={imgInput} alt="" className={cn("h-16 rounded-lg border", dark ? "border-white/[0.1]" : "border-black/[0.08]")} />
                  <button onClick={() => setImgInput(null)} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-zinc-600 flex items-center justify-center"><X size={10} className="text-white" /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <form onSubmit={submit} className="relative">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onPaste={paste}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder="Ask anything..."
              className={cn("w-full border rounded-xl px-3.5 py-3 pr-11 text-sm resize-none focus:outline-none min-h-[44px] max-h-28 transition-colors",
                dark ? "bg-white/[0.03] border-white/[0.06] text-zinc-100 placeholder:text-zinc-600 focus:border-white/[0.1]" : "bg-black/[0.02] border-black/[0.06] text-zinc-900 placeholder:text-zinc-400 focus:border-black/[0.12]")}
              rows={1} disabled={streaming} style={{ height: input.split('\n').length > 3 ? '112px' : '44px' }} />
            <div className="absolute right-1.5 bottom-1.5">
              {streaming ? (
                <button type="button" onClick={stop} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10"><StopCircle size={15} className="text-red-400" /></button>
              ) : (
                <button type="submit" disabled={!input.trim() && !imgInput} className="w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-20 hover:bg-black/5"><Send size={14} className="opacity-60" /></button>
              )}
            </div>
          </form>
          <div className={cn("flex items-center justify-between mt-1.5 text-[9px]", dark ? "text-zinc-700" : "text-zinc-300")}>
            <span>Enter · Shift+Enter · Paste image</span>
            <span>{allTools.length} tools · CrewAI</span>
          </div>
        </div>
      </div>
    </div>
  );
};
