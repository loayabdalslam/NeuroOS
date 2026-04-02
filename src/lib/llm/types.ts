export type MessageContent = string | { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string | MessageContent[];
}

export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface LLMProvider {
    id: string;
    name: string;
    description: string;
    supportsVision?: boolean;
    visionModels?: string[];
    chat(messages: LLMMessage[]): Promise<LLMResponse>;
    stream(messages: LLMMessage[], onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<void>;
    validateConfig?(): Promise<boolean>;
}

export const VISION_MODELS = {
    openai: ['gpt-4-vision', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4'],
    anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3-5-sonnet', 'claude-3-5-haiku', 'claude-sonnet-4', 'claude-opus-4'],
    google: ['gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro-002', 'gemini-2.0-flash', 'gemini-2.0-flash-exp'],
    openrouter: ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3-opus', 'anthropic/claude-3-sonnet', 'google/gemini-pro-vision', 'google/gemini-flash-1.5'],
    ollama: ['llava', 'llava-llama3', 'llava-phi3', 'bakllava', 'moondream', 'qwen-vl', 'minicpm-v'],
    opencode: ['opencode-vision'],
    lmstudio: [],
    groq: ['llava', 'llama-3.2-11b-vision', 'llama-3.2-90b-vision'],
    mistral: ['pixtral'],
};

export function hasImageContent(messages: LLMMessage[]): boolean {
    for (const msg of messages) {
        if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
                if (typeof part === 'object' && part.type === 'image_url') {
                    return true;
                }
            }
        } else if (typeof msg.content === 'string') {
            // Only match actual base64 image data URLs, not text containing these words
            // Match patterns like: data:image/png;base64, data:image/jpeg;base64
            // Must have the full data URL format with comma and substantial data
            if (msg.content.match(/data:image\/[a-zA-Z0-9]+;base64,[A-Za-z0-9+/=]{20,}/)) {
                return true;
            }
            // Also check for explicit image_url objects in string format
            if (msg.content.includes('"image_url"') || msg.content.includes('"type":"image_url"')) {
                return true;
            }
        }
    }
    return false;
}

export function extractImagesFromContent(content: string | MessageContent[]): string[] {
    const images: string[] = [];
    
    if (Array.isArray(content)) {
        for (const part of content) {
            if (typeof part === 'object' && part.type === 'image_url') {
                if (part.image_url?.url) {
                    images.push(part.image_url.url);
                }
            }
        }
    } else if (typeof content === 'string') {
        const base64Matches = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g);
        if (base64Matches) {
            images.push(...base64Matches);
        }
    }
    
    return images;
}
