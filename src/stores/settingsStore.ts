import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    wallpaper: string;
    setWallpaper: (url: string) => void;
    aiConfig: {
        activeProviderId: string;
        providers: {
            id: string;
            name: string;
            type: 'openai' | 'anthropic' | 'ollama' | 'lmstudio' | 'gemini' | 'groq' | 'mistral' | 'custom';
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
            setWallpaper: (url) => set({ wallpaper: url }),
            aiConfig: {
                activeProviderId: 'ollama',
                providers: [
                    { id: 'ollama', name: 'Ollama', type: 'ollama', baseUrl: 'http://localhost:11434', apiKey: '', selectedModel: 'llama3', models: ['llama3', 'mistral', 'neural-chat'] },
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
