import { LLMProvider, LLMMessage, LLMResponse, VISION_MODELS, hasImageContent } from './types';

const OLLAMA_VISION_MODELS = ['llava', 'llava-llama3', 'llava-phi3', 'bakllava', 'moondream', 'qwen-vl', 'minicpm-v', 'llama3.2-vision'];

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

    get supportsVision(): boolean {
        return OLLAMA_VISION_MODELS.some(v => this.model.toLowerCase().includes(v.toLowerCase()));
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        if (hasImageContent(messages) && !this.supportsVision) {
            throw new Error('This model does not support image input. Please use a vision model like llava, bakllava, or moondream with Ollama. Or switch to OpenAI GPT-4, Anthropic Claude, or Google Gemini for vision support.');
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    messages: this.formatMessages(messages),
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
        if (hasImageContent(messages) && !this.supportsVision) {
            throw new Error('This model does not support image input. Please use a vision model like llava, bakllava, or moondream with Ollama. Or switch to OpenAI GPT-4, Anthropic Claude, or Google Gemini for vision support.');
        }

        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                messages: this.formatMessages(messages),
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

    private formatMessages(messages: LLMMessage[]): any[] {
        return messages.map(msg => {
            if (Array.isArray(msg.content)) {
                let textContent = '';
                const images: string[] = [];

                msg.content.forEach(part => {
                    if (typeof part === 'string') {
                        textContent += part;
                    } else if (typeof part === 'object' && part.type === 'text') {
                        textContent += part.text || '';
                    } else if (typeof part === 'object' && part.type === 'image_url') {
                        const imageUrl = part.image_url?.url || '';
                        // Extract base64 data from data URL or use URL directly
                        if (imageUrl.startsWith('data:')) {
                            const base64Data = imageUrl.split(',')[1];
                            if (base64Data) images.push(base64Data);
                        } else {
                            // For external URLs, keep as is (Ollama may support via URL)
                            images.push(imageUrl);
                        }
                    }
                });

                return {
                    role: msg.role,
                    content: textContent,
                    images: images.length > 0 ? images : undefined
                };
            }
            return { role: msg.role, content: msg.content };
        });
    }
}
