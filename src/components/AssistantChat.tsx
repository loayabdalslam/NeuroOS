import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, X, Bot, Terminal, Files, Settings, Cpu, Workflow, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { useOS } from '../hooks/useOS';
import { cn } from '../lib/utils';

const APPS_CONFIG = [
  { id: 'terminal', name: 'Terminal', icon: '⌨️' },
  { id: 'files', name: 'Files', icon: '📁' },
  { id: 'agents', name: 'Agent Studio', icon: '🤖' },
  { id: 'llm', name: 'LLM Manager', icon: '🧠' },
  { id: 'automation', name: 'Automation', icon: '⚡' },
  { id: 'mcp', name: 'MCP Connectors', icon: '🔌' },
  { id: 'settings', name: 'Settings', icon: '⚙️' },
];

const controlTools: FunctionDeclaration[] = [
  {
    name: "open_app",
    description: "Opens a system application by its ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        app_id: {
          type: Type.STRING,
          description: "The ID of the app to open (terminal, files, agents, llm, automation, mcp, settings)",
          enum: ['terminal', 'files', 'agents', 'llm', 'automation', 'mcp', 'settings']
        }
      },
      required: ["app_id"]
    }
  },
  {
    name: "close_window",
    description: "Closes a specific window by its ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        window_id: {
          type: Type.STRING,
          description: "The unique ID of the window to close."
        }
      },
      required: ["window_id"]
    }
  },
  {
    name: "minimize_window",
    description: "Minimizes a specific window by its ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        window_id: {
          type: Type.STRING,
          description: "The unique ID of the window to minimize."
        }
      },
      required: ["window_id"]
    }
  },
  {
    name: "maximize_window",
    description: "Maximizes a specific window by its ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        window_id: {
          type: Type.STRING,
          description: "The unique ID of the window to maximize."
        }
      },
      required: ["window_id"]
    }
  },
  {
    name: "send_app_action",
    description: "Sends a specific command or action to an application. You can target by window_id or by the app's ID (e.g., 'terminal', 'files').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        target_id: {
          type: Type.STRING,
          description: "The unique ID of the window OR the app ID (e.g., 'terminal', 'files', 'agents') to send the action to."
        },
        action_type: {
          type: Type.STRING,
          description: "The type of action (e.g., 'execute_command', 'set_theme', 'search', 'create_file')."
        },
        payload: {
          type: Type.STRING,
          description: "The data or command string to send with the action."
        }
      },
      required: ["target_id", "action_type", "payload"]
    }
  },
  {
    name: "list_running_apps",
    description: "Returns a list of currently open windows and their IDs.",
    parameters: {
      type: Type.OBJECT,
      properties: {}
    }
  }
];

export const AssistantChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { appWindows, openApp, closeWindow, minimizeWindow, maximizeWindow, sendAppAction, focusWindow } = useOS();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleAction = async (name: string, args: any) => {
    switch (name) {
      case 'open_app':
        const app = APPS_CONFIG.find(a => a.id === args.app_id);
        if (app) {
          openApp(app.name, app.icon, app.id);
          return `Successfully launched the ${app.name} application.`;
        }
        return `I couldn't find an app with the ID "${args.app_id}".`;
      case 'close_window':
        closeWindow(args.window_id);
        return `The window with ID ${args.window_id} has been closed.`;
      case 'minimize_window':
        minimizeWindow(args.window_id);
        return `The window ${args.window_id} is now minimized to the taskbar.`;
      case 'maximize_window':
        maximizeWindow(args.window_id);
        return `The window ${args.window_id} has been maximized.`;
      case 'send_app_action':
        sendAppAction(args.target_id, args.action_type, args.payload);
        return `Sent action "${args.action_type}" with payload to ${args.target_id}.`;
      case 'list_running_apps':
        if (appWindows.length === 0) return "There are currently no applications running on the desktop.";
        const list = appWindows.map(w => `• ${w.title} (ID: ${w.id})`).join('\n');
        return `Here are the currently active applications:\n${list}`;
      default:
        return "The requested system action was not recognized.";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = "gemini-3-flash-preview";
      
      const chat = ai.chats.create({
        model,
        config: {
          systemInstruction: "You are NeuroAssistant, the core AI controller for NeuroOS. You can control the OS by opening apps, closing/minimizing/maximizing windows, and sending specific actions to apps. \n\nSupported App Actions:\n- Terminal: 'execute_command' (payload: the command string)\n- Files: 'create_file' (payload: filename)\n- Agents: 'create_agent' (payload: agent name)\n- Settings: 'set_theme' (payload: 'Light', 'Dark', or 'System')\n- LLM: 'add_model' (payload: model name)\n\nIMPORTANT: If a user asks to open an app and perform an action inside it (e.g., 'open terminal and run help'), use BOTH 'open_app' and 'send_app_action' in a single turn. For 'send_app_action', you can use the app ID (like 'terminal') as the target_id if you just opened it or don't have a window_id.\n\nBe concise and helpful. After using tools, confirm the action naturally.",
          tools: [{ functionDeclarations: controlTools }]
        }
      });

      let response = await chat.sendMessage({ message: userMessage });
      let parts = response.candidates[0].content.parts;
      
      // Check for function calls
      const functionCalls = parts.filter(p => p.functionCall);
      
      if (functionCalls.length > 0) {
        const toolResponses = [];
        for (const part of functionCalls) {
          if (part.functionCall) {
            const result = await handleAction(part.functionCall.name, part.functionCall.args);
            toolResponses.push({
              functionResponse: {
                name: part.functionCall.name,
                response: { result }
              }
            });
          }
        }

        // Send tool results back to model for final response
        const finalResponse = await chat.sendMessage({ 
          message: `The system has executed the requested actions with the following results: ${JSON.stringify(toolResponses)}. Please provide a natural confirmation to the user.` 
        });
        setMessages(prev => [...prev, { role: 'assistant', content: finalResponse.text || "I've updated the system for you." }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: response.text || "I'm here to help you manage NeuroOS. What would you like to do?" }]);
      }
    } catch (error) {
      console.error('Assistant error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error controlling the system." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-4 py-1.5 rounded-full transition-all duration-300 border shadow-sm",
          isOpen 
            ? "bg-black text-white border-black w-64" 
            : "bg-white/50 backdrop-blur-md border-black/5 hover:bg-white text-zinc-600 w-48"
        )}
      >
        <Sparkles size={14} className={cn(isOpen ? "text-amber-400 animate-pulse" : "text-indigo-500")} />
        <span className="text-xs font-bold truncate">
          {isOpen ? "How can I help?" : "Ask NeuroAssistant..."}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for closing */}
            <div 
              className="fixed inset-0 z-[-1]" 
              onClick={() => setIsOpen(false)} 
            />
            
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-14 left-1/2 -translate-x-1/2 w-[400px] max-h-[500px] bg-white border border-black/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col z-[10000]"
            >
              <div className="p-4 border-b border-black/5 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-black flex items-center justify-center text-white">
                    <Bot size={14} />
                  </div>
                  <span className="text-xs font-bold">NeuroAssistant</span>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-black/5 rounded-md">
                  <X size={14} />
                </button>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px]">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-2 opacity-50 py-12">
                    <Sparkles size={32} className="text-indigo-500" />
                    <p className="text-xs font-medium">Try saying "Open Terminal" or<br/>"Close all windows"</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[80%] p-3 rounded-2xl text-xs",
                      msg.role === 'user' 
                        ? "bg-black text-white rounded-tr-none" 
                        : "bg-zinc-100 text-zinc-800 rounded-tl-none"
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-100 p-3 rounded-2xl rounded-tl-none">
                      <Loader2 size={14} className="animate-spin text-zinc-400" />
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="p-4 border-t border-black/5 bg-zinc-50">
                <div className="relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a command..."
                    className="w-full pl-4 pr-10 py-2 bg-white border border-black/5 rounded-xl text-xs focus:ring-2 focus:ring-black outline-none transition-all shadow-sm"
                    autoFocus
                  />
                  <button 
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black text-white rounded-lg disabled:opacity-30 transition-opacity"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
