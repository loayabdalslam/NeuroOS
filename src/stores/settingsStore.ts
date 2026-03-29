import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    wallpaper: string;
    customWallpapers: string[];
    theme: 'Light' | 'Dark' | 'System';
    setWallpaper: (url: string) => void;
    setTheme: (theme: 'Light' | 'Dark' | 'System') => void;
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
            theme: 'System',
            setWallpaper: (url) => set({ wallpaper: url }),
            setTheme: (theme) => set({ theme }),
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
