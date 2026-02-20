import { LLMProvider } from './types';
import { OllamaProvider } from './OllamaProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { useSettingsStore } from '../../stores/settingsStore';

export const getLLMProvider = (): LLMProvider => {
    const { aiConfig } = useSettingsStore.getState();
    const activeProvider = aiConfig.providers.find(p => p.id === aiConfig.activeProviderId);

    if (!activeProvider) {
        console.warn('No active provider found, falling back to Ollama default');
        return new OllamaProvider();
    }

    switch (activeProvider.type) {
        case 'ollama':
            return new OllamaProvider(activeProvider.baseUrl, activeProvider.selectedModel);
        case 'lmstudio':
            return new OpenAIProvider(activeProvider.baseUrl || 'http://localhost:1234/v1', 'lm-studio', activeProvider.selectedModel);
        case 'openai':
        case 'groq':
        case 'mistral':
        case 'gemini':
        case 'custom':
            return new OpenAIProvider(activeProvider.baseUrl, activeProvider.apiKey, activeProvider.selectedModel);
        case 'anthropic':
             return new AnthropicProvider(activeProvider.baseUrl, activeProvider.apiKey, activeProvider.selectedModel);
        default:
            return new OllamaProvider();
    }
};
