export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
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
    chat(messages: LLMMessage[]): Promise<LLMResponse>;
    stream(messages: LLMMessage[], onChunk: (chunk: string) => void, signal?: AbortSignal): Promise<void>;
    validateConfig?(): Promise<boolean>;
}
