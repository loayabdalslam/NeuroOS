import type { ConnectionProbe, ModelInfo, ProviderConfig } from '@shared/types';
import type { ToolDef } from '@shared/types';

export interface LlmToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  /** Raw argument JSON, used by Anthropic streaming. */
  raw?: string;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: LlmToolCall[];
  toolCallId?: string;
  toolName?: string;
  reasoning?: string;
}

export interface LlmRequest {
  model: string;
  system: string;
  messages: LlmMessage[];
  tools: ToolDef[];
  temperature: number;
  maxTokens: number;
}

export type LlmStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'tool_call'; call: LlmToolCall }
  | { type: 'usage'; usage: { input?: number; output?: number; total?: number } }
  | { type: 'done'; stopReason?: string };

export interface ProviderAdapter {
  stream(req: LlmRequest, signal: AbortSignal): AsyncGenerator<LlmStreamEvent>;
  listModels(): Promise<ModelInfo[]>;
  probe(): Promise<ConnectionProbe>;
}

/* ------------------------------------------------------------------ */
/* SSE helpers                                                         */
/* ------------------------------------------------------------------ */

async function* sseEvents(response: Response, signal: AbortSignal): AsyncGenerator<string> {
  if (!response.body) throw new Error('Response had no body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of chunk.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) yield trimmed.slice(5).trim();
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
}

async function assertOk(response: Response, provider: string): Promise<void> {
  if (response.ok) return;
  let detail = '';
  try {
    detail = await response.text();
  } catch {
    /* ignore */
  }
  let message = detail;
  try {
    const parsed = JSON.parse(detail);
    message = parsed.error?.message ?? parsed.message ?? detail;
  } catch {
    /* plain text */
  }
  throw new Error(`${provider} · HTTP ${response.status} — ${String(message).slice(0, 400)}`);
}

function joinUrl(base: string, suffix: string): string {
  return `${base.replace(/\/+$/, '')}/${suffix.replace(/^\/+/, '')}`;
}

function authHeaders(provider: ProviderConfig): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(provider.headers ?? {}) };
  if (provider.apiKey) headers.authorization = `Bearer ${provider.apiKey}`;
  return headers;
}

/* ------------------------------------------------------------------ */
/* OpenAI-compatible (OpenAI, DeepSeek, Groq, OpenRouter, xAI, Ollama…) */
/* ------------------------------------------------------------------ */

export class OpenAiCompatibleAdapter implements ProviderAdapter {
  constructor(private readonly provider: ProviderConfig) {}

  private toApiMessages(req: LlmRequest) {
    const messages: Record<string, unknown>[] = [];
    if (req.system.trim()) messages.push({ role: 'system', content: req.system });
    for (const m of req.messages) {
      if (m.role === 'assistant') {
        messages.push({
          role: 'assistant',
          content: m.content || null,
          ...(m.toolCalls?.length
            ? {
                tool_calls: m.toolCalls.map((c) => ({
                  id: c.id,
                  type: 'function',
                  function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) },
                })),
              }
            : {}),
        });
      } else if (m.role === 'tool') {
        messages.push({ role: 'tool', tool_call_id: m.toolCallId, content: m.content });
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    }
    return messages;
  }

  async *stream(req: LlmRequest, signal: AbortSignal): AsyncGenerator<LlmStreamEvent> {
    const body: Record<string, unknown> = {
      model: req.model,
      messages: this.toApiMessages(req),
      stream: true,
      stream_options: { include_usage: true },
      temperature: req.temperature,
      max_tokens: req.maxTokens,
    };
    if (req.tools.length) {
      body.tools = req.tools.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));
      body.tool_choice = 'auto';
    }
        const rawBase = this.provider.baseUrl || 'https://api.openai.com/v1';
    const base = this.provider.kind === 'ollama' && !/\/v1\/?$/.test(rawBase) ? `${rawBase.replace(/\/$/, '')}/v1` : rawBase;
    const endpoint = joinUrl(base, 'chat/completions');
    const timeoutSignal = AbortSignal.timeout(180_000);
    const combinedSignal = AbortSignal.any ? AbortSignal.any([signal, timeoutSignal]) : signal;
    const call = (): Promise<Response> =>
      fetch(endpoint, {
        method: 'POST',
        headers: authHeaders(this.provider),
        body: JSON.stringify(body),
        signal: combinedSignal,
      });
    let response = await call();
    if (!response.ok) {
      const errorText = await response.text();
      if (body.tools && /does not support tools/i.test(errorText)) {
        // Local models (Ollama, llama.cpp) may reject a tools payload.
        delete body.tools;
        delete body.tool_choice;
        response = await call();
      } else {
        throw new Error(`${this.provider.name}: ${errorText.slice(0, 400) || response.statusText}`);
      }
    }
    await assertOk(response, this.provider.name);

    const pending = new Map<number, LlmToolCall>();
    let usage: { input?: number; output?: number; total?: number } | null = null;

    for await (const data of sseEvents(response, signal)) {
      if (data === '[DONE]') break;
      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      if (parsed.error) throw new Error(parsed.error.message ?? 'Provider error');
      if (parsed.usage) {
        usage = {
          input: parsed.usage.prompt_tokens,
          output: parsed.usage.completion_tokens,
          total: parsed.usage.total_tokens,
        };
      }
      const choice = parsed.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta ?? {};
      if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
        yield { type: 'reasoning', delta: delta.reasoning_content };
      }
      if (typeof delta.content === 'string' && delta.content) {
        yield { type: 'text', delta: delta.content };
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const index = tc.index ?? 0;
          const existing = pending.get(index) ?? { id: tc.id ?? `call_${index}`, name: '', args: {}, raw: '' };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name += tc.function.name;
          if (tc.function?.arguments) existing.raw = (existing.raw ?? '') + tc.function.arguments;
          pending.set(index, existing);
        }
      }
      if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
        for (const [, call] of [...pending.entries()].sort((a, b) => a[0] - b[0])) {
          call.args = safeParseArgs(call.raw);
          yield { type: 'tool_call', call };
        }
        pending.clear();
      }
    }
    for (const [, call] of [...pending.entries()].sort((a, b) => a[0] - b[0])) {
      call.args = safeParseArgs(call.raw);
      yield { type: 'tool_call', call };
    }
    if (usage) yield { type: 'usage', usage };
    yield { type: 'done' };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(joinUrl(this.provider.baseUrl, 'models'), {
        headers: authHeaders(this.provider),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) return this.provider.models;
      const json = (await response.json()) as any;
      const list = (json.data ?? json.models ?? []) as any[];
      const models = list
        .map((m) => (typeof m === 'string' ? m : m.id ?? m.name))
        .filter((id): id is string => typeof id === 'string')
        .sort();
      if (!models.length) return this.provider.models;
      return models.map((id) => ({ id, label: id, supportsTools: true }));
    } catch {
      return this.provider.models;
    }
  }

  async probe(): Promise<ConnectionProbe> {
    const started = Date.now();
    try {
      const models = await this.listModels();
      return {
        ok: true,
        latencyMs: Date.now() - started,
        message: `Reachable · ${models.length} models`,
        models: models.map((m) => m.id).slice(0, 60),
      };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: (error as Error).message };
    }
  }
}

function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return { _raw: raw };
  }
}

/* ------------------------------------------------------------------ */
/* Anthropic Messages API                                              */
/* ------------------------------------------------------------------ */

export class AnthropicAdapter implements ProviderAdapter {
  constructor(private readonly provider: ProviderConfig) {}

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': this.provider.apiKey,
      ...(this.provider.headers ?? {}),
    };
  }

  private toApiMessages(req: LlmRequest) {
    const out: any[] = [];
    for (const m of req.messages) {
      if (m.role === 'assistant') {
        const content: any[] = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        for (const call of m.toolCalls ?? []) {
          content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.args ?? {} });
        }
        if (content.length) out.push({ role: 'assistant', content });
      } else if (m.role === 'tool') {
        out.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: m.toolCallId, content: m.content }],
        });
      } else if (m.role === 'user') {
        out.push({ role: 'user', content: [{ type: 'text', text: m.content }] });
      }
    }
    // Merge consecutive same-role turns (Anthropic requires alternation).
    const merged: any[] = [];
    for (const msg of out) {
      const last = merged[merged.length - 1];
      if (last && last.role === msg.role) last.content.push(...msg.content);
      else merged.push({ ...msg, content: [...msg.content] });
    }
    return merged;
  }

  async *stream(req: LlmRequest, signal: AbortSignal): AsyncGenerator<LlmStreamEvent> {
    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      stream: true,
      system: req.system,
      messages: this.toApiMessages(req),
    };
    if (req.tools.length) {
      body.tools = req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
    }
    const response = await fetch(joinUrl(this.provider.baseUrl || 'https://api.anthropic.com/v1', 'messages'), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal,
    });
    await assertOk(response, this.provider.name);

    const blocks = new Map<number, { id: string; name: string; raw: string }>();
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;

    for await (const data of sseEvents(response, signal)) {
      let event: any;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }
      switch (event.type) {
        case 'message_start':
          inputTokens = event.message?.usage?.input_tokens;
          break;
        case 'content_block_start':
          if (event.content_block?.type === 'tool_use') {
            blocks.set(event.index, { id: event.content_block.id, name: event.content_block.name, raw: '' });
          }
          break;
        case 'content_block_delta':
          if (event.delta?.type === 'text_delta') yield { type: 'text', delta: event.delta.text };
          else if (event.delta?.type === 'thinking_delta') yield { type: 'reasoning', delta: event.delta.thinking ?? '' };
          else if (event.delta?.type === 'input_json_delta') {
            const block = blocks.get(event.index);
            if (block) block.raw += event.delta.partial_json ?? '';
          }
          break;
        case 'content_block_stop': {
          const block = blocks.get(event.index);
          if (block) {
            yield { type: 'tool_call', call: { id: block.id, name: block.name, args: safeParseArgs(block.raw), raw: block.raw } };
            blocks.delete(event.index);
          }
          break;
        }
        case 'message_delta':
          outputTokens = event.usage?.output_tokens ?? outputTokens;
          break;
        case 'error':
          throw new Error(event.error?.message ?? 'Anthropic stream error');
        default:
          break;
      }
    }
    if (inputTokens !== undefined || outputTokens !== undefined) {
      yield { type: 'usage', usage: { input: inputTokens, output: outputTokens, total: (inputTokens ?? 0) + (outputTokens ?? 0) } };
    }
    yield { type: 'done' };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(joinUrl(this.provider.baseUrl, 'models?limit=100'), {
        headers: this.headers(),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) return this.provider.models;
      const json = (await response.json()) as any;
      const data = (json.data ?? []) as any[];
      if (!data.length) return this.provider.models;
      return data.map((m) => ({ id: m.id, label: m.display_name ?? m.id, supportsTools: true }));
    } catch {
      return this.provider.models;
    }
  }

  async probe(): Promise<ConnectionProbe> {
    const started = Date.now();
    try {
      const models = await this.listModels();
      return { ok: true, latencyMs: Date.now() - started, message: `Reachable · ${models.length} models`, models: models.map((m) => m.id) };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: (error as Error).message };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Google Gemini                                                       */
/* ------------------------------------------------------------------ */

export class GeminiAdapter implements ProviderAdapter {
  constructor(private readonly provider: ProviderConfig) {}

  private toContents(req: LlmRequest) {
    const contents: any[] = [];
    for (const m of req.messages) {
      if (m.role === 'assistant') {
        const parts: any[] = [];
        if (m.content) parts.push({ text: m.content });
        for (const call of m.toolCalls ?? []) parts.push({ functionCall: { name: call.name, args: call.args ?? {} } });
        if (parts.length) contents.push({ role: 'model', parts });
      } else if (m.role === 'tool') {
        contents.push({ role: 'user', parts: [{ functionResponse: { name: m.toolName ?? 'tool', response: { result: m.content } } }] });
      } else if (m.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: m.content }] });
      }
    }
    return contents;
  }

  async *stream(req: LlmRequest, signal: AbortSignal): AsyncGenerator<LlmStreamEvent> {
    const url = `${joinUrl(this.provider.baseUrl || 'https://generativelanguage.googleapis.com/v1beta', `models/${req.model}:streamGenerateContent`)}?alt=sse&key=${encodeURIComponent(this.provider.apiKey)}`;
    const body: Record<string, unknown> = {
      contents: this.toContents(req),
      systemInstruction: { parts: [{ text: req.system }] },
      generationConfig: { temperature: req.temperature, maxOutputTokens: req.maxTokens },
    };
    if (req.tools.length) {
      body.tools = [
        {
          functionDeclarations: req.tools.map((t) => ({
            name: t.name.replace(/[^a-zA-Z0-9_]/g, '_'),
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ];
    }
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
    await assertOk(response, this.provider.name);

    let usage: { input?: number; output?: number; total?: number } | null = null;
    for await (const data of sseEvents(response, signal)) {
      let parsed: any;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      const candidate = parsed.candidates?.[0];
      if (parsed.usageMetadata) {
        usage = {
          input: parsed.usageMetadata.promptTokenCount,
          output: parsed.usageMetadata.candidatesTokenCount,
          total: parsed.usageMetadata.totalTokenCount,
        };
      }
      for (const part of candidate?.content?.parts ?? []) {
        if (typeof part.text === 'string' && part.text) yield { type: 'text', delta: part.text };
        if (part.functionCall) {
          yield {
            type: 'tool_call',
            call: {
              id: `gem_${part.functionCall.name}_${Math.random().toString(36).slice(2, 8)}`,
              name: part.functionCall.name,
              args: (part.functionCall.args ?? {}) as Record<string, unknown>,
            },
          };
        }
      }
    }
    if (usage) yield { type: 'usage', usage };
    yield { type: 'done' };
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${joinUrl(this.provider.baseUrl, 'models')}?key=${encodeURIComponent(this.provider.apiKey)}`, {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) return this.provider.models;
      const json = (await response.json()) as any;
      const models = (json.models ?? [])
        .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m: any) => ({ id: String(m.name).replace('models/', ''), label: m.displayName ?? m.name, supportsTools: true }));
      return models.length ? models : this.provider.models;
    } catch {
      return this.provider.models;
    }
  }

  async probe(): Promise<ConnectionProbe> {
    const started = Date.now();
    try {
      const models = await this.listModels();
      return { ok: true, latencyMs: Date.now() - started, message: `Reachable · ${models.length} models`, models: models.map((m) => m.id) };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, message: (error as Error).message };
    }
  }
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

export function createAdapter(provider: ProviderConfig): ProviderAdapter {
  switch (provider.kind) {
    case 'anthropic':
      return new AnthropicAdapter(provider);
    case 'gemini':
      return new GeminiAdapter(provider);
    case 'openai':
    case 'ollama':
    case 'custom':
    default:
      return new OpenAiCompatibleAdapter(provider);
  }
}
