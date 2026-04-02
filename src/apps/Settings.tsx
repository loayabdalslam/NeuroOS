import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Settings as SettingsIcon, Shield, Palette, Key, Bell, Info, Bot, Check, RefreshCw, Download, ArrowUpCircle, Rocket, Power, Globe, Server, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { OSAppWindow } from '../hooks/useOS';
import { useSettingsStore } from '../stores/settingsStore';
import { ProviderLogos } from '../components/icons/ProviderIcons';
import { applyThemeToDOM, themeDescriptions, type ThemeVariant } from '../lib/designSystem/themes';

declare const __APP_VERSION__: string;

interface SettingsProps {
  windowData?: OSAppWindow;
}

export const SettingsApp: React.FC<SettingsProps> = ({ windowData }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const { aiConfig, updateAiConfig, updateProvider, theme, setTheme, notificationsEnabled, soundEnabled, desktopBadgesEnabled, setNotifications, setSound, setDesktopBadges } = useSettingsStore();

  // Update State
  const [updateStatus, setUpdateStatus] = useState<{
    state: 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error';
    progress?: any;
    info?: any;
    error?: string;
  }>({ state: 'idle' });

  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.3.0';

  useEffect(() => {
    if ((window as any).electron?.updates) {
      const unsubscribe = (window as any).electron.updates.onStatus((status: any) => setUpdateStatus(status));
      return () => unsubscribe();
    }
  }, []);

  const handleCheckUpdate = async () => { setUpdateStatus({ state: 'checking' }); await (window as any).electron?.updates?.check(); };
  const handleDownloadUpdate = async () => { await (window as any).electron?.updates?.download(); };
  const handleInstallUpdate = async () => { await (window as any).electron?.updates?.install(); };

  const toggleLaunchOnStartup = useCallback(async () => {
    const newValue = !launchOnStartup;
    setLaunchOnStartup(newValue);
    if ((window as any).electron?.system?.setAutoLaunch) await (window as any).electron.system.setAutoLaunch(newValue);
  }, [launchOnStartup]);

  useEffect(() => {
    if ((window as any).electron?.system?.getAutoLaunch) {
      (window as any).electron.system.getAutoLaunch().then((enabled: boolean) => setLaunchOnStartup(enabled));
    }
  }, []);

  const TABS = [
    { id: 'general', name: 'General', icon: SettingsIcon },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'ai', name: 'AI Models', icon: Bot },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'updates', name: 'Updates', icon: RefreshCw },
    { id: 'about', name: 'About', icon: Info },
  ];

  return (
    <div className="flex h-full bg-white font-sans">
      {/* Sidebar */}
      <div className="w-56 border-r border-zinc-100 p-3 space-y-0.5 bg-zinc-50/50">
        <div className="px-3 py-2 mb-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Settings</span>
        </div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-200",
              activeTab === tab.id
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200 font-medium"
                : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700"
            )}
          >
            <tab.icon size={16} className={cn(activeTab === tab.id ? "text-blue-500" : "text-zinc-400")} />
            {tab.name}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl space-y-8">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{TABS.find(t => t.id === activeTab)?.name}</h1>
            <p className="text-zinc-400 text-xs mt-1">Configure your system preferences</p>
          </div>

          {/* GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="p-4 border border-zinc-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center"><Rocket size={20} className="text-blue-500" /></div>
                  <div><h3 className="text-sm font-medium text-zinc-900">Launch on Startup</h3><p className="text-[11px] text-zinc-400">Start Neuro OS when you log in</p></div>
                </div>
                <button onClick={toggleLaunchOnStartup} className={cn("relative w-11 h-6 rounded-full transition-all", launchOnStartup ? 'bg-blue-500' : 'bg-zinc-200')}>
                  <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", launchOnStartup ? 'translate-x-[22px]' : 'translate-x-0.5')} />
                </button>
              </div>
              <div className="p-4 border border-zinc-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center"><Power size={20} className="text-emerald-500" /></div>
                  <div><h3 className="text-sm font-medium text-zinc-900">System Status</h3><p className="text-[11px] text-zinc-400">Neuro OS is running normally</p></div>
                </div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /><span className="text-xs font-medium text-emerald-600">Online</span></div>
              </div>
            </div>
          )}

          {/* APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(themeDescriptions).map(([themeKey, description]) => (
                  <button
                    key={themeKey}
                    onClick={() => { setTheme(themeKey as ThemeVariant); applyThemeToDOM(themeKey as ThemeVariant); }}
                    className={cn(
                      "p-3 border rounded-xl flex flex-col items-center gap-2 transition-all",
                      theme === themeKey ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/50" : "border-zinc-200 hover:border-zinc-300"
                    )}
                    title={description}
                  >
                    <div className={cn("w-8 h-8 rounded-lg",
                      themeKey === 'light' ? 'bg-white border-2 border-gray-300' :
                      themeKey === 'dark' ? 'bg-zinc-900 border-2 border-zinc-700' :
                      themeKey === 'cyan' ? 'bg-cyan-500' :
                      themeKey === 'purple' ? 'bg-purple-500' :
                      themeKey === 'amber' ? 'bg-amber-500' :
                      themeKey === 'rose' ? 'bg-rose-500' :
                      themeKey === 'system' ? 'bg-gradient-to-br from-zinc-300 to-zinc-600' :
                      'bg-slate-600'
                    )} />
                    <span className="text-[10px] font-medium capitalize">{themeKey}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-zinc-400">Choose from 8 color themes. Applied instantly.</p>
            </div>
          )}

          {/* AI MODELS */}
          {activeTab === 'ai' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-3 gap-3">
                {aiConfig.providers.map(provider => {
                  const Icon = ProviderLogos[provider.type] || ProviderLogos.custom;
                  const isActive = aiConfig.activeProviderId === provider.id;
                  return (
                    <button
                      key={provider.id}
                      onClick={() => updateAiConfig({ activeProviderId: provider.id })}
                      className={cn(
                        "relative p-4 border rounded-xl flex flex-col gap-2 text-left transition-all",
                        isActive ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", isActive ? "bg-white shadow-sm text-blue-600" : "bg-zinc-100 text-zinc-500")}>
                          <Icon size={20} />
                        </div>
                        {isActive && <div className="p-0.5 bg-blue-500 rounded-full text-white"><Check size={10} strokeWidth={3} /></div>}
                      </div>
                      <div><div className="text-xs font-semibold text-zinc-900">{provider.name}</div><div className="text-[10px] text-zinc-400 truncate">{provider.selectedModel || "Not configured"}</div></div>
                      {provider.type === 'opencode' && <span className="absolute top-2 right-2 text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">FREE</span>}
                    </button>
                  );
                })}
              </div>

              {/* Provider Config */}
              {aiConfig.providers.filter(p => p.id === aiConfig.activeProviderId).map(provider => (
                <div key={provider.id} className="space-y-4 pt-4 border-t border-zinc-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Model</label>
                      <input type="text" value={provider.selectedModel} onChange={(e) => updateProvider(provider.id, { selectedModel: e.target.value })} placeholder="e.g. gpt-4o" className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Endpoint URL</label>
                      <input value={provider.baseUrl} onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })} placeholder="https://api.example.com/v1" className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200" />
                    </div>
                  </div>
                  {provider.type !== 'ollama' && provider.type !== 'lmstudio' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">API Key</label>
                      <input type="password" placeholder={provider.apiKey ? "••••••••" : "Enter API Key"} value={provider.apiKey} onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })} className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 placeholder:text-zinc-300" />
                      <p className="text-[10px] text-zinc-400 flex items-center gap-1"><Shield size={10} /> Stored locally, never leaves your device</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="p-4 border border-zinc-200 rounded-xl space-y-3">
                <h3 className="text-sm font-medium text-zinc-900">PIN Management</h3>
                <p className="text-[11px] text-zinc-400">Manage your device PIN for secure access</p>
                <button className="w-full px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 transition-colors">Change PIN</button>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              {[
                { label: 'System Notifications', desc: 'Get notified about system events', enabled: notificationsEnabled, toggle: () => setNotifications(!notificationsEnabled) },
                { label: 'Sound Effects', desc: 'Play sounds for notifications', enabled: soundEnabled, toggle: () => setSound(!soundEnabled) },
                { label: 'Desktop Badges', desc: 'Show badge counts on app icons', enabled: desktopBadgesEnabled, toggle: () => setDesktopBadges(!desktopBadgesEnabled) },
              ].map(item => (
                <div key={item.label} className="p-4 border border-zinc-200 rounded-xl flex items-center justify-between">
                  <div><h3 className="text-sm font-medium text-zinc-900">{item.label}</h3><p className="text-[11px] text-zinc-400">{item.desc}</p></div>
                  <button onClick={item.toggle} className={cn("relative w-11 h-6 rounded-full transition-all", item.enabled ? 'bg-blue-500' : 'bg-zinc-200')}>
                    <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", item.enabled ? 'translate-x-[22px]' : 'translate-x-0.5')} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* UPDATES */}
          {activeTab === 'updates' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="p-5 border border-zinc-200 rounded-xl flex items-start gap-4">
                <div className="p-2.5 bg-zinc-50 rounded-lg"><RefreshCw className={cn("text-blue-500", updateStatus.state === 'checking' && "animate-spin")} size={20} /></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-zinc-900">System Updates</h3>
                    <span className="text-[10px] font-mono text-zinc-400">v{version}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {updateStatus.state === 'idle' && "Keep Neuro OS up to date"}
                    {updateStatus.state === 'checking' && "Checking for updates..."}
                    {updateStatus.state === 'available' && "Update available!"}
                    {updateStatus.state === 'up-to-date' && "You're on the latest version"}
                    {updateStatus.state === 'downloading' && `Downloading: ${Math.round(updateStatus.progress?.percent || 0)}%`}
                    {updateStatus.state === 'downloaded' && "Ready to install"}
                    {updateStatus.state === 'error' && `Error: ${updateStatus.error}`}
                  </p>
                  {updateStatus.state === 'downloading' && (
                    <div className="w-full h-1 bg-zinc-100 rounded-full mt-3 overflow-hidden">
                      <motion.div className="h-full bg-blue-500" initial={{ width: 0 }} animate={{ width: `${updateStatus.progress?.percent || 0}%` }} />
                    </div>
                  )}
                  <div className="flex gap-2 mt-4">
                    {(updateStatus.state === 'idle' || updateStatus.state === 'up-to-date' || updateStatus.state === 'error') && (
                      <button onClick={handleCheckUpdate} className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-medium hover:bg-zinc-800">
                        <RefreshCw size={12} /> Check for Updates
                      </button>
                    )}
                    {updateStatus.state === 'available' && (
                      <button onClick={handleDownloadUpdate} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                        <Download size={12} /> Download
                      </button>
                    )}
                    {updateStatus.state === 'downloaded' && (
                      <button onClick={handleInstallUpdate} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                        <ArrowUpCircle size={12} /> Install & Restart
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-4 border border-zinc-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div><div className="text-xs font-medium text-zinc-900">v{version}</div><div className="text-[10px] text-zinc-400">Current version</div></div>
                  <span className="text-[10px] font-medium text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full">Installed</span>
                </div>
              </div>
            </div>
          )}

          {/* ABOUT */}
          {activeTab === 'about' && (
            <div className="space-y-8 animate-in fade-in duration-300 text-center py-8">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 flex items-center justify-center mb-4 shadow-xl">
                  <span className="text-3xl font-light text-white tracking-tighter">N</span>
                </div>
                <h1 className="text-3xl font-light tracking-tighter text-zinc-900">
                  Neuro OS<span className="align-top text-[10px] ml-0.5 font-bold">TM</span>
                </h1>
                <p className="text-zinc-400 text-xs mt-1">Intelligent Operating Environment</p>
              </div>
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-50 rounded-full border border-zinc-100">
                  <span className="text-xs font-mono text-zinc-500">Version {version}</span>
                </div>
                <div className="flex items-center justify-center gap-4 text-[10px] text-zinc-300">
                  <span>MIT License</span>
                  <span>•</span>
                  <span>Open Source</span>
                  <span>•</span>
                  <span>2026</span>
                </div>
              </div>
              <div className="pt-4 border-t border-zinc-100">
                <p className="text-[11px] text-zinc-400">Built with React, TypeScript, Electron & Tailwind CSS</p>
                <a href="https://github.com/loayabdalslam/NeuroOS" target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:text-blue-600 mt-1 inline-block">github.com/loayabdalslam/NeuroOS</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
