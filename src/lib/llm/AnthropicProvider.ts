import { LLMProvider, LLMMessage, LLMResponse } from './types';

export class AnthropicProvider implements LLMProvider {
    id = 'anthropic';
    name = 'Anthropic';
    description = 'Anthropic Claude API';
    baseUrl: string;
    apiKey: string;
    model: string;

    constructor(baseUrl: string, apiKey: string, model: string) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiKey = apiKey;
        this.model = model;
    }

    private buildBody(messages: LLMMessage[], stream: boolean): { body: any; systemMessage: string | undefined } {
        const systemMessage = messages.find(m => m.role === 'system')?.content;
        const conversationMessages = messages
            .filter(m => m.role !== 'system')
            .map(m => ({ role: m.role, content: m.content }));

        const body: any = {
            model: this.model,
            messages: conversationMessages,
            max_tokens: 4096,
            stream,
        };
        if (systemMessage) body.system = systemMessage;

        return { body, systemMessage };
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        try {
            const { body } = this.buildBody(messages, false);
            const response = await fetch(`${this.baseUrl}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(`Anthropic API Error ${response.status}: ${errorData?.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return {
                content: data.content[0].text,
                usage: {
                    promptTokens: data.usage?.input_tokens || 0,
                    completionTokens: data.usage?.output_tokens || 0,
                    totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
                }
            };
        } catch (error) {
            console.error('Anthropic Provider Chat Error:', error);
            throw error;
        }
    }

    async stream(messages: LLMMessage[], onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<void> {
        const { body } = this.buildBody(messages, true);
        const response = await fetch(`${this.baseUrl}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify(body),
            signal,
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => null);
            throw new Error(`Anthropic API Error ${response.status}: ${errData?.error?.message || response.statusText}`);
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
                if (line.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(line.slice(6));
                        if (json.type === 'content_block_delta' && json.delta?.text) {
                            onChunk(json.delta.text);
                        }
                    } catch (e) {
                        // Ignore parsing errors for ping/other events
                    }
                }
            }
        }
    }
}
