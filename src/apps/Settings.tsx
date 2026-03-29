import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Settings as SettingsIcon, Shield, Palette, Globe, Key, Bell, Info, Bot, Zap, Database, Monitor, Brain, Check, RefreshCw, Download, ArrowUpCircle, Rocket, Power } from 'lucide-react';
import { cn } from '../lib/utils';
import { OSAppWindow } from '../hooks/useOS';
import { useSettingsStore } from '../stores/settingsStore';
import { ProviderLogos } from '../components/icons/ProviderIcons';

interface SettingsProps {
  windowData?: OSAppWindow;
}

export const SettingsApp: React.FC<SettingsProps> = ({ windowData }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [launchOnStartup, setLaunchOnStartup] = useState(false);

  const { aiConfig, updateAiConfig, updateProvider, theme, setTheme } = useSettingsStore();
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);

  // Update State
  const [updateStatus, setUpdateStatus] = useState<{
    state: 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error';
    progress?: any;
    info?: any;
    error?: string;
  }>({ state: 'idle' });

  useEffect(() => {
    // @ts-ignore
    if (window.electron?.updates) {
      // @ts-ignore
      const unsubscribe = window.electron.updates.onStatus((status: any) => {
        setUpdateStatus(status);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleCheckUpdate = async () => {
    setUpdateStatus({ state: 'checking' });
    // @ts-ignore
    await window.electron?.updates.check();
  };

  const handleDownloadUpdate = async () => {
    // @ts-ignore
    await window.electron?.updates.download();
  };

  const handleInstallUpdate = async () => {
    // @ts-ignore
    await window.electron?.updates.install();
  };

  const toggleLaunchOnStartup = useCallback(async () => {
    const newValue = !launchOnStartup;
    setLaunchOnStartup(newValue);
    // @ts-ignore
    if (window.electron?.system?.setAutoLaunch) {
      // @ts-ignore
      await window.electron.system.setAutoLaunch(newValue);
    }
  }, [launchOnStartup]);

  useEffect(() => {
    // @ts-ignore
    if (window.electron?.system?.getAutoLaunch) {
      // @ts-ignore
      window.electron.system.getAutoLaunch().then((enabled: boolean) => {
        setLaunchOnStartup(enabled);
      });
    }
  }, []);

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
    { id: 'general', name: 'General', icon: SettingsIcon },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'ai', name: 'AI Models', icon: Bot },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'network', name: 'Network', icon: Globe },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'updates', name: 'Updates', icon: RefreshCw },
    { id: 'about', name: 'About', icon: Info },
  ];



  return (
    <div className="flex h-full bg-white font-sans">
      {/* Sidebar */}
      <div className="w-60 border-r border-zinc-100 p-4 space-y-1 bg-zinc-50/50">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
              activeTab === tab.id
                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                : "hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900"
            )}
          >
            <tab.icon size={18} className={cn(activeTab === tab.id ? "text-blue-500" : "text-zinc-400")} />
            {tab.name}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl space-y-8">
          <div>
            <h1 className="text-2xl font-bold mb-2 tracking-tight text-zinc-900">{TABS.find(t => t.id === activeTab)?.name}</h1>
            <p className="text-zinc-500 text-sm">Configure your system preferences.</p>
          </div>

          {activeTab === 'general' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-6">
                <div className="p-5 border border-zinc-200 rounded-2xl bg-zinc-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Rocket size={24} className="text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-900">Launch on Startup</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">Automatically start Neuro OS when you log in</p>
                      </div>
                    </div>
                    <button
                      onClick={toggleLaunchOnStartup}
                      className={`
                        relative w-14 h-7 rounded-full transition-all duration-300 outline-none focus:ring-2 focus:ring-blue-500/20
                        ${launchOnStartup ? 'bg-blue-600' : 'bg-zinc-200'}
                      `}
                    >
                      <div
                        className={`
                          absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300
                          ${launchOnStartup ? 'translate-x-8' : 'translate-x-1'}
                        `}
                      />
                    </button>
                  </div>
                </div>

                <div className="p-5 border border-zinc-200 rounded-2xl bg-zinc-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                        <Power size={24} className="text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-900">System Status</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">Neuro OS is running normally</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-xs font-medium text-emerald-600">Online</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900">Theme Mode</h3>
                <div className="grid grid-cols-3 gap-4">
                  {['Light', 'Dark', 'System'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setTheme(mode as 'Light' | 'Dark' | 'System')}
                      className={cn(
                        "p-4 border rounded-2xl flex flex-col items-center gap-3 transition-all duration-200 outline-none focus:ring-2 focus:ring-blue-500/20",
                        theme === mode ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50/50" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                      )}
                    >
                      <div className={cn("w-full aspect-video rounded-lg shadow-sm", mode === 'Dark' ? 'bg-zinc-900' : 'bg-white border border-zinc-100')} />
                      <span className={cn("text-xs font-medium", theme === mode ? "text-blue-700" : "text-zinc-600")}>{mode}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900">Accent Color</h3>
                <div className="flex gap-3">
                  {['bg-blue-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-zinc-900'].map(color => (
                    <button key={color} className={cn("w-8 h-8 rounded-full transition-transform hover:scale-110 shadow-sm", color)} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Active Provider Selector */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">Active Provider</h3>
                  <span className="text-xs text-zinc-500 bg-zinc-100 px-2 py-1 rounded-full">{aiConfig.providers.length} Available</span>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {aiConfig.providers.map(provider => {
                    const Icon = ProviderLogos[provider.type] || ProviderLogos.custom;
                    const isActive = aiConfig.activeProviderId === provider.id;

                    return (
                      <button
                        key={provider.id}
                        onClick={() => updateAiConfig({ activeProviderId: provider.id })}
                        className={cn(
                          "relative group p-4 border rounded-2xl flex flex-col gap-3 transition-all duration-300 text-left outline-none",
                          isActive
                            ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500 shadow-sm"
                            : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/50 hover:shadow-sm"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                            isActive ? "bg-white shadow-sm text-blue-600" : "bg-zinc-100 text-zinc-500 group-hover:bg-white group-hover:shadow-sm group-hover:text-zinc-700"
                          )}>
                            <Icon size={24} />
                          </div>
                          {isActive && (
                            <div className="p-1 bg-blue-500 rounded-full text-white shadow-sm animate-in zoom-in duration-200">
                              <Check size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="text-sm font-bold text-zinc-900">{provider.name}</div>
                          <div className="text-xs text-zinc-500 truncate max-w-full opacity-0 group-hover:opacity-100 transition-opacity absolute top-4 right-4">
                            {provider.type.toUpperCase()}
                          </div>
                          <div className={cn("text-xs mt-0.5 truncate", isActive ? "text-blue-600 font-medium" : "text-zinc-500")}>
                            {provider.selectedModel || "Not configured"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Configuration Section */}
              <div className="space-y-6 pt-6 border-t border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-500 rounded-full" />
                  Configuration
                </h3>

                {aiConfig.providers.map(provider => (
                  <div key={provider.id} className={cn("space-y-5 animate-in slide-in-from-right-2 duration-300", aiConfig.activeProviderId === provider.id ? "block" : "hidden")}>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Model Name</label>
                        <div className="relative group">
                          <input
                            type="text"
                            value={provider.selectedModel}
                            onChange={(e) => updateProvider(provider.id, { selectedModel: e.target.value })}
                            placeholder="e.g. gpt-4, llama3, claude-3-opus"
                            className="w-full p-3 pl-10 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 group-hover:border-zinc-300 shadow-sm"
                          />
                          <div className="absolute left-3 top-3.5 text-zinc-400 group-focus-within:text-blue-500 transition-colors">
                            <Bot size={16} />
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-400 pl-1">
                          Enter the exact model ID required by the API.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Endpoint URL</label>
                        <div className="relative group">
                          <input
                            value={provider.baseUrl}
                            onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })}
                            placeholder="https://api.example.com/v1"
                            className="w-full p-3 pl-10 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 group-hover:border-zinc-300 shadow-sm"
                          />
                          <div className="absolute left-3 top-3.5 text-zinc-400 group-focus-within:text-blue-500 transition-colors">
                            <Globe size={16} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">API Key</label>
                      <div className="relative group">
                        <input
                          type="password"
                          placeholder={provider.apiKey ? "••••••••••••••••••••••••" : "Enter API Key"}
                          value={provider.apiKey}
                          onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })}
                          className="w-full p-3 pl-10 bg-white border border-zinc-200 rounded-xl text-sm text-zinc-900 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 group-hover:border-zinc-300 shadow-sm placeholder:text-zinc-300"
                        />
                        <div className="absolute left-3 top-3.5 text-zinc-400 group-focus-within:text-blue-500 transition-colors">
                          <Key size={16} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-blue-50/50 rounded-lg border border-blue-100/50">
                        <Shield size={12} className="text-blue-500" />
                        <span className="text-[10px] text-blue-600 font-medium">Your keys are encrypted and stored locally. They never leave your device except to query the API.</span>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <Shield size={18} className="text-blue-500" />
                  PIN Management
                </h3>
                <div className="p-4 border border-zinc-200 rounded-2xl space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Current PIN</label>
                    <input type="password" placeholder="Enter current PIN" className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">New PIN</label>
                    <input type="password" placeholder="Enter new PIN" className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                  </div>
                  <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                    Update PIN
                  </button>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-900">Session & Security</h3>
                <div className="p-4 border border-zinc-200 rounded-2xl space-y-2 bg-zinc-50/50">
                  <p className="text-xs text-zinc-600"><span className="font-medium text-zinc-900">Failed Attempts:</span> 0 / 5</p>
                  <p className="text-xs text-zinc-600"><span className="font-medium text-zinc-900">Last Login:</span> Just now</p>
                  <button className="w-full mt-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors border border-red-200">
                    Sign Out All Sessions
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'network' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                  <Globe size={18} className="text-blue-500" />
                  Network Status
                </h3>
                <div className="p-4 border border-zinc-200 rounded-2xl space-y-3 bg-zinc-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600"><span className="font-medium text-zinc-900">Connection:</span></span>
                    <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      Online
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600"><span className="font-medium text-zinc-900">Connection Type:</span></span>
                    <span className="text-xs font-medium text-zinc-900">{navigator.onLine ? 'WiFi' : 'Offline'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-600"><span className="font-medium text-zinc-900">Download Speed:</span></span>
                    <span className="text-xs font-medium text-zinc-900">100 Mbps</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-900">P2P Chat Server</h3>
                <div className="p-4 border border-zinc-200 rounded-2xl space-y-2">
                  <label className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Server URL</label>
                  <input
                    type="text"
                    placeholder="wss://example.com"
                    className="w-full p-3 bg-white border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={useSettingsStore().p2pServerUrl}
                    onChange={(e) => useSettingsStore().setP2PServerUrl(e.target.value)}
                  />
                  <p className="text-[10px] text-zinc-400 mt-2">Configure your P2P chat server endpoint (wss:// for secure)</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-zinc-900">Notification Preferences</h3>
                {[
                  { label: 'System Alerts', key: 'alerts' },
                  { label: 'Chat Messages', key: 'chat' },
                  { label: 'Tool Completions', key: 'tools' },
                  { label: 'Updates Available', key: 'updates' }
                ].map(notif => (
                  <div key={notif.key} className="p-4 border border-zinc-200 rounded-2xl flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-900">{notif.label}</span>
                    <button className="relative w-12 h-6 rounded-full bg-blue-600 transition-all" />
                  </div>
                ))}
              </div>

              <div className="space-y-4 pt-4 border-t border-zinc-100">
                <h3 className="text-sm font-semibold text-zinc-900">Permission Status</h3>
                <div className="space-y-2 p-4 border border-zinc-200 rounded-2xl bg-zinc-50/50">
                  <p className="text-xs"><span className="font-medium text-zinc-900">Notifications:</span> <span className="text-emerald-600">Allowed</span></p>
                  <p className="text-xs"><span className="font-medium text-zinc-900">Sound:</span> <span className="text-emerald-600">Enabled</span></p>
                  <p className="text-xs"><span className="font-medium text-zinc-900">Desktop Badges:</span> <span className="text-emerald-600">Enabled</span></p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'updates' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-6 border border-zinc-100 rounded-2xl bg-zinc-50/30 flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm border border-zinc-100">
                  <RefreshCw className={cn("text-blue-500", updateStatus.state === 'checking' && "animate-spin")} size={24} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-900">System Updates</h3>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">v1.0.0</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {updateStatus.state === 'idle' && "Keep your Neuro OS intelligence core up to date."}
                    {updateStatus.state === 'checking' && "Searching for newer intelligence modules..."}
                    {updateStatus.state === 'available' && "A new update is ready for your system."}
                    {updateStatus.state === 'up-to-date' && "Your system is running the latest intelligence core."}
                    {updateStatus.state === 'downloading' && `Downloading update: ${Math.round(updateStatus.progress?.percent || 0)}%`}
                    {updateStatus.state === 'downloaded' && "Update downloaded and ready for installation."}
                    {updateStatus.state === 'error' && `Update error: ${updateStatus.error}`}
                  </p>

                  {updateStatus.state === 'downloading' && (
                    <div className="w-full h-1 bg-zinc-100 rounded-full mt-4 overflow-hidden">
                      <motion.div
                        className="h-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${updateStatus.progress?.percent || 0}%` }}
                      />
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    {(updateStatus.state === 'idle' || updateStatus.state === 'up-to-date' || updateStatus.state === 'error' || updateStatus.state === 'checking') && (
                      <button
                        onClick={handleCheckUpdate}
                        disabled={updateStatus.state === 'checking'}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-medium hover:bg-zinc-800 transition-all disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={updateStatus.state === 'checking' ? "animate-spin" : ""} />
                        Check for Updates
                      </button>
                    )}

                    {updateStatus.state === 'available' && (
                      <button
                        onClick={handleDownloadUpdate}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 transition-all"
                      >
                        <Download size={14} />
                        Download Update
                      </button>
                    )}

                    {updateStatus.state === 'downloaded' && (
                      <button
                        onClick={handleInstallUpdate}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-medium hover:bg-emerald-700 transition-all"
                      >
                        <ArrowUpCircle size={14} />
                        Install and Restart
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] ml-1">Update History</h3>
                <div className="space-y-2">
                  <div className="p-4 border border-zinc-100 rounded-xl flex items-center justify-between bg-white">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">v1.0.0 Initial Release</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">February 20, 2026</div>
                    </div>
                    <div className="text-[10px] font-bold text-emerald-500 uppercase">Installed</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300 text-center py-12">
              <h1 className="text-4xl font-light tracking-tighter text-zinc-900">
                Neuro OS<span className="align-top text-[12px] ml-1 font-bold">TM</span>
              </h1>
              <p className="text-zinc-400 text-sm mt-2">Experimental Neural Operating Environment</p>
              <div className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.4em] mt-8">Version __APP_VERSION__</div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
