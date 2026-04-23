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
        selectedModel: 'opencode-mini',
        models: [
            // Free tier models (no API key required)
            'opencode-mini',
            'opencode-fast',
            'opencode-lite',
            'opencode-coder-lite',
            // Pro models (API key required)
            'opencode-smart',
            'opencode-vision',
            'opencode-coder',
            'opencode-writer',
            'opencode-reasoning',
            'opencode-pro',
            'opencode-ultra',
            'opencode-coder-pro',
            'opencode-vision-pro'
        ]
    },
    {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        selectedModel: 'gpt-5.4-thinking',
        models: ['gpt-5.4-thinking', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-4o', 'gpt-4o-mini']
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        type: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: '',
        selectedModel: 'claude-4.7-opus',
        models: ['claude-4.7-opus', 'claude-4.6-sonnet', 'claude-4.5-haiku']
    },
    {
        id: 'gemini',
        name: 'Gemini',
        type: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: '',
        selectedModel: 'gemini-2.5-pro',
        models: ['gemini-2.5-pro', 'gemini-2.5-ultra', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']
    },
    {
        id: 'mistral',
        name: 'Mistral',
        type: 'mistral',
        baseUrl: 'https://api.mistral.ai/v1',
        apiKey: '',
        selectedModel: 'mistral-large-3',
        models: ['mistral-large-3', 'mistral-3-dense', 'mistral-small-3', 'mistral-7b-v3']
    },
    {
        id: 'groq',
        name: 'Groq',
        type: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKey: '',
        selectedModel: 'llama-4-405b',
        models: ['llama-4-405b', 'llama-4-70b', 'llama-4-8b', 'mistral-small-3', 'gemma-3-8b']
    },
    {
        id: 'perplexity',
        name: 'Perplexity',
        type: 'perplexity',
        baseUrl: 'https://api.perplexity.ai',
        apiKey: '',
        selectedModel: 'sonar-3-pro',
        models: ['sonar-3-pro', 'sonar-3-small', 'gpt-5.4', 'claude-4.7-opus']
    },
    {
        id: 'xai',
        name: 'X.AI (Grok)',
        type: 'xai',
        baseUrl: 'https://api.x.ai/v1',
        apiKey: '',
        selectedModel: 'grok-4.20',
        models: ['grok-4.20', 'grok-4', 'grok-mini']
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        type: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: '',
        selectedModel: 'kimi-k2.6',
        models: ['kimi-k2.6', 'qwen-3.6-plus', 'trinity-large-preview', 'mimo-v2-pro', 'llama-4-8b']
    },
    {
        id: 'ollama',
        name: 'Ollama (Local)',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        apiKey: '',
        selectedModel: 'llama-4-8b',
        models: ['llama-4-8b', 'llama-4-70b', 'mistral-small-3', 'phi-4', 'gemma-3-8b']
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

            refreshProviderModels: async (providerId) => {
                const provider = get().aiConfig.providers.find(p => p.id === providerId);
                if (!provider) return;

                try {
                    if (provider.type === 'ollama') {
                        const baseUrl = provider.baseUrl || 'http://localhost:11434';
                        const response = await fetch(`${baseUrl}/api/tags`);
                        const data = await response.json();
                        if (data.models) {
                            const modelNames = data.models.map((m: any) => m.name);
                            get().updateProvider(providerId, { models: modelNames });
                        }
                    } else if (provider.type === 'lmstudio') {
                        const baseUrl = provider.baseUrl || 'http://localhost:1234/v1';
                        const response = await fetch(`${baseUrl}/models`);
                        const data = await response.json();
                        if (data.data) {
                            const modelNames = data.data.map((m: any) => m.id);
                            get().updateProvider(providerId, { models: modelNames });
                        }
                    }
                } catch (error) {
                    console.error(`Failed to refresh models for ${providerId}:`, error);
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
            version: 2,
            migrate: (persisted: any, version) => {
                if (version < 2) {
                    // Remove p2pServerUrl from old settings
                    const { p2pServerUrl, ...rest } = persisted || {};
                    return { ...rest };
                }
                return persisted;
            }
        }
    )
);
