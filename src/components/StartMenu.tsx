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
import { APPS_CONFIG } from '../lib/apps';
import { cn } from '../lib/utils';
import { NeuroIcon } from './icons/NeuroIcon';

import { useAuthStore } from '../stores/authStore';

export const StartMenu: React.FC = () => {
  const { isStartMenuOpen, toggleStartMenu, openApp } = useOS();
  const { logout, users, activeUserId } = useAuthStore();
  const user = users.find(u => u.id === activeUserId);

  const handleLogout = () => {
    toggleStartMenu(false);
    logout();
  };

  return (
    <AnimatePresence>
      {isStartMenuOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => toggleStartMenu(false)}
            className="fixed inset-0 z-[9998] bg-white/5 backdrop-blur-[1px]"
          />
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.98 }}
            transition={{ type: "spring", damping: 25, stiffness: 350, mass: 0.8 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 w-[480px] h-[400px] bg-white ring-1 ring-zinc-200 shadow-2xl shadow-zinc-200/50 rounded-2xl z-[9999] flex flex-col overflow-hidden"
          >
            {/* Search */}
            <div className="p-4 pb-2">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Search apps, files, agents..."
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 rounded-xl border border-transparent focus:bg-white focus:border-zinc-200 focus:ring-4 focus:ring-zinc-50 transition-all text-sm outline-none placeholder:text-zinc-400"
                  autoFocus
                />
              </div>
            </div>

            {/* Apps Grid */}
            <div className="flex-1 p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200/50 hover:scrollbar-thumb-zinc-300">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-4 pl-1">Pinned Apps</h3>
              <div className="grid grid-cols-5 gap-y-6 gap-x-2">
                {Object.values(APPS_CONFIG).map(app => (
                  <button
                    key={app.id}
                    draggable={true}
                    onDragStart={(e: any) => {
                      if (e.dataTransfer) {
                        e.dataTransfer.setData('neuro/app', JSON.stringify({
                          id: app.id,
                          name: app.name
                        }));
                        e.dataTransfer.effectAllowed = 'copy';
                      }
                    }}
                    onClick={() => {
                      openApp(app.id, app.name);
                      toggleStartMenu(false);
                    }}
                    className="flex flex-col items-center gap-2 group p-2 rounded-xl hover:bg-zinc-50 transition-colors"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-[14px] flex items-center justify-center text-white shadow-sm ring-1 ring-black/5 group-hover:scale-105 transition-all duration-300 ease-spring",
                      app.color
                    )}>
                      <NeuroIcon size={24} showTM={false} />
                    </div>
                    <span className="text-[11px] font-medium text-zinc-600 group-hover:text-zinc-900">{app.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* User Profile */}
            <div className="p-3 mx-2 mb-2 bg-zinc-50/50 rounded-xl border border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-3 px-1">
                {user?.avatar ? (
                  <img src={user.avatar} className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-200" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white ring-1 ring-zinc-100 flex items-center justify-center text-zinc-900 shadow-sm">
                    <NeuroIcon size={14} showTM={false} />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-zinc-800">{user?.name || 'User'}</span>
                  <span className="text-[10px] text-zinc-400 max-w-[150px] truncate">{user?.bio || 'NeuroOS Pilot'}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-zinc-400 hover:text-red-500"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
