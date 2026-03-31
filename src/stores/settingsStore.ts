import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { ThemeVariant } from '../lib/designSystem/themes';

/**
 * Interface representing the global application settings and AI configuration.
 */
interface SettingsState {
    wallpaper: string;
    customWallpapers: string[];
    theme: ThemeVariant;
    p2pServerUrl: string;
    notificationsEnabled: boolean;
    soundEnabled: boolean;
    desktopBadgesEnabled: boolean;

    // Actions
    setWallpaper: (url: string) => void;
    setTheme: (theme: ThemeVariant) => void;
    setP2PServerUrl: (url: string) => void;
    setNotifications: (enabled: boolean) => void;
    setSound: (enabled: boolean) => void;
    setDesktopBadges: (enabled: boolean) => void;
    addCustomWallpaper: (url: string) => void;
    removeCustomWallpaper: (url: string) => void;

    /**
     * AI Configuration state including active provider and available providers.
     */
    aiConfig: {
        activeProviderId: string;
        providers: {
            id: string;
            name: string;
            type: 'openai' | 'anthropic' | 'ollama' | 'lmstudio' | 'gemini' | 'groq' | 'mistral' | 'openrouter' | 'custom';
            baseUrl: string;
            apiKey: string;
            selectedModel: string;
            models: string[]; // Cache of available model IDs for the provider
        }[];
    };
    updateAiConfig: (config: Partial<SettingsState['aiConfig']>) => void;
    updateProvider: (providerId: string, updates: Partial<SettingsState['aiConfig']['providers'][0]>) => void;
}

/**
 * Settings Store using Zustand with Persistence.
 * This store manages OS-level preferences and LLM credentials.
 */
export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            // Default appearance state
            wallpaper: '',
            customWallpapers: [],
            theme: 'system' as ThemeVariant,

            // Default connectivity and accessibility state
            p2pServerUrl: 'wss://neuro-p2p-signaling.fly.dev',
            notificationsEnabled: true,
            soundEnabled: true,
            desktopBadgesEnabled: true,

            // Simple state setters
            setWallpaper: (url) => set({ wallpaper: url }),
            setTheme: (theme: ThemeVariant) => set({ theme }),
            setP2PServerUrl: (url) => set({ p2pServerUrl: url }),
            setNotifications: (enabled) => set({ notificationsEnabled: enabled }),
            setSound: (enabled) => set({ soundEnabled: enabled }),
            setDesktopBadges: (enabled) => set({ desktopBadgesEnabled: enabled }),

            /**
             * Adds a unique URL to the custom wallpapers collection.
             */
            addCustomWallpaper: (url) => set((state) => ({
                customWallpapers: state.customWallpapers.includes(url) 
                    ? state.customWallpapers 
                    : [...state.customWallpapers, url]
            })),

            /**
             * Removes a wallpaper from the collection and resets current wallpaper if it was active.
             */
            removeCustomWallpaper: (url) => set((state) => ({
                customWallpapers: state.customWallpapers.filter(u => u !== url),
                wallpaper: state.wallpaper === url ? '' : state.wallpaper
            })),

            // AI Provider configuration
            aiConfig: {
                activeProviderId: 'ollama',
                providers: [
                    { id: 'ollama', name: 'Ollama', type: 'ollama', baseUrl: 'http://localhost:11434', apiKey: '', selectedModel: 'llama3', models: ['llama3', 'mistral', 'neural-chat'] },
                    { id: 'openrouter', name: 'OpenRouter', type: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', selectedModel: 'openai/gpt-3.5-turbo', models: [] },
                    { id: 'gemini', name: 'Gemini', type: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com', apiKey: '', selectedModel: 'gemini-2.0-flash', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
                    { id: 'anthropic', name: 'Anthropic', type: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: '', selectedModel: 'claude-sonnet-4-6', models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] },
                ]
            },

            /**
             * Partially updates global AI configuration (e.g. changing active provider).
             */
            updateAiConfig: (config) => set((state) => ({
                aiConfig: { ...state.aiConfig, ...config }
            })),

            /**
             * Updates credentials or settings for a specific AI provider.
             */
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
            // Persistence configuration for localStorage
            name: 'neuro-os-settings',
        }
    )
);
