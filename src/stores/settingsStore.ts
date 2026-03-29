import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { ThemeVariant } from '../lib/designSystem/themes';

interface SettingsState {
    wallpaper: string;
    customWallpapers: string[];
    theme: ThemeVariant;
    p2pServerUrl: string;
    notificationsEnabled: boolean;
    soundEnabled: boolean;
    desktopBadgesEnabled: boolean;
    setWallpaper: (url: string) => void;
    setTheme: (theme: ThemeVariant) => void;
    setP2PServerUrl: (url: string) => void;
    setNotifications: (enabled: boolean) => void;
    setSound: (enabled: boolean) => void;
    setDesktopBadges: (enabled: boolean) => void;
    addCustomWallpaper: (url: string) => void;
    removeCustomWallpaper: (url: string) => void;
    aiConfig: {
        activeProviderId: string;
        providers: {
            id: string;
            name: string;
            type: 'openai' | 'anthropic' | 'ollama' | 'lmstudio' | 'gemini' | 'groq' | 'mistral' | 'openrouter' | 'custom';
            baseUrl: string;
            apiKey: string;
            selectedModel: string;
            models: string[]; // Cache of available models
        }[];
    };
    updateAiConfig: (config: Partial<SettingsState['aiConfig']>) => void;
    updateProvider: (providerId: string, updates: Partial<SettingsState['aiConfig']['providers'][0]>) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            wallpaper: '',
            customWallpapers: [],
            theme: 'system' as ThemeVariant,
            p2pServerUrl: 'wss://neuro-p2p-signaling.fly.dev',
            notificationsEnabled: true,
            soundEnabled: true,
            desktopBadgesEnabled: true,
            setWallpaper: (url) => set({ wallpaper: url }),
            setTheme: (theme: ThemeVariant) => set({ theme }),
            setP2PServerUrl: (url) => set({ p2pServerUrl: url }),
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
        activeProviderId: 'ollama',
        providers: [
            { id: 'ollama', name: 'Ollama', type: 'ollama', baseUrl: 'http://localhost:11434', apiKey: '', selectedModel: 'llama3', models: ['llama3', 'mistral', 'neural-chat'] },
            { id: 'openrouter', name: 'OpenRouter', type: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', selectedModel: 'openai/gpt-3.5-turbo', models: [] },
        ]
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
        }),
        {
            name: 'neuro-os-settings',
        }
    )
);
