import { LLMProvider, LLMMessage, LLMResponse, VISION_MODELS, hasImageContent } from './types';
import { LLMError, LLMProviderError } from './errors';

/**
 * GeminiProvider implements the LLMProvider interface for Google's Gemini API.
 * It supports both single-turn chat and multi-turn streaming responses.
 */
export class GeminiProvider implements LLMProvider {
    id = 'gemini';
    name = 'Google Gemini';
    description = 'Google Gemini API';
    baseUrl: string;
    apiKey: string;
    model: string;

    /**
     * @param baseUrl - The base URL for the Gemini API (usually https://generativelanguage.googleapis.com)
     * @param apiKey - The Google AI Studio API key
     * @param model - The specific Gemini model ID (e.g., 'gemini-1.5-pro')
     */
    constructor(baseUrl: string, apiKey: string, model: string) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        this.apiKey = apiKey;
        this.model = model;
    }

    /**
     * Checks if the currently selected model supports vision capabilities.
     */
    get supportsVision(): boolean {
        const visionModels = VISION_MODELS.google || [];
        return visionModels.some(v => this.model.toLowerCase().includes(v.toLowerCase()));
    }

    /**
     * Formats LLM messages into the format expected by the Gemini API.
     * Handles string content and multi-part content (including images).
     * 
     * @param message - The message to format
     * @returns The formatted parts array or string
     */
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
                    // Handle base64 inline images
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
                        // Handle remote file URLs
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

    /**
     * Executes a standard non-streaming chat completion.
     * 
     * @param messages - Array of history and current messages
     * @returns Promise resolving to the model response and usage data
     * @throws LLMProviderError on API failures
     */
    async chat(messages: LLMMessage[]): Promise<LLMResponse> {
        if (hasImageContent(messages) && !this.supportsVision) {
            throw new Error('This model does not support image input. Please use Gemini 1.5 Pro or Gemini 1.5 Flash for vision support.');
        }

        try {
            // Transform messages to Gemini's 'contents' format
            const contents = messages
                .filter(m => m.role !== 'system')
                .map(m => {
                    const formatted = this.formatContent(m);
                    return {
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: Array.isArray(formatted) ? formatted : [{ text: formatted }]
                    };
                });

            // Extract system instruction if present
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
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
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
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                this.handleHttpError(response.status, errorData);
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
            if (error instanceof LLMProviderError) throw error;
            throw new LLMProviderError(LLMError.UNKNOWN, error.message);
        }
    }

    /**
     * Executes a streaming chat completion.
     * Manually parses the NDJSON/Array stream format returned by Gemini.
     * 
     * @param messages - Array of history and current messages
     * @param onChunk - Callback for each text fragment received
     * @param signal - Optional AbortSignal to cancel the request
     * @throws LLMProviderError on API failures
     */
    async stream(messages: LLMMessage[], onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<void> {
        if (hasImageContent(messages) && !this.supportsVision) {
            throw new Error('This model does not support image input. Please use Gemini 1.5 Pro or Gemini 1.5 Flash for vision support.');
        }

        if (signal?.aborted) return;

        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => {
                const formatted = this.formatContent(m);
                return {
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: Array.isArray(formatted) ? formatted : [{ text: formatted }]
                };
            });

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
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ]
        };

        if (systemPrompt) {
            requestBody.systemInstruction = {
                parts: [{ text: systemPrompt }]
            };
        }

        console.log('Gemini Stream Request Body:', JSON.stringify(requestBody, null, 2));

        try {
            const response = await fetch(
                `${this.baseUrl}/v1beta/models/${this.model}:streamGenerateContent?key=${this.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal,
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('Gemini Stream Error Response:', errorData);
                this.handleHttpError(response.status, errorData);
            }

            if (!response.body) throw new LLMProviderError(LLMError.NO_RESPONSE);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            // Process the stream chunk by chunk
            while (true) {
                if (signal?.aborted) {
                    await reader.cancel();
                    return;
                }

                const { done, value } = await reader.read();
                if (done) break;

                // Accumulate buffer and split by newlines
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    let cleanLine = line.trim();
                    // Gemini stream returns a JSON array like [ {item}, {item} ]
                    // We need to strip the array punctuation to parse individual objects
                    if (cleanLine.startsWith('[')) cleanLine = cleanLine.substring(1).trim();
                    if (cleanLine.endsWith(']')) cleanLine = cleanLine.substring(0, cleanLine.length - 1).trim();
                    if (cleanLine.endsWith(',')) cleanLine = cleanLine.substring(0, cleanLine.length - 1).trim();

                    if (!cleanLine) continue;

                    try {
                        const json = JSON.parse(cleanLine);
                        const textContent = json.candidates?.[0]?.content?.parts?.[0]?.text;
                        if (textContent) {
                            onChunk(textContent);
                        }
                    } catch (e) {
                        // Partial or malformed chunks are skipped silently
                    }
                }
            }
        } catch (error: any) {
            if (error.name === 'AbortError' || signal?.aborted) return;
            if (error instanceof LLMProviderError) throw error;
            throw new LLMProviderError(LLMError.NETWORK_ERROR, error.message);
        }
    }

    /**
     * Maps HTTP status codes to internal LLMError codes and throws LLMProviderError.
     */
    private handleHttpError(status: number, data: any) {
        const message = data?.error?.message || '';
        
        switch (status) {
            case 400: throw new LLMProviderError(LLMError.BAD_REQUEST, message);
            case 401: throw new LLMProviderError(LLMError.INVALID_API_KEY, message);
            case 404: throw new LLMProviderError(LLMError.MODEL_NOT_FOUND, message);
            case 429: throw new LLMProviderError(LLMError.RATE_LIMIT_EXCEEDED, message);
            case 500:
            case 503: throw new LLMProviderError(LLMError.SERVER_ERROR, message);
            default: throw new LLMProviderError(LLMError.UNKNOWN, `HTTP ${status}: ${message}`);
        }
    }
}
