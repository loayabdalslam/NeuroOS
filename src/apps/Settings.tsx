import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bot,
  Check,
  Cloud,
  Download,
  Image,
  Info,
  KeyRound,
  Link2,
  Mail,
  Palette,
  RefreshCw,
  Shield,
  Sparkles,
  Upload,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { OSAppWindow } from '../hooks/useOS';
import { useSettingsStore } from '../stores/settingsStore';
import { applyThemeToDOM, themeDescriptions, type ThemeVariant } from '../lib/designSystem/themes';
import { useComposioStore } from '../stores/composioStore';
import { useAuthStore } from '../stores/authStore';

declare const __APP_VERSION__: string;

interface SettingsProps {
  windowData?: OSAppWindow;
}

const TABS = [
  { id: 'appearance', name: 'Appearance', icon: Palette },
  { id: 'ai', name: 'Codex & AI', icon: Bot },
  { id: 'integrations', name: 'Integrations', icon: Link2 },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'security', name: 'Security', icon: Shield },
  { id: 'updates', name: 'Updates', icon: RefreshCw },
  { id: 'about', name: 'About', icon: Info },
] as const;

const SettingCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className }) => (
  <div className={cn('rounded-[30px] border border-white/50 bg-white/60 backdrop-blur-[var(--shell-blur)] shadow-[var(--shell-shadow)] p-5', className)}>
    <div className="mb-4">
      <div className="text-base font-semibold text-zinc-900 tracking-tight">{title}</div>
      {subtitle && <div className="text-sm text-zinc-500 mt-1">{subtitle}</div>}
    </div>
    {children}
  </div>
);

export const SettingsApp: React.FC<SettingsProps> = () => {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('appearance');
  const [composioApiKey, setComposioApiKey] = useState('');
  const {
    aiConfig,
    updateAiConfig,
    updateProvider,
    theme,
    setTheme,
    notificationsEnabled,
    soundEnabled,
    desktopBadgesEnabled,
    setNotifications,
    setSound,
    setDesktopBadges,
    wallpaper,
    setWallpaper,
    customWallpapers,
    addCustomWallpaper,
    removeCustomWallpaper,
    wallpaperGallery,
    cacheRemoteWallpaper,
  } = useSettingsStore();
  const { activeUserId, users } = useAuthStore();
  const {
    initialized,
    integrations,
    setApiKey,
    refreshConnections,
    connectApp,
    disconnectApp,
    getIntegration,
  } = useComposioStore();

  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.3.0';
  const activeUser = users.find((item) => item.id === activeUserId);
  const activeProvider = aiConfig.providers.find((item) => item.id === aiConfig.activeProviderId) || aiConfig.providers[0];
  const codingProviders = aiConfig.providers.filter((item) => item.category === 'coding');
  const generalProviders = aiConfig.providers.filter((item) => item.category !== 'coding');

  const integrationCards = useMemo(() => ([
    { id: 'gmail', name: 'Gmail', subtitle: 'Mail tools and inbox workflows', icon: Mail },
    { id: 'googlecalendar', name: 'Google Calendar', subtitle: 'Calendar events and widget sync', icon: Cloud },
  ]), []);

  useEffect(() => {
    if (activeUserId && initialized) {
      refreshConnections(activeUserId);
    }
  }, [activeUserId, initialized, refreshConnections]);

  const handleWallpaperUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        setWallpaper(url);
        addCustomWallpaper(url);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleRemoteWallpaper = async (src: string) => {
    const cached = await cacheRemoteWallpaper(src);
    setWallpaper(cached || src);
  };

  const handleInitializeComposio = async () => {
    if (!composioApiKey.trim()) return;
    const ok = await setApiKey(composioApiKey.trim());
    if (ok && activeUserId) {
      refreshConnections(activeUserId);
    }
  };

  const handleConnect = async (appName: 'gmail' | 'googlecalendar') => {
    if (!activeUserId) return;
    const result = await connectApp(appName, activeUserId);
    if (result.redirectUrl) {
      window.electron.browser.openExternal(result.redirectUrl);
    }
  };

  return (
    <div className="flex h-full bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(241,245,249,0.95))]">
      <aside className="w-72 border-r border-white/50 bg-white/30 backdrop-blur-[var(--shell-blur)] p-4">
        <div className="px-2 py-3">
          <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-400 font-semibold">NeuroOS</div>
          <div className="text-2xl font-semibold tracking-tight text-zinc-900 mt-1">Settings</div>
          <div className="text-sm text-zinc-500 mt-1">Minimal system controls with Codex, integrations, and wallpapers.</div>
        </div>
        <div className="mt-4 space-y-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all',
                activeTab === tab.id ? 'bg-white/75 text-zinc-900 shadow-sm border border-white/60' : 'text-zinc-500 hover:bg-white/45 hover:text-zinc-800'
              )}
            >
              <tab.icon size={18} />
              <span className="font-medium">{tab.name}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-5xl space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-zinc-400 font-semibold">{TABS.find((tab) => tab.id === activeTab)?.name}</div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 mt-1">Refined, iOS-inspired control center</h1>
            </div>
            <div className="rounded-[28px] bg-white/65 px-4 py-3 border border-white/50 shadow-sm text-right">
              <div className="text-sm font-semibold text-zinc-900">{activeUser?.name || 'NeuroOS User'}</div>
              <div className="text-xs text-zinc-500">{activeUser?.bio || 'Codex-enabled workspace'}</div>
            </div>
          </div>

          {activeTab === 'appearance' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6">
              <SettingCard title="Theme" subtitle="Glass surfaces, blur, and system-aware colors.">
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(themeDescriptions).map(([themeKey, description]) => (
                    <button
                      key={themeKey}
                      onClick={() => { setTheme(themeKey as ThemeVariant); applyThemeToDOM(themeKey as ThemeVariant); }}
                      className={cn(
                        'rounded-[22px] border px-3 py-4 text-left transition-all',
                        theme === themeKey ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-white/60 bg-white/50 hover:bg-white/80'
                      )}
                    >
                      <div className="text-sm font-semibold capitalize">{themeKey}</div>
                      <div className={cn('text-xs mt-1', theme === themeKey ? 'text-zinc-300' : 'text-zinc-500')}>{description}</div>
                    </button>
                  ))}
                </div>
              </SettingCard>

              <SettingCard title="Current wallpaper" subtitle="Switch between uploaded, cached, and curated gallery items.">
                <div className="aspect-[16/10] rounded-[26px] overflow-hidden border border-white/60 bg-zinc-100">
                  {wallpaper ? (
                    <img src={wallpaper} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[linear-gradient(135deg,#dbeafe,#eff6ff_35%,#f8fafc)]" />
                  )}
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={handleWallpaperUpload} className="rounded-2xl bg-zinc-900 text-white px-4 py-2.5 text-sm font-medium flex items-center gap-2">
                    <Upload size={14} />
                    Upload
                  </button>
                  <button onClick={() => setWallpaper('')} className="rounded-2xl bg-white/60 border border-white/50 px-4 py-2.5 text-sm font-medium text-zinc-700">
                    Reset
                  </button>
                </div>
              </SettingCard>

              <SettingCard title="Wallpaper Gallery" subtitle="Curated remote gallery with local caching for offline reuse." className="xl:col-span-2">
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                  {wallpaperGallery.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleRemoteWallpaper(item.cachedPath || item.src)}
                      className={cn('rounded-[24px] overflow-hidden border transition-all bg-white/45', wallpaper === item.src || wallpaper === item.cachedPath ? 'border-zinc-900 shadow-lg' : 'border-white/55 hover:border-zinc-300')}
                    >
                      <div className="aspect-[4/5]">
                        <img src={item.thumbnail || item.src} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-3 text-left">
                        <div className="text-sm font-semibold text-zinc-900">{item.name}</div>
                        <div className="text-xs text-zinc-500 mt-1">{item.collection || item.source}</div>
                      </div>
                    </button>
                  ))}
                  {customWallpapers.map((item) => (
                    <div key={item} className="rounded-[24px] overflow-hidden border border-white/55 bg-white/45">
                      <button onClick={() => setWallpaper(item)} className="w-full">
                        <div className="aspect-[4/5]">
                          <img src={item} alt="" className="w-full h-full object-cover" />
                        </div>
                      </button>
                      <div className="p-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">Upload</div>
                          <div className="text-xs text-zinc-500">Local image</div>
                        </div>
                        <button onClick={() => removeCustomWallpaper(item)} className="text-xs text-rose-500 font-medium">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </SettingCard>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6">
              <SettingCard title="Codex & coding models" subtitle="Secure main-process transport for OpenAI/Codex-capable providers.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {codingProviders.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => updateAiConfig({ activeProviderId: provider.id })}
                      className={cn(
                        'rounded-[24px] border px-4 py-4 text-left transition-all',
                        aiConfig.activeProviderId === provider.id ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white/55 border-white/55 hover:bg-white/80'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{provider.name}</div>
                        {provider.secureTransport === 'main' && <span className="text-[10px] uppercase tracking-[0.24em] text-sky-400">Secure</span>}
                      </div>
                      <div className={cn('text-xs mt-2', aiConfig.activeProviderId === provider.id ? 'text-zinc-300' : 'text-zinc-500')}>
                        {provider.selectedModel}
                      </div>
                    </button>
                  ))}
                </div>
              </SettingCard>

              <SettingCard title="Provider details" subtitle="Use OpenAI as the Codex provider with model-level control.">
                <div className="space-y-4">
                  <label className="block">
                    <div className="text-sm font-medium text-zinc-700 mb-2">Base URL</div>
                    <input
                      value={activeProvider?.baseUrl || ''}
                      onChange={(e) => updateProvider(activeProvider.id, { baseUrl: e.target.value })}
                      className="w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm outline-none"
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm font-medium text-zinc-700 mb-2">API Key</div>
                    <input
                      type="password"
                      value={activeProvider?.apiKey || ''}
                      onChange={(e) => updateProvider(activeProvider.id, { apiKey: e.target.value })}
                      className="w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm outline-none"
                      placeholder={activeProvider.type === 'openai' ? 'OpenAI / Codex API key' : 'Provider API key'}
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm font-medium text-zinc-700 mb-2">Model</div>
                    <select
                      value={activeProvider?.selectedModel || ''}
                      onChange={(e) => updateProvider(activeProvider.id, { selectedModel: e.target.value })}
                      className="w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm outline-none"
                    >
                      {(activeProvider?.models || []).map((model) => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                  </label>
                  <div className="rounded-[24px] bg-sky-50 border border-sky-100 p-4 text-sm text-sky-700">
                    “Sign in with Codex/OpenAI” is implemented as secure provider onboarding first. Account-style OAuth can be added later if a supported public flow is available.
                  </div>
                </div>
              </SettingCard>

              <SettingCard title="General models" subtitle="Keep chat and research providers separate from coding-focused flows." className="xl:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {generalProviders.map((provider) => (
                    <div key={provider.id} className="rounded-[22px] border border-white/55 bg-white/45 p-4">
                      <div className="font-semibold text-zinc-900">{provider.name}</div>
                      <div className="text-xs text-zinc-500 mt-1">{provider.selectedModel}</div>
                    </div>
                  ))}
                </div>
              </SettingCard>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6">
              <SettingCard title="Composio setup" subtitle="Enable Gmail and Google Calendar with a single integration key.">
                <div className="space-y-4">
                  <label className="block">
                    <div className="text-sm font-medium text-zinc-700 mb-2">Composio API Key</div>
                    <input
                      type="password"
                      value={composioApiKey}
                      onChange={(e) => setComposioApiKey(e.target.value)}
                      className="w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm outline-none"
                      placeholder="Paste your Composio key"
                    />
                  </label>
                  <button onClick={handleInitializeComposio} className="rounded-2xl bg-zinc-900 text-white px-4 py-3 text-sm font-medium flex items-center gap-2">
                    <KeyRound size={14} />
                    {initialized ? 'Reinitialize Composio' : 'Initialize Composio'}
                  </button>
                </div>
              </SettingCard>

              <SettingCard title="Connection status" subtitle="Gmail and Calendar power widgets, task automation, and AI tool flows.">
                <div className="space-y-3">
                  {integrationCards.map((item) => {
                    const connected = getIntegration(item.id as 'gmail' | 'googlecalendar');
                    return (
                      <div key={item.id} className="rounded-[24px] border border-white/60 bg-white/45 p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center">
                            <item.icon size={18} />
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-900">{item.name}</div>
                            <div className="text-xs text-zinc-500 mt-1">{connected?.accountLabel || item.subtitle}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {connected?.status === 'connected' ? (
                            <>
                              <span className="text-xs font-semibold text-emerald-600">Connected</span>
                              <button onClick={() => disconnectApp(connected.id, activeUserId || '')} className="rounded-2xl bg-white px-3 py-2 text-xs font-medium border border-white/60">
                                Disconnect
                              </button>
                            </>
                          ) : (
                            <button onClick={() => handleConnect(item.id as 'gmail' | 'googlecalendar')} className="rounded-2xl bg-zinc-900 text-white px-3 py-2 text-xs font-medium">
                              Connect
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SettingCard>

              <SettingCard title="Synced accounts" subtitle="Live account metadata persisted in NeuroOS." className="xl:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {integrations.length === 0 && (
                    <div className="rounded-[24px] border border-dashed border-zinc-300 bg-white/40 p-5 text-sm text-zinc-500">
                      No accounts connected yet.
                    </div>
                  )}
                  {integrations.map((integration) => (
                    <div key={integration.id} className="rounded-[24px] border border-white/60 bg-white/45 p-4">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-zinc-900">{integration.appName}</div>
                        <div className="text-xs font-semibold text-emerald-600">{integration.status}</div>
                      </div>
                      <div className="text-sm text-zinc-600 mt-2">{integration.accountLabel}</div>
                      <div className="text-xs text-zinc-500 mt-1">{integration.permissions.join(', ') || 'Standard permissions'}</div>
                    </div>
                  ))}
                </div>
              </SettingCard>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SettingCard title="System notifications">
                <Toggle title="Notifications" value={notificationsEnabled} onChange={setNotifications} />
              </SettingCard>
              <SettingCard title="Audio">
                <Toggle title="System sounds" value={soundEnabled} onChange={setSound} />
              </SettingCard>
              <SettingCard title="Desktop badges">
                <Toggle title="Widget & app badges" value={desktopBadgesEnabled} onChange={setDesktopBadges} />
              </SettingCard>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SettingCard title="Account mode" subtitle="PIN-based local auth remains active.">
                <div className="rounded-[24px] bg-zinc-900 text-white p-5">
                  <div className="text-sm font-semibold">Authenticated as {activeUser?.name || 'User'}</div>
                  <div className="text-xs text-zinc-300 mt-2">Workspace, provider, and integration state stay scoped to the current local profile.</div>
                </div>
              </SettingCard>
              <SettingCard title="LLM transport" subtitle="OpenAI/Codex requests now prefer the main process for secure transport.">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-zinc-600">
                    <Check size={14} className="text-emerald-500" />
                    Main-process bridge for OpenAI/Codex-capable models
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-600">
                    <Check size={14} className="text-emerald-500" />
                    Cached wallpaper downloads stored outside the renderer
                  </div>
                  <div className="flex items-center gap-3 text-sm text-zinc-600">
                    <Check size={14} className="text-emerald-500" />
                    Builder publish flow stored through Electron IPC
                  </div>
                </div>
              </SettingCard>
            </div>
          )}

          {activeTab === 'updates' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SettingCard title="Runtime upgrades" subtitle="Builder and provider changes are designed for iterative rollout.">
                <div className="rounded-[24px] bg-white/50 border border-white/60 p-5 text-sm text-zinc-600">
                  The app now includes wallpaper caching, builder publish metadata, Composio account state, and a dedicated Codex-ready provider track.
                </div>
              </SettingCard>
              <SettingCard title="Next step" subtitle="Check or install available updates from the app menu when packaged.">
                <button className="rounded-2xl bg-zinc-900 text-white px-4 py-3 text-sm font-medium flex items-center gap-2">
                  <Download size={14} />
                  Update controls available in packaged builds
                </button>
              </SettingCard>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SettingCard title="NeuroOS" subtitle="AI-native desktop shell">
                <div className="space-y-3 text-sm text-zinc-600">
                  <div className="flex items-center gap-2"><Sparkles size={14} className="text-sky-500" />Version {version}</div>
                  <div className="flex items-center gap-2"><Bot size={14} className="text-zinc-500" />Codex-ready provider path</div>
                  <div className="flex items-center gap-2"><Image size={14} className="text-zinc-500" />Wallpaper gallery + local caching</div>
                </div>
              </SettingCard>
              <SettingCard title="Current profile" subtitle="Local state overview">
                <div className="text-sm text-zinc-600">
                  Active user: <span className="font-semibold text-zinc-900">{activeUser?.name || 'User'}</span>
                </div>
                <div className="text-sm text-zinc-600 mt-2">
                  Active provider: <span className="font-semibold text-zinc-900">{activeProvider?.name}</span>
                </div>
              </SettingCard>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const Toggle: React.FC<{ title: string; value: boolean; onChange: (value: boolean) => void }> = ({ title, value, onChange }) => (
  <button
    onClick={() => onChange(!value)}
    className="w-full rounded-[24px] bg-white/45 border border-white/60 px-4 py-4 flex items-center justify-between"
  >
    <span className="text-sm font-medium text-zinc-800">{title}</span>
    <span className={cn('w-12 h-7 rounded-full transition-all relative', value ? 'bg-emerald-500' : 'bg-zinc-300')}>
      <span className={cn('absolute top-1 w-5 h-5 rounded-full bg-white transition-all', value ? 'left-6' : 'left-1')} />
    </span>
  </button>
);
