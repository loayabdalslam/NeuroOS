export enum LLMError {
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    INVALID_API_KEY = 'INVALID_API_KEY',
    BAD_REQUEST = 'BAD_REQUEST',
    MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
    SERVER_ERROR = 'SERVER_ERROR',
    NO_RESPONSE = 'NO_RESPONSE',
    ABORTED = 'ABORTED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    UNKNOWN = 'UNKNOWN',
}

const ErrorMessages: Record<LLMError, string> = {
    [LLMError.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded. Please wait a moment before trying again.',
    [LLMError.INVALID_API_KEY]: 'Invalid API key. Please check your provider settings.',
    [LLMError.BAD_REQUEST]: 'The request was invalid. This might be due to unsupported parameters or message format.',
    [LLMError.MODEL_NOT_FOUND]: 'The requested model was not found. Please check your model selection.',
    [LLMError.SERVER_ERROR]: 'The AI server encountered an error. Please try again later.',
    [LLMError.NO_RESPONSE]: 'No response received from the AI. Please try again.',
    [LLMError.ABORTED]: 'Request was cancelled.',
    [LLMError.NETWORK_ERROR]: 'Network error. Please check your internet connection.',
    [LLMError.UNKNOWN]: 'An unexpected error occurred while communicating with the AI.',
};

export class LLMProviderError extends Error {
    code: LLMError;

    constructor(code: LLMError, originalMessage?: string) {
        super(ErrorMessages[code]);
        this.name = 'LLMProviderError';
        this.code = code;
        if (originalMessage) {
            this.message = `${ErrorMessages[code]} (${originalMessage})`;
        }
    }
}

export function getUserFriendlyError(error: unknown): string {
    if (error instanceof LLMProviderError) {
        return error.message;
    }
    
    if (error instanceof Error) {
        if (error.name === 'AbortError') {
            return ErrorMessages[LLMError.ABORTED];
        }
        
        // Handle common fetch-related errors
        const msg = error.message.toLowerCase();
        if (msg.includes('network') || msg.includes('failed to fetch')) {
            return ErrorMessages[LLMError.NETWORK_ERROR];
        }
        
        return error.message;
    }
    
    return ErrorMessages[LLMError.UNKNOWN];
}
