import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useOS } from '../hooks/useOS';
import { 
  Terminal as TerminalIcon, 
  Settings, 
  Files, 
  Bot, 
  Cpu, 
  Workflow, 
  Database,
  Search,
  LogOut,
  User
} from 'lucide-react';

const APPS = [
  { id: 'terminal', name: 'Terminal', icon: '⌨️', lucide: TerminalIcon, color: 'bg-zinc-900' },
  { id: 'files', name: 'Files', icon: '📁', lucide: Files, color: 'bg-blue-500' },
  { id: 'agents', name: 'Agent Studio', icon: '🤖', lucide: Bot, color: 'bg-indigo-500' },
  { id: 'llm', name: 'LLM Manager', icon: '🧠', lucide: Cpu, color: 'bg-emerald-500' },
  { id: 'automation', name: 'Automation', icon: '⚡', lucide: Workflow, color: 'bg-amber-500' },
  { id: 'mcp', name: 'MCP Connectors', icon: '🔌', lucide: Database, color: 'bg-rose-500' },
  { id: 'settings', name: 'Settings', icon: '⚙️', lucide: Settings, color: 'bg-zinc-400' },
];

export const StartMenu: React.FC = () => {
  const { isStartMenuOpen, toggleStartMenu, openApp } = useOS();

  return (
    <AnimatePresence>
      {isStartMenuOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => toggleStartMenu(false)}
            className="fixed inset-0 z-[9998] bg-black/5 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-14 left-4 w-[400px] h-[500px] bg-white border border-black/10 shadow-2xl rounded-2xl z-[9999] flex flex-col overflow-hidden"
          >
            {/* Search */}
            <div className="p-4 border-b border-black/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search apps, files, agents..." 
                  className="w-full pl-10 pr-4 py-2 bg-zinc-100 rounded-xl border-none focus:ring-2 focus:ring-black transition-all text-sm"
                  autoFocus
                />
              </div>
            </div>

            {/* Apps Grid */}
            <div className="flex-1 p-6 overflow-y-auto">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-4">Pinned Apps</h3>
              <div className="grid grid-cols-4 gap-4">
                {APPS.map(app => (
                  <button
                    key={app.id}
                    onClick={() => openApp(app.name, app.icon, app.id)}
                    className="flex flex-col items-center gap-2 group"
                  >
                    <div className={`w-12 h-12 ${app.color} rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                      <app.lucide size={24} />
                    </div>
                    <span className="text-[11px] font-medium text-zinc-600">{app.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* User Profile */}
            <div className="p-4 bg-zinc-50 border-t border-black/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white">
                  <User size={16} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold">Neuro User</span>
                  <span className="text-[10px] text-zinc-500">Pro Plan</span>
                </div>
              </div>
              <button className="p-2 hover:bg-black/5 rounded-lg transition-colors">
                <LogOut size={16} className="text-zinc-400" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
