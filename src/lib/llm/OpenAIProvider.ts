import { LLMProvider, LLMMessage, LLMResponse, VISION_MODELS, hasImageContent } from './types';

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

    get supportsVision(): boolean {
        const visionModels = [
            ...(VISION_MODELS.openai || []),
            ...(VISION_MODELS.google || []),
            ...(VISION_MODELS.openrouter || [])
        ];
        return visionModels.some(v => this.model.toLowerCase().includes(v.toLowerCase()));
    }

    private formatMessages(messages: LLMMessage[]): any[] {
        return messages.map(msg => {
            if (Array.isArray(msg.content)) {
                return {
                    role: msg.role,
                    content: msg.content.map(part => {
                        if (typeof part === 'string') {
                            return { type: 'text', text: part };
                        }
                        if (typeof part === 'object' && part.type === 'text') {
                            return part;
                        }
                        if (typeof part === 'object' && part.type === 'image_url') {
                            return { type: 'image_url', image_url: part.image_url };
                        }
                        return { type: 'text', text: String(part) };
                    })
                };
            }
            return { role: msg.role, content: msg.content };
        });
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        if (hasImageContent(messages) && !this.supportsVision) {
            throw new Error('This model does not support image input. Please use GPT-4o, GPT-4-turbo, Claude 3, or Gemini for vision support.');
        }

        try {
            let endpoint = `${this.baseUrl}/chat/completions`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: this.formatMessages(messages),
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

    async stream(messages: LLMMessage[], onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<void> {
        if (hasImageContent(messages) && !this.supportsVision) {
            throw new Error('This model does not support image input. Please use GPT-4o, GPT-4-turbo, Claude 3, or Gemini for vision support.');
        }

        const endpoint = `${this.baseUrl}/chat/completions`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: this.formatMessages(messages),
                stream: true
            }),
            signal,
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({ error: { message: response.statusText } }));
            throw new Error(`API Error ${response.status}: ${errData?.error?.message || response.statusText}`);
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
