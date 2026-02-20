import React, { useState, useEffect } from 'react';
import { Cpu, Activity, BarChart3, Globe, Zap, DollarSign, ShieldCheck } from 'lucide-react';
import { OSAppWindow } from '../hooks/useOS';

interface LLMManagerProps {
  windowData?: OSAppWindow;
}

export const LLMManager: React.FC<LLMManagerProps> = ({ windowData }) => {
  const [models, setModels] = useState([
    { id: '1', name: 'Gemini 3 Flash', provider: 'Google', status: 'active', latency: '120ms', cost: '$0.01/1k' },
    { id: '2', name: 'GPT-4o', provider: 'OpenAI', status: 'active', latency: '450ms', cost: '$0.03/1k' },
    { id: '3', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', status: 'active', latency: '320ms', cost: '$0.02/1k' },
    { id: '4', name: 'Llama 3 (Local)', provider: 'Ollama', status: 'offline', latency: '-', cost: 'Free' },
  ]);

  useEffect(() => {
    if (windowData?.lastAction && windowData.lastAction.type === 'add_model') {
      const newModel = {
        id: Math.random().toString(36).substr(2, 9),
        name: windowData.lastAction.payload,
        provider: 'Custom',
        status: 'active',
        latency: '0ms',
        cost: 'Free'
      };
      setModels(prev => [...prev, newModel]);
    }
  }, [windowData?.lastAction]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 border-b border-black/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
            <Cpu size={24} />
          </div>
          <div>
            <h1 className="font-bold">LLM Provider Manager</h1>
            <p className="text-xs text-zinc-500">Orchestrate and monitor your model endpoints.</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Cost (24h)</div>
            <div className="text-lg font-bold">$12.45</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Avg Latency</div>
            <div className="text-lg font-bold text-emerald-500">280ms</div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-zinc-50 rounded-2xl border border-black/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500">Active Models</span>
              <Activity size={14} className="text-emerald-500" />
            </div>
            <div className="text-2xl font-bold">12</div>
          </div>
          <div className="p-4 bg-zinc-50 rounded-2xl border border-black/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500">Tokens Processed</span>
              <BarChart3 size={14} className="text-blue-500" />
            </div>
            <div className="text-2xl font-bold">4.2M</div>
          </div>
          <div className="p-4 bg-zinc-50 rounded-2xl border border-black/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500">Uptime</span>
              <ShieldCheck size={14} className="text-indigo-500" />
            </div>
            <div className="text-2xl font-bold">99.9%</div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold">Model Registry</h3>
          <div className="border border-black/5 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-black/5">
                <tr>
                  <th className="px-6 py-3 font-bold text-zinc-400 uppercase tracking-wider">Model</th>
                  <th className="px-6 py-3 font-bold text-zinc-400 uppercase tracking-wider">Provider</th>
                  <th className="px-6 py-3 font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 font-bold text-zinc-400 uppercase tracking-wider">Latency</th>
                  <th className="px-6 py-3 font-bold text-zinc-400 uppercase tracking-wider">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {models.map(model => (
                  <tr key={model.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-6 py-4 font-bold">{model.name}</td>
                    <td className="px-6 py-4 text-zinc-500">{model.provider}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${model.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                        <span className="capitalize">{model.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">{model.latency}</td>
                    <td className="px-6 py-4 font-mono text-zinc-600">{model.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
