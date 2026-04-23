import { LLMProvider } from './types';
import { OllamaProvider } from './OllamaProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GeminiProvider } from './GeminiProvider';
import { useSettingsStore } from '../../stores/settingsStore';

/**
 * Factory function to instantiate the appropriate LLMProvider based on the 
 * active configuration in the settings store.
 * 
 * @returns An instance of a class implementing the LLMProvider interface.
 * Defaults to a no-arg OllamaProvider if configuration is missing or an error occurs.
 * 
 * @note This function is wrapped in a try/catch block to prevent application crashes
 * if the settings store is in an invalid state or a provider fails to initialize.
 */
export const getLLMProvider = (): LLMProvider => {
    try {
        const { aiConfig } = useSettingsStore.getState();
        const activeProvider = aiConfig.providers.find(p => p.id === aiConfig.activeProviderId);

        // Initial fallback if configuration is missing
        if (!activeProvider) {
            console.warn('No active provider found, falling back to Ollama default');
            return new OllamaProvider();
        }

        // Map provider types to their respective implementation classes
        switch (activeProvider.type) {
            case 'ollama':
                return new OllamaProvider(activeProvider.baseUrl, activeProvider.selectedModel);
            case 'lmstudio':
                // LMStudio uses the OpenAI-compatible API format
                return new OpenAIProvider(activeProvider.baseUrl || 'http://localhost:1234/v1', '', activeProvider.selectedModel);
            case 'openai':
            case 'groq':
            case 'mistral':
            case 'openrouter':
            case 'perplexity':
            case 'xai':
            case 'opencode':
            case 'custom':
                // These all use the standard OpenAI/Vercel AI SDK compatible format
                return new OpenAIProvider(activeProvider.baseUrl, activeProvider.apiKey, activeProvider.selectedModel);
            case 'gemini':
                return new GeminiProvider('https://generativelanguage.googleapis.com', activeProvider.apiKey, activeProvider.selectedModel);
            case 'anthropic':
                 return new AnthropicProvider(activeProvider.baseUrl, activeProvider.apiKey, activeProvider.selectedModel);
            default:
                return new OllamaProvider();
        }
    } catch (error) {
        console.error('Failed to initialize LLM provider, falling back to Ollama:', error);
        return new OllamaProvider();
    }
};
