import React from 'react';
import { Database, Github, Slack, Mail, Globe, Lock, Plus, ExternalLink } from 'lucide-react';

const CONNECTORS = [
  { id: 'github', name: 'GitHub', icon: Github, status: 'connected', type: 'SaaS' },
  { id: 'slack', name: 'Slack', icon: Slack, status: 'connected', type: 'SaaS' },
  { id: 'notion', name: 'Notion', icon: Globe, status: 'disconnected', type: 'SaaS' },
  { id: 'postgres', name: 'PostgreSQL', icon: Database, status: 'connected', type: 'Database' },
  { id: 'gmail', name: 'Gmail', icon: Mail, status: 'disconnected', type: 'SaaS' },
];

import { OSAppWindow } from '../hooks/useOS';

interface MCPConnectorsProps {
  windowData?: OSAppWindow;
}

export const MCPConnectors: React.FC<MCPConnectorsProps> = ({ windowData }) => {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-8 border-b border-black/5 bg-zinc-50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">MCP Connectors</h1>
            <p className="text-sm text-zinc-500">Model Context Protocol bridge for external data sources.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all">
            <Plus size={18} />
            Add Connector
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto grid grid-cols-2 gap-6">
          {CONNECTORS.map(conn => (
            <div key={conn.id} className="p-6 bg-white border border-black/5 rounded-2xl shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <conn.icon size={24} className="text-zinc-600" />
                </div>
                <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${conn.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                  {conn.status}
                </div>
              </div>
              <div className="space-y-1 mb-6">
                <h3 className="font-bold">{conn.name}</h3>
                <p className="text-xs text-zinc-500">{conn.type} Integration</p>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-black/5">
                <button className="text-xs font-bold text-zinc-400 hover:text-black transition-colors">Configure</button>
                <ExternalLink size={14} className="text-zinc-300" />
              </div>
            </div>
          ))}
          
          <div className="p-6 border-2 border-dashed border-black/5 rounded-2xl flex flex-col items-center justify-center gap-3 text-zinc-400 hover:border-black/10 hover:text-zinc-600 transition-all cursor-pointer">
            <Plus size={32} />
            <span className="text-xs font-bold">Request New Connector</span>
          </div>
        </div>
      </div>
    </div>
  );
};
