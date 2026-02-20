import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, Palette, Globe, Key, Bell, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { OSAppWindow } from '../hooks/useOS';

interface SettingsProps {
  windowData?: OSAppWindow;
}

export const SettingsApp: React.FC<SettingsProps> = ({ windowData }) => {
  const [activeTab, setActiveTab] = useState('appearance');
  const [theme, setTheme] = useState('Light');

  useEffect(() => {
    if (windowData?.lastAction && windowData.lastAction.type === 'set_theme') {
      const newTheme = windowData.lastAction.payload;
      if (['Light', 'Dark', 'System'].includes(newTheme)) {
        setTheme(newTheme);
        setActiveTab('appearance');
      }
    }
  }, [windowData?.lastAction]);

  const TABS = [
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'network', name: 'Network', icon: Globe },
    { id: 'keys', name: 'API Keys', icon: Key },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'about', name: 'About', icon: Info },
  ];

  return (
    <div className="flex h-full bg-white">
      <div className="w-56 border-r border-black/5 p-4 space-y-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab.id ? "bg-black text-white" : "hover:bg-black/5 text-zinc-600"
            )}
          >
            <tab.icon size={18} />
            {tab.name}
          </button>
        ))}
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl space-y-8">
          <div>
            <h1 className="text-2xl font-bold mb-2">{TABS.find(t => t.id === activeTab)?.name}</h1>
            <p className="text-zinc-500 text-sm">Manage your system {activeTab} settings and preferences.</p>
          </div>

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-bold">Theme Mode</h3>
                <div className="grid grid-cols-3 gap-4">
                  {['Light', 'Dark', 'System'].map(mode => (
                    <button 
                      key={mode} 
                      onClick={() => setTheme(mode)}
                      className={cn(
                        "p-4 border-2 rounded-2xl flex flex-col items-center gap-2 transition-all",
                        theme === mode ? "border-black bg-zinc-50" : "border-black/5 hover:border-black/20"
                      )}
                    >
                      <div className={cn("w-full aspect-video rounded-lg", mode === 'Dark' ? 'bg-zinc-900' : 'bg-zinc-100')} />
                      <span className="text-xs font-medium">{mode}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold">Accent Color</h3>
                <div className="flex gap-3">
                  {['bg-blue-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-black'].map(color => (
                    <button key={color} className={cn("w-8 h-8 rounded-full", color, color === 'bg-black' && "ring-2 ring-offset-2 ring-black")} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'keys' && (
            <div className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
                <Info className="text-amber-600 shrink-0" size={20} />
                <p className="text-xs text-amber-800">
                  API keys are stored securely in your local vault. Never share your keys with anyone.
                </p>
              </div>

              <div className="space-y-4">
                {['OpenAI', 'Anthropic', 'Google Gemini', 'OpenRouter'].map(provider => (
                  <div key={provider} className="p-4 border border-black/5 rounded-xl flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{provider}</span>
                      <span className="text-xs text-zinc-400">sk-••••••••••••••••</span>
                    </div>
                    <button className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-xs font-medium transition-colors">
                      Update
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
