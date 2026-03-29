import React, { useState, useEffect } from 'react';
import { Bot, Plus, Play, Save, Trash2, MessageSquare, Zap, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import { OSAppWindow } from '../hooks/useOS';

interface AgentStudioProps {
  windowData?: OSAppWindow;
}

export const AgentStudio: React.FC<AgentStudioProps> = ({ windowData }) => {
  const [agents, setAgents] = useState([
    { id: '1', name: 'Research Assistant', model: 'gemini-3-flash-preview', status: 'idle', systemPrompt: '', tools: [] },
    { id: '2', name: 'Code Reviewer', model: 'gemini-3.1-pro-preview', status: 'active', systemPrompt: '', tools: [] },
  ]);
  const [selectedAgentId, setSelectedAgentId] = useState('1');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  useEffect(() => {
    if (selectedAgent) {
      setSystemPrompt(selectedAgent.systemPrompt);
      setEnabledTools(selectedAgent.tools);
    }
  }, [selectedAgent]);

  useEffect(() => {
    if (windowData?.lastAction && windowData.lastAction.type === 'create_agent') {
      const newAgent = {
        id: Math.random().toString(36).substr(2, 9),
        name: windowData.lastAction.payload,
        model: 'gemini-3-flash-preview',
        status: 'idle' as const,
        systemPrompt: '',
        tools: []
      };
      setAgents(prev => [...prev, newAgent]);
      setSelectedAgentId(newAgent.id);
    }
  }, [windowData?.lastAction]);

  const handleSave = () => {
    setAgents(agents.map(a =>
      a.id === selectedAgentId
        ? { ...a, systemPrompt, tools: enabledTools }
        : a
    ));
  };

  const handleRunAgent = async () => {
    if (!selectedAgent) return;
    setIsRunning(true);
    // Simulate agent execution
    setTimeout(() => {
      setIsRunning(false);
    }, 2000);
  };

  const handleCreateAgent = () => {
    const newAgent = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Agent ${agents.length + 1}`,
      model: 'gemini-3-flash-preview',
      status: 'idle' as const,
      systemPrompt: '',
      tools: []
    };
    setAgents([...agents, newAgent]);
    setSelectedAgentId(newAgent.id);
  };

  const handleDeleteAgent = (id: string) => {
    setAgents(agents.filter(a => a.id !== id));
    if (selectedAgentId === id && agents.length > 1) {
      setSelectedAgentId(agents[0].id);
    }
  };

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar */}
      <div className="w-64 border-r border-black/5 flex flex-col">
        <div className="p-4 border-b border-black/5 flex items-center justify-between">
          <h2 className="font-bold text-sm">Agents</h2>
          <button onClick={handleCreateAgent} className="p-1 hover:bg-black/5 rounded-md transition-colors">
            <Plus size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
              className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                selectedAgentId === agent.id ? 'bg-indigo-100' : 'hover:bg-zinc-100'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="flex flex-col items-start flex-1">
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
            <h1 className="font-bold">{selectedAgent?.name || 'No Agent Selected'}</h1>
            <div className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${
              isRunning ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {isRunning ? 'Running' : selectedAgent?.status || 'Idle'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAgent}
              disabled={!selectedAgent || isRunning}
              className="flex items-center gap-2 px-3 py-1.5 bg-black text-white rounded-lg text-xs font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={14} />
              Run Agent
            </button>
            <button
              onClick={handleSave}
              className="p-2 hover:bg-black/5 rounded-lg transition-colors"
              title="Save agent configuration"
            >
              <Save size={18} className="text-zinc-400 hover:text-zinc-600" />
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
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
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
                {['Web Search', 'Python Interpreter', 'File Access', 'Memory Graph', 'MCP Connector', 'Browser Control'].map(tool => {
                  const isEnabled = enabledTools.includes(tool);
                  return (
                    <button
                      key={tool}
                      onClick={() => setEnabledTools(isEnabled ? enabledTools.filter(t => t !== tool) : [...enabledTools, tool])}
                      className="p-3 border border-black/5 rounded-xl flex items-center justify-between hover:border-black/20 transition-colors cursor-pointer group"
                    >
                      <span className="text-xs font-medium">{tool}</span>
                      <div className={`w-8 h-4 rounded-full relative transition-colors ${isEnabled ? 'bg-indigo-500' : 'bg-zinc-200'}`}>
                        <div className={`absolute top-1 w-2 h-2 bg-white rounded-full shadow-sm transition-all ${isEnabled ? 'right-1' : 'left-1'}`} />
                      </div>
                    </button>
                  );
                })}
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
