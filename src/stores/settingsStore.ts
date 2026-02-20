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
                    { id: 'lmstudio', name: 'LM Studio', type: 'lmstudio', baseUrl: 'http://localhost:1234/v1', apiKey: '', selectedModel: 'local-model', models: ['local-model'] },
                    { id: 'openai', name: 'OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: '', selectedModel: 'gpt-4-turbo', models: ['gpt-4-turbo', 'gpt-3.5-turbo'] },
                    { id: 'anthropic', name: 'Anthropic', type: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKey: '', selectedModel: 'claude-3-opus-20240229', models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229'] },
                    { id: 'gemini', name: 'Google Gemini', type: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKey: '', selectedModel: 'gemini-pro', models: ['gemini-pro', 'gemini-1.5-pro'] },
                    { id: 'groq', name: 'Groq', type: 'groq', baseUrl: 'https://api.groq.com/openai/v1', apiKey: '', selectedModel: 'llama3-70b-8192', models: ['llama3-70b-8192', 'mixtral-8x7b-32768'] },
                    { id: 'mistral', name: 'Mistral AI', type: 'mistral', baseUrl: 'https://api.mistral.ai/v1', apiKey: '', selectedModel: 'mistral-large-latest', models: ['mistral-large-latest', 'mistral-small'] },
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
