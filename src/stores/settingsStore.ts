import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ThemeVariant } from '../lib/designSystem/themes';

interface ProviderConfig {
    id: string;
    name: string;
    type: 'openai' | 'anthropic' | 'ollama' | 'lmstudio' | 'gemini' | 'groq' | 'mistral' | 'openrouter' | 'perplexity' | 'xai' | 'opencode' | 'custom';
    baseUrl: string;
    apiKey: string;
    selectedModel: string;
    models: string[];
}

interface SettingsState {
    wallpaper: string;
    customWallpapers: string[];
    theme: ThemeVariant;
    notificationsEnabled: boolean;
    soundEnabled: boolean;
    desktopBadgesEnabled: boolean;

    setWallpaper: (url: string) => void;
    setTheme: (theme: ThemeVariant) => void;
    setNotifications: (enabled: boolean) => void;
    setSound: (enabled: boolean) => void;
    setDesktopBadges: (enabled: boolean) => void;
    addCustomWallpaper: (url: string) => void;
    removeCustomWallpaper: (url: string) => void;

    aiConfig: {
        activeProviderId: string;
        providers: ProviderConfig[];
    };
    updateAiConfig: (config: Partial<SettingsState['aiConfig']>) => void;
    updateProvider: (providerId: string, updates: Partial<ProviderConfig>) => void;
    refreshProviderModels: (providerId: string) => Promise<void>;
    addProvider: (provider: ProviderConfig) => void;
    removeProvider: (providerId: string) => void;
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
    {
        id: 'opencode',
        name: 'OpenCode',
        type: 'opencode',
        baseUrl: 'https://api.opencode.ai/v1',
        apiKey: '',
        selectedModel: 'opencode-pro',
        models: [
            'opencode-pro', 'opencode-instant', 'opencode-lite', 
            'opencode-coder-pro', 'opencode-vision-pro', 'opencode-reasoning'
        ]
    },
    {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        selectedModel: 'gpt-5.4-thinking',
        models: ['gpt-5.4-thinking', 'gpt-5.4-pro', 'gpt-5.4-instant', 'gpt-rosalind', 'gpt-5.4-cyber']
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        type: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: '',
        selectedModel: 'claude-opus-4.7',
        models: ['claude-opus-4.7', 'claude-4.6-sonnet', 'claude-4.5-haiku']
    },
    {
        id: 'gemini',
        name: 'Gemini',
        type: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: '',
        selectedModel: 'gemini-3.1-pro',
        models: ['gemini-3.1-pro', 'gemini-3.1-flash', 'gemini-2.5-pro', 'gemini-1.5-pro']
    },
    {
        id: 'mistral',
        name: 'Mistral',
        type: 'mistral',
        baseUrl: 'https://api.mistral.ai/v1',
        apiKey: '',
        selectedModel: 'mistral-small-4',
        models: ['mistral-small-4', 'mistral-large-3', 'mistral-3-dense']
    },
    {
        id: 'groq',
        name: 'Groq',
        type: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: '',
        selectedModel: 'llama-4-405b',
        models: ['llama-4-405b', 'llama-4-70b', 'llama-4-8b', 'mistral-small-4']
    },
    {
        id: 'perplexity',
        name: 'Perplexity',
        type: 'perplexity',
        baseUrl: 'https://api.perplexity.ai',
        apiKey: '',
        selectedModel: 'sonar-3-pro',
        models: ['sonar-3-pro', 'sonar-3-small']
    },
    {
        id: 'xai',
        name: 'X.AI (Grok)',
        type: 'xai',
        baseUrl: 'https://api.x.ai/v1',
        apiKey: '',
        selectedModel: 'grok-4.20-beta',
        models: ['grok-4.20-beta', 'grok-4', 'grok-mini']
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        type: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: '',
        selectedModel: 'kimi-k2.6',
        models: ['kimi-k2.6', 'qwen-3.6-plus', 'trinity-large-preview', 'llama-4-8b']
    },
    {
        id: 'ollama',
        name: 'Ollama (Local)',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        apiKey: '',
        selectedModel: 'gemma4:e4b',
        models: [
            'gemma4:e4b', 'minimax-m2:cloud', 'granite4:350m', 
            'gemma3:latest', 'phi-4', 'deepseek-v3.1:671b-cloud'
        ]
    },
    {
        id: 'lmstudio',
        name: 'LM Studio (Local)',
        type: 'lmstudio',
        baseUrl: 'http://localhost:1234/v1',
        apiKey: '',
        selectedModel: 'local-model',
        models: ['local-model']
    }
];

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            wallpaper: '',
            customWallpapers: [],
            theme: 'system' as ThemeVariant,
            notificationsEnabled: true,
            soundEnabled: true,
            desktopBadgesEnabled: true,

            setWallpaper: (url) => set({ wallpaper: url }),
            setTheme: (theme: ThemeVariant) => {
                set({ theme });
                // Apply theme immediately
                import('../lib/designSystem/themes').then(m => m.applyThemeToDOM(theme));
            },
            setNotifications: (enabled) => set({ notificationsEnabled: enabled }),
            setSound: (enabled) => set({ soundEnabled: enabled }),
            setDesktopBadges: (enabled) => set({ desktopBadgesEnabled: enabled }),
            addCustomWallpaper: (url) => set((state) => ({
                customWallpapers: state.customWallpapers.includes(url)
                    ? state.customWallpapers
                    : [...state.customWallpapers, url]
            })),
            removeCustomWallpaper: (url) => set((state) => ({
                customWallpapers: state.customWallpapers.filter(u => u !== url),
                wallpaper: state.wallpaper === url ? '' : state.wallpaper
            })),

            aiConfig: {
                activeProviderId: 'opencode',
                providers: DEFAULT_PROVIDERS
            },

            updateAiConfig: (config) => set((state) => ({
                aiConfig: { ...state.aiConfig, ...config }
            })),

            updateProvider: (providerId, updates) => set((state) => ({
                aiConfig: {
                    ...state.aiConfig,
                    providers: state.aiConfig.providers.map(p =>
                        p.id === providerId ? { ...p, ...updates } : p
                    )
                }
            })),

            refreshProviderModels: async (providerId, overrideUrl) => {
                const provider = get().aiConfig.providers.find(p => p.id === providerId);
                if (!provider) return;

                try {
                    let modelNames: string[] = [];
                    if (provider.type === 'ollama') {
                        const baseUrl = (overrideUrl || provider.baseUrl || 'http://localhost:11434').replace(/\/$/, '');
                        const response = await fetch(`${baseUrl}/api/tags`);
                        const data = await response.json();
                        if (data && data.models) {
                            modelNames = data.models.map((m: any) => m.name);
                        }
                    } else if (provider.type === 'lmstudio') {
                        const baseUrl = (overrideUrl || provider.baseUrl || 'http://localhost:1234/v1').replace(/\/$/, '');
                        const response = await fetch(`${baseUrl}/models`);
                        const data = await response.json();
                        if (data && data.data) {
                            modelNames = data.data.map((m: any) => m.id);
                        }
                    }

                    if (modelNames.length > 0) {
                        const updates: any = { models: modelNames };
                        // Automatically select the first model if current selection is generic or empty
                        if (!provider.selectedModel || provider.selectedModel === 'local-model' || provider.selectedModel === 'llama-4-8b') {
                            updates.selectedModel = modelNames[0];
                        }
                        get().updateProvider(providerId, updates);
                        return { success: true, count: modelNames.length };
                    }
                    
                    return { success: false, error: 'No models found' };
                } catch (error: any) {
                    console.error(`Failed to refresh models for ${providerId}:`, error);
                    return { success: false, error: error.message };
                }
            },

            addProvider: (provider) => set((state) => ({
                aiConfig: {
                    ...state.aiConfig,
                    providers: [...state.aiConfig.providers, provider]
                }
            })),

            removeProvider: (providerId) => set((state) => ({
                aiConfig: {
                    ...state.aiConfig,
                    providers: state.aiConfig.providers.filter(p => p.id !== providerId),
                    activeProviderId: state.aiConfig.activeProviderId === providerId
                        ? state.aiConfig.providers[0]?.id || 'opencode'
                        : state.aiConfig.activeProviderId
                }
            })),
        }),
        {
            name: 'neuro-os-settings',
            version: 3,
            migrate: (persisted: any, version) => {
                if (version < 2) {
                    const { p2pServerUrl, ...rest } = persisted || {};
                    persisted = { ...rest };
                }
                if (version < 3) {
                    // Update models and providers to 2026 standards
                    if (persisted?.aiConfig?.providers) {
                        persisted.aiConfig.providers = persisted.aiConfig.providers.map((p: any) => {
                            const d = DEFAULT_PROVIDERS.find(dp => dp.id === p.id);
                            if (d) {
                                // Keep user's custom baseUrl and apiKey, but update models
                                return {
                                    ...p,
                                    name: d.name,
                                    models: d.models,
                                    // Update selected model if it was an old default
                                    selectedModel: (p.selectedModel === 'opencode-mini' || 
                                                  p.selectedModel === 'gpt-4o' || 
                                                  p.selectedModel === 'claude-3-5-sonnet' ||
                                                  p.selectedModel === 'llama-3-8b' ||
                                                  p.selectedModel === 'llama-4-8b') ? d.selectedModel : p.selectedModel
                                };
                            }
                            return p;
                        });
                    }
                }
                return persisted;
            }
        }
    )
);
