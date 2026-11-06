import type { ModelInfo, ProviderConfig, ProviderKind } from './types';

export interface ProviderPreset {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  models: ModelInfo[];
  color: string;
  keyHint: string;
  docs: string;
  local?: boolean;
  description: string;
  badge?: string;
}

const m = (id: string, label?: string, extra: Partial<ModelInfo> = {}): ModelInfo => ({
  id,
  label: label ?? id,
  supportsTools: true,
  ...extra,
});

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    color: '#4176e6',
    keyHint: 'sk-…',
    docs: 'https://platform.deepseek.com/api_keys',
    description: 'DeepSeek V3 and R1 — fast reasoning at low cost.',
    badge: 'Recommended',
    models: [
      m('deepseek-chat', 'DeepSeek V3.2', { contextWindow: 131072, maxOutput: 8192 }),
      m('deepseek-reasoner', 'DeepSeek R1', { contextWindow: 131072, maxOutput: 32768, supportsReasoning: true }),
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    color: '#0f1115',
    keyHint: 'sk-…',
    docs: 'https://platform.openai.com/api-keys',
    description: 'GPT-4.1, GPT-4o and the o-series reasoning models.',
    models: [
      m('gpt-4.1', 'GPT-4.1', { contextWindow: 1047576, maxOutput: 32768, supportsVision: true }),
      m('gpt-4o', 'GPT-4o', { contextWindow: 128000, maxOutput: 16384, supportsVision: true }),
      m('gpt-4o-mini', 'GPT-4o mini', { contextWindow: 128000, maxOutput: 16384, supportsVision: true }),
      m('o4-mini', 'o4-mini', { contextWindow: 200000, maxOutput: 100000, supportsReasoning: true }),
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    color: '#d97757',
    keyHint: 'sk-ant-…',
    docs: 'https://console.anthropic.com/settings/keys',
    description: 'Claude Sonnet, Opus and Haiku with native tool use.',
    models: [
      m('claude-sonnet-4-5', 'Claude Sonnet 4.5', { contextWindow: 200000, maxOutput: 64000, supportsVision: true, supportsReasoning: true }),
      m('claude-opus-4-1', 'Claude Opus 4.1', { contextWindow: 200000, maxOutput: 32000, supportsVision: true, supportsReasoning: true }),
      m('claude-haiku-4-5', 'Claude Haiku 4.5', { contextWindow: 200000, maxOutput: 32000, supportsVision: true }),
    ],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    kind: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    color: '#4285f4',
    keyHint: 'AIza…',
    docs: 'https://aistudio.google.com/apikey',
    description: 'Gemini 2.5 Pro and Flash with a 1M token window.',
    models: [
      m('gemini-2.5-pro', 'Gemini 2.5 Pro', { contextWindow: 1048576, maxOutput: 65536, supportsVision: true, supportsReasoning: true }),
      m('gemini-2.5-flash', 'Gemini 2.5 Flash', { contextWindow: 1048576, maxOutput: 65536, supportsVision: true }),
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    kind: 'ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    color: '#22c55e',
    keyHint: 'not required',
    docs: 'https://ollama.com/download',
    local: true,
    description: 'Run open models entirely offline on this machine.',
    badge: 'Local',
    models: [
      m('qwen2.5-coder:7b', 'Qwen2.5 Coder 7B', { contextWindow: 32768 }),
      m('llama3.1:8b', 'Llama 3.1 8B', { contextWindow: 131072 }),
      m('deepseek-r1:8b', 'DeepSeek R1 8B', { contextWindow: 65536, supportsReasoning: true }),
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    color: '#6366f1',
    keyHint: 'sk-or-…',
    docs: 'https://openrouter.ai/keys',
    description: 'One key for 300+ models across every provider.',
    models: [
      m('deepseek/deepseek-chat-v3.1', 'DeepSeek V3.1'),
      m('anthropic/claude-sonnet-4.5', 'Claude Sonnet 4.5', { contextWindow: 200000 }),
      m('qwen/qwen3-coder', 'Qwen3 Coder'),
      m('meta-llama/llama-3.3-70b-instruct', 'Llama 3.3 70B'),
    ],
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    kind: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    color: '#111827',
    keyHint: 'xai-…',
    docs: 'https://console.x.ai',
    description: 'Grok models with real-time knowledge.',
    models: [m('grok-4', 'Grok 4', { contextWindow: 256000 }), m('grok-3-mini', 'Grok 3 mini', { contextWindow: 131072 })],
  },
  {
    id: 'groq',
    name: 'Groq',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    color: '#f55036',
    keyHint: 'gsk_…',
    docs: 'https://console.groq.com/keys',
    description: 'LPU inference — hundreds of tokens per second.',
    models: [
      m('llama-3.3-70b-versatile', 'Llama 3.3 70B', { contextWindow: 131072 }),
      m('qwen/qwen3-32b', 'Qwen3 32B', { contextWindow: 131072 }),
      m('moonshotai/kimi-k2-instruct', 'Kimi K2', { contextWindow: 131072 }),
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    color: '#fa520f',
    keyHint: '…',
    docs: 'https://console.mistral.ai/api-keys',
    description: 'Mistral Large, Codestral and open weights.',
    models: [m('mistral-large-latest', 'Mistral Large'), m('codestral-latest', 'Codestral')],
  },
  {
    id: 'qwen',
    name: 'Alibaba Qwen',
    kind: 'openai',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    color: '#615ced',
    keyHint: 'sk-…',
    docs: 'https://bailian.console.alibabacloud.com',
    description: 'Qwen3 Max and Coder through DashScope.',
    models: [m('qwen3-max', 'Qwen3 Max', { contextWindow: 262144 }), m('qwen3-coder-plus', 'Qwen3 Coder Plus')],
  },
  {
    id: 'together',
    name: 'Together AI',
    kind: 'openai',
    baseUrl: 'https://api.together.xyz/v1',
    color: '#0f6fff',
    keyHint: '…',
    docs: 'https://api.together.ai/settings/api-keys',
    description: 'Open-source frontier models on demand.',
    models: [m('deepseek-ai/DeepSeek-V3', 'DeepSeek V3'), m('Qwen/Qwen3-235B-A22B-Instruct', 'Qwen3 235B')],
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    kind: 'openai',
    baseUrl: 'http://127.0.0.1:1234/v1',
    color: '#8b5cf6',
    keyHint: 'not required',
    docs: 'https://lmstudio.ai',
    local: true,
    description: 'Serve local GGUF models over an OpenAI-compatible API.',
    badge: 'Local',
    models: [m('local-model', 'Currently loaded model', { contextWindow: 32768 })],
  },
  {
    id: 'acp',
    name: 'ACP Agent',
    kind: 'acp',
    baseUrl: '',
    color: '#14b8a6',
    keyHint: 'command',
    docs: 'https://agentclientprotocol.com',
    description: 'Attach any Agent Client Protocol agent over stdio.',
    badge: 'Protocol',
    models: [m('acp:auto', 'Agent default')],
  },
  {
    id: 'custom',
    name: 'Custom endpoint',
    kind: 'custom',
    baseUrl: '',
    color: '#64748b',
    keyHint: 'any',
    docs: '',
    description: 'Any OpenAI-compatible HTTP endpoint, self-hosted or proxied.',
    models: [m('custom-model', 'Custom model')],
  },
];

export function presetToProvider(preset: ProviderPreset, apiKey = ''): ProviderConfig {
  return {
    id: preset.id,
    name: preset.name,
    kind: preset.kind,
    baseUrl: preset.baseUrl,
    apiKey,
    enabled: true,
    models: preset.models,
    defaultModel: preset.models[0]?.id ?? '',
    createdAt: new Date().toISOString(),
    color: preset.color,
  };
}

export const providerPreset = (id: string): ProviderPreset | undefined => PROVIDER_PRESETS.find((p) => p.id === id);
