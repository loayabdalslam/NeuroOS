import { LLMProvider, LLMMessage, LLMResponse } from './types';

export class OpenAIProvider implements LLMProvider {
    id = 'openai';
    name = 'OpenAI Compatible';
    description = 'Standard OpenAI API Compatible Provider';
    baseUrl: string;
    apiKey: string;
    model: string;

    constructor(baseUrl: string, apiKey: string, model: string) {
        this.baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slash
        this.apiKey = apiKey;
        this.model = model;
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        try {
            // Adjust endpoint based on whether the baseUrl already includes /v1 or /chat/completions
            // Common convention: baseUrl is "https://api.openai.com/v1"
            let endpoint = `${this.baseUrl}/chat/completions`;

            // Some users might put the full path in baseUrl, handle that gracefully if needed
            // But for now assume standard base URL

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: messages.map(m => ({
                        role: m.role,
                        content: m.content
                    })),
                    stream: false
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(`API Error: ${response.status} ${response.statusText} ${errorData ? JSON.stringify(errorData) : ''}`);
            }

            const data = await response.json();
            return {
                content: data.choices[0].message.content,
                usage: {
                    promptTokens: data.usage?.prompt_tokens || 0,
                    completionTokens: data.usage?.completion_tokens || 0,
                    totalTokens: data.usage?.total_tokens || 0,
                }
            };
        } catch (error) {
            console.error('OpenAI Provider Chat Error:', error);
            throw error;
        }
    }

    async stream(messages: LLMMessage[], onChunk: (chunk: string) => void): Promise<void> {
        const endpoint = `${this.baseUrl}/chat/completions`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages.map(m => ({
                    role: m.role,
                    content: m.content
                })),
                stream: true
            }),
        });

        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line === 'data: [DONE]') return;
                if (line.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(line.slice(6));
                        const content = json.choices[0]?.delta?.content;
                        if (content) {
                            onChunk(content);
                        }
                    } catch (e) {
                        console.error("Error parsing stream chunk", e);
                    }
                }
            }
        }
    }
}
