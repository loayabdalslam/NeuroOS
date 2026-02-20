import React, { useState } from 'react';
import { Workflow, Play, Plus, Clock, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';

import { OSAppWindow } from '../hooks/useOS';

interface AutomationEngineProps {
  windowData?: OSAppWindow;
}

export const AutomationEngine: React.FC<AutomationEngineProps> = ({ windowData }) => {
  const [workflows, setWorkflows] = useState([
    { id: '1', name: 'Daily Research Summary', trigger: 'Schedule (9:00 AM)', status: 'active', lastRun: '2h ago' },
    { id: '2', name: 'GitHub Issue Auto-Responder', trigger: 'Webhook', status: 'active', lastRun: '15m ago' },
    { id: '3', name: 'Slack to Notion Sync', trigger: 'Event', status: 'paused', lastRun: '1d ago' },
  ]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-8 border-b border-black/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Workflow size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Automation Engine</h1>
            <p className="text-sm text-zinc-500">Design and deploy autonomous workflows.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all">
          <Plus size={18} />
          New Workflow
        </button>
      </div>

      <div className="flex-1 p-8 overflow-y-auto space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Active Workflows', value: '8', icon: Zap, color: 'text-amber-500' },
            { label: 'Total Executions', value: '1,242', icon: Play, color: 'text-blue-500' },
            { label: 'Success Rate', value: '99.2%', icon: CheckCircle2, color: 'text-emerald-500' },
            { label: 'System Errors', value: '0', icon: AlertCircle, color: 'text-zinc-300' },
          ].map(stat => (
            <div key={stat.label} className="p-4 bg-zinc-50 rounded-2xl border border-black/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">{stat.label}</span>
                <stat.icon size={14} className={stat.color} />
              </div>
              <div className="text-xl font-bold">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold">Recent Workflows</h3>
          <div className="space-y-2">
            {workflows.map(wf => (
              <div key={wf.id} className="p-4 bg-white border border-black/5 rounded-2xl flex items-center justify-between hover:border-black/10 transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${wf.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                  <div>
                    <div className="text-sm font-bold">{wf.name}</div>
                    <div className="text-[10px] text-zinc-400 flex items-center gap-2">
                      <Clock size={10} />
                      {wf.trigger} • Last run {wf.lastRun}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
                    <Play size={16} className="text-zinc-600" />
                  </button>
                  <button className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-xs font-bold transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
