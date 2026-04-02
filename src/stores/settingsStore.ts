import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ThemeVariant } from '../lib/designSystem/themes';

interface ProviderConfig {
    id: string;
    name: string;
    type: 'openai' | 'anthropic' | 'ollama' | 'lmstudio' | 'gemini' | 'groq' | 'mistral' | 'openrouter' | 'opencode' | 'custom';
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
        id: 'ollama',
        name: 'Ollama',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        apiKey: '',
        selectedModel: 'llama3',
        models: ['llama3', 'mistral', 'neural-chat', 'codellama', 'phi3', 'gemma2']
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        type: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: '',
        selectedModel: 'openai/gpt-4o-mini',
        models: ['openai/gpt-4o-mini', 'openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-flash-1.5', 'meta-llama/llama-3.1-70b-instruct']
    },
    {
        id: 'gemini',
        name: 'Gemini',
        type: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com',
        apiKey: '',
        selectedModel: 'gemini-2.0-flash',
        models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        type: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        apiKey: '',
        selectedModel: 'claude-sonnet-4-20250514',
        models: ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022']
    },
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
