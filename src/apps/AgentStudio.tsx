import React, { useState, useEffect } from 'react';
import { Bot, Plus, Play, Save, Trash2, MessageSquare, Zap, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import { OSAppWindow } from '../hooks/useOS';

interface AgentStudioProps {
  windowData?: OSAppWindow;
}

export const AgentStudio: React.FC<AgentStudioProps> = ({ windowData }) => {
  const [agents, setAgents] = useState([
    { id: '1', name: 'Research Assistant', model: 'gemini-3-flash-preview', status: 'idle' },
    { id: '2', name: 'Code Reviewer', model: 'gemini-3.1-pro-preview', status: 'active' },
  ]);

  useEffect(() => {
    if (windowData?.lastAction && windowData.lastAction.type === 'create_agent') {
      const newAgent = {
        id: Math.random().toString(36).substr(2, 9),
        name: windowData.lastAction.payload,
        model: 'gemini-3-flash-preview',
        status: 'idle'
      };
      setAgents(prev => [...prev, newAgent]);
    }
  }, [windowData?.lastAction]);

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar */}
      <div className="w-64 border-r border-black/5 flex flex-col">
        <div className="p-4 border-b border-black/5 flex items-center justify-between">
          <h2 className="font-bold text-sm">Agents</h2>
          <button className="p-1 hover:bg-black/5 rounded-md">
            <Plus size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {agents.map(agent => (
            <button key={agent.id} className="w-full flex items-center gap-3 p-2 hover:bg-zinc-100 rounded-lg transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs font-medium">{agent.name}</span>
                <span className="text-[10px] text-zinc-400">{agent.model}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col bg-zinc-50">
        <div className="h-14 bg-white border-b border-black/5 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="font-bold">Research Assistant</h1>
            <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wider">Active</div>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-zinc-800 transition-colors">
              <Play size={14} />
              Run Agent
            </button>
            <button className="p-2 hover:bg-black/5 rounded-lg transition-colors">
              <Save size={18} className="text-zinc-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 grid grid-cols-12 gap-6">
          {/* Config Panel */}
          <div className="col-span-8 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <MessageSquare size={16} className="text-indigo-500" />
                System Instruction
              </h3>
              <textarea 
                className="w-full h-40 p-4 bg-zinc-50 rounded-xl border-none focus:ring-2 focus:ring-black text-sm resize-none"
                placeholder="You are a helpful assistant that..."
              />
            </div>

            <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Zap size={16} className="text-amber-500" />
                Tools & Capabilities
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {['Web Search', 'Python Interpreter', 'File Access', 'Memory Graph', 'MCP Connector', 'Browser Control'].map(tool => (
                  <div key={tool} className="p-3 border border-black/5 rounded-xl flex items-center justify-between hover:border-black/20 transition-colors cursor-pointer group">
                    <span className="text-xs font-medium">{tool}</span>
                    <div className="w-8 h-4 bg-zinc-200 rounded-full relative">
                      <div className="absolute left-1 top-1 w-2 h-2 bg-white rounded-full shadow-sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats/Memory Panel */}
          <div className="col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Layers size={16} className="text-emerald-500" />
                Memory Context
              </h3>
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="p-3 bg-zinc-50 rounded-xl text-[11px] text-zinc-600 border border-black/5">
                    User preferences for data visualization updated.
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
