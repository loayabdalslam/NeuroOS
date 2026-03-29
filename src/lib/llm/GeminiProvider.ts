import { LLMProvider, LLMMessage, LLMResponse, VISION_MODELS, hasImageContent } from './types';

export class GeminiProvider implements LLMProvider {
    id = 'gemini';
    name = 'Google Gemini';
    description = 'Google Gemini API';
    baseUrl: string;
    apiKey: string;
    model: string;

    constructor(baseUrl: string, apiKey: string, model: string) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiKey = apiKey;
        this.model = model;
    }

    get supportsVision(): boolean {
        const visionModels = VISION_MODELS.google || [];
        return visionModels.some(v => this.model.toLowerCase().includes(v.toLowerCase()));
    }

    private formatContent(message: LLMMessage): any {
        if (typeof message.content === 'string') {
            return message.content;
        }

        if (Array.isArray(message.content)) {
            return message.content.map(part => {
                if (typeof part === 'string') {
                    return { text: part };
                }
                if (typeof part === 'object' && part.type === 'image_url') {
                    const url = part.image_url?.url || '';
                    if (url.startsWith('data:')) {
                        const [metadata, data] = url.split(',');
                        const mimeType = metadata.match(/data:([^;]+);/)?.[1] || 'image/png';
                        return {
                            inlineData: {
                                mimeType,
                                data: data
                            }
                        };
                    } else {
                        return {
                            fileData: {
                                mimeType: 'image/jpeg',
                                fileUri: url
                            }
                        };
                    }
                }
                return { text: JSON.stringify(part) };
            });
        }

        return message.content;
    }

    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        if (hasImageContent(messages) && !this.supportsVision) {
            throw new Error('This model does not support image input. Please use Gemini 1.5 Pro or Gemini 1.5 Flash for vision support.');
        }

        try {
            const contents = messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: this.formatContent(m)
                }));

            const systemMessage = messages.find(m => m.role === 'system')?.content;
            const systemPrompt = typeof systemMessage === 'string' ? systemMessage : undefined;

            const requestBody: any = {
                contents,
                generationConfig: {
                    temperature: 1,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                },
                safetySettings: [
                    {
                        category: 'HARM_CATEGORY_HARASSMENT',
                        threshold: 'BLOCK_NONE',
                    },
                    {
                        category: 'HARM_CATEGORY_HATE_SPEECH',
                        threshold: 'BLOCK_NONE',
                    },
                    {
                        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                        threshold: 'BLOCK_NONE',
                    },
                    {
                        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                        threshold: 'BLOCK_NONE',
                    },
                ]
            };

            if (systemPrompt) {
                requestBody.systemInstruction = {
                    parts: [{ text: systemPrompt }]
                };
            }

            const response = await fetch(
                `${this.baseUrl}/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(`Gemini API Error ${response.status}: ${errorData?.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const usage = data.usageMetadata || {};

            return {
                content: textContent,
                usage: {
                    promptTokens: usage.promptTokenCount || 0,
                    completionTokens: usage.candidatesTokenCount || 0,
                    totalTokens: usage.totalTokenCount || 0,
                }
            };
        } catch (error) {
            console.error('Gemini Provider Chat Error:', error);
            throw error;
        }
    }

    async stream(messages: LLMMessage[], onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<void> {
        if (hasImageContent(messages) && !this.supportsVision) {
            throw new Error('This model does not support image input. Please use Gemini 1.5 Pro or Gemini 1.5 Flash for vision support.');
        }

        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: this.formatContent(m)
            }));

        const systemMessage = messages.find(m => m.role === 'system')?.content;
        const systemPrompt = typeof systemMessage === 'string' ? systemMessage : undefined;

        const requestBody: any = {
            contents,
            generationConfig: {
                temperature: 1,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
            },
            safetySettings: [
                {
                    category: 'HARM_CATEGORY_HARASSMENT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_HATE_SPEECH',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                    threshold: 'BLOCK_NONE',
                },
                {
                    category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                    threshold: 'BLOCK_NONE',
                },
            ]
        };

        if (systemPrompt) {
            requestBody.systemInstruction = {
                parts: [{ text: systemPrompt }]
            };
        }

        const response = await fetch(
            `${this.baseUrl}/v1beta/models/${this.model}:streamGenerateContent?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal,
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(`Gemini API Error ${response.status}: ${errorData?.error?.message || response.statusText}`);
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
                        const textContent = json.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (textContent) {
                            onChunk(textContent);
                        }
                    } catch (e) {
                        // Ignore parsing errors for ping/other events
                    }
                }
            }
        }
    }
}
