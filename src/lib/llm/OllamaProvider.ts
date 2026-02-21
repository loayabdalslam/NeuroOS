import { LLMProvider, LLMMessage, LLMResponse } from './types';

export class OllamaProvider implements LLMProvider {
    id = 'ollama';
    name = 'Ollama';
    description = 'Local AI running via Ollama';
    baseUrl: string;
    model: string;

    constructor(baseUrl = 'http://localhost:11434', model = 'llama3') {
        this.baseUrl = baseUrl;
        this.model = model;
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    messages,
                    stream: false,
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama Error: ${response.statusText}`);
            }

            const data = await response.json();
            return {
                content: data.message.content,
                usage: {
                    promptTokens: data.prompt_eval_count,
                    completionTokens: data.eval_count,
                    totalTokens: data.prompt_eval_count + data.eval_count,
                }
            };
        } catch (error) {
            console.error('Ollama Chat Error:', error);
            throw error;
        }
    }

    async stream(messages: LLMMessage[], onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<void> {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                messages,
                stream: true,
            }),
            signal,
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => null);
            throw new Error(`Ollama Error ${response.status}: ${errData?.error || response.statusText}. Is Ollama running? Try: ollama serve`);
        }

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                try {
                    const json = JSON.parse(line);
                    if (json.message?.content) {
                        onChunk(json.message.content);
                    }
                    if (json.done) return;
                } catch (e) {
                    console.error("Error parsing JSON chunk", e);
                }
            }
        }
    }
}
