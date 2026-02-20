import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, X, Bot, Terminal, Files, Settings, Cpu, Workflow, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { useOS } from '../hooks/useOS';
import { cn } from '../lib/utils';
import { getLLMProvider } from '../lib/llm/factory';
import { APPS_CONFIG } from '../lib/apps';

// Removed local APPS_CONFIG array

const controlTools: FunctionDeclaration[] = [
  // ... (keep controlTools, they are fine)
  {
    name: "open_app",
    description: "Opens a system application by its ID.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        app_id: {
          type: Type.STRING,
          // Updated description
          description: "The ID of the app to open (terminal, files, agents, llm, automation, mcp, settings)",
          enum: Object.keys(APPS_CONFIG)
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
        const app = APPS_CONFIG[args.app_id];
        if (app) {
          openApp(app.id, app.name);
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
    const newHistory = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      // Use the configured LLM provider
      const llm = getLLMProvider();

      // Inject System Prompt for Neuro AI Persona
      const systemPrompt = `You are Neuro AI, the sentient operating system core of this computer. 
      You have full control over the OS interface and applications.
      
      Your Capabilities:
      - App Management: open_app, list_running_apps
      - Window Management: close_window, minimize_window, maximize_window
      - Deep Control: send_app_action (for specific app commands like terminal execution)
      
      Personality:
      - Highly intelligent, efficient, and slightly futuristic.
      - You prefer concise, actionable responses.
      - You ALWAYS confirm actions after performing them.
      
      Current Context:
      - User Input: "${userMessage}"
      
      If the user wants to perform an action, output a JSON object with the tool call details.
      Format: { "tool": "tool_name", "args": { ... } }
      If no action is needed, just reply normally.
      `;

      // Simulating a tool-use loop (basic version for local LLMs which might not support native function calling APIs)
      // We prepend the system prompt to the messages
      const conversation = [
        { role: 'system' as const, content: systemPrompt },
        ...newHistory
      ];

      const response = await llm.chat(conversation);
      let content = response.content;

      // Basic JSON parsing for tool calls (since we asked for JSON in system prompt)
      // This is a robust fallback for models without native tool support (like Llama 3 via Ollama)
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const toolCall = JSON.parse(jsonMatch[0]);
          if (toolCall.tool && toolCall.args) {
            const result = await handleAction(toolCall.tool, toolCall.args);

            // Recursively call LLM with tool result
            const followUpPrompt = [
              ...conversation,
              { role: 'assistant' as const, content: content },
              { role: 'user' as const, content: `Tool Output: ${result}. Please confirm to the user.` }
            ];
            const finalResponse = await llm.chat(followUpPrompt);
            content = finalResponse.content;
          }
        }
      } catch (e) {
        // Not a JSON tool call, just regular text
      }

      setMessages(prev => [...prev, { role: 'assistant', content: content }]);

    } catch (error) {
      console.error('Assistant error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "I apologize, but my core systems are encountering an error connecting to the LLM backend." }]);
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
                    <p className="text-xs font-medium">Try saying "Open Terminal" or<br />"Close all windows"</p>
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
