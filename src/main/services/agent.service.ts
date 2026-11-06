import os from 'node:os';
import path from 'node:path';
import type {
  AgentConfig,
  AgentEvent,
  ChatMessage,
  ChatSession,
  ChatSessionFull,
  ProviderConfig,
  ToolInvocation,
} from '@shared/types';
import { SessionStore } from '../core/store';
import { log } from '../core/ipc';
import { newId, nowIso, truncate } from '../core/util';
import type { ContentService } from './content.service';
import type { MarketplaceService } from './marketplace.service';
import type { SettingsService } from './settings.service';
import type { TerminalService } from './terminal.service';
import type { ToolRegistry } from './tools';
import { AcpClient, type AcpUpdate } from './providers/acpClient';
import { createAdapter, type LlmMessage, type LlmToolCall } from './providers/adapters';

export class ApprovalRegistry {
  private pending = new Map<string, (approved: boolean) => void>();

  request(callId: string, timeoutMs = 300_000): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(callId);
        resolve(false);
      }, timeoutMs);
      this.pending.set(callId, (approved) => {
        clearTimeout(timer);
        this.pending.delete(callId);
        resolve(approved);
      });
    });
  }

  resolve(callId: string, approved: boolean): boolean {
    const fn = this.pending.get(callId);
    if (!fn) return false;
    fn(approved);
    return true;
  }

  cancelAll(): void {
    for (const [id, fn] of this.pending) {
      this.pending.delete(id);
      fn(false);
    }
  }
}

interface AgentDeps {
  settings: SettingsService;
  toolRegistry: ToolRegistry;
  marketplace: MarketplaceService;
  content: ContentService;
  terminal: TerminalService;
  emit: (event: AgentEvent) => void;
  approvals: ApprovalRegistry;
  cwd: () => string;
}

interface ActiveTurn {
  controller: AbortController;
  messageId: string;
}

const MAX_CONTEXT_MESSAGES = 40;

export class AgentService {
  readonly sessions = new SessionStore();
  private active = new Map<string, ActiveTurn>();
  private acpClients = new Map<string, AcpClient>();

  constructor(private readonly deps: AgentDeps) {}

  async init(): Promise<void> {
    await this.sessions.init();
  }

  /* --------------------------- sessions --------------------------- */

  listSessions(): ChatSession[] {
    return this.sessions.list();
  }

  async getSession(id: string): Promise<ChatSessionFull> {
    const session = await this.sessions.get(id);
    if (!session) throw new Error('Conversation not found');
    return session;
  }

  async createSession(input: { title?: string; providerId?: string; model?: string; spaceId?: string; agentId?: string; systemPrompt?: string }): Promise<ChatSessionFull> {
    const settings = this.deps.settings.public();
    const provider = settings.providers.find((p) => p.id === input.providerId && p.enabled) ?? settings.providers.find((p) => p.enabled);
    const agent = settings.agents.find((a) => a.id === (input.agentId ?? settings.activeAgentId)) ?? settings.agents[0];
    const providerId = provider?.id ?? '';
    const model = input.model ?? provider?.defaultModel ?? '';
    return this.sessions.create({
      title: input.title,
      providerId,
      model,
      spaceId: input.spaceId,
      agentId: agent?.id,
      systemPrompt: input.systemPrompt,
    });
  }

  async patchSession(id: string, patch: Partial<ChatSession>): Promise<ChatSession> {
    const updated = await this.sessions.patch(id, patch as Partial<ChatSessionFull>);
    if (!updated) throw new Error('Conversation not found');
    const { messages, ...meta } = updated;
    return meta;
  }

  async deleteSession(id: string): Promise<void> {
    this.active.get(id)?.controller.abort();
    this.active.delete(id);
    await this.sessions.delete(id);
  }

  cancel(sessionId: string): boolean {
    const turn = this.active.get(sessionId);
    if (!turn) return false;
    turn.controller.abort();
    this.deps.approvals.cancelAll();
    const client = this.acpClients.values();
    for (const c of client) {
      try {
        c.cancel();
      } catch {
        /* ignore */
      }
    }
    return true;
  }

  approve(callId: string, approved: boolean, always = false): void {
    if (always) {
      const call = this.findCall(callId);
      if (call) {
        const settings = this.deps.settings.public();
        this.deps.settings.patch({ toolPolicies: { ...settings.toolPolicies, [call.name]: 'auto' } });
      }
    }
    this.deps.approvals.resolve(callId, approved);
  }

  private findCall(callId: string): ToolInvocation | null {
    return this.callIndex.get(callId) ?? null;
  }

  private callIndex = new Map<string, ToolInvocation>();

  /* ----------------------------- send ----------------------------- */

  async send(sessionId: string, text: string, attachments?: ChatMessage['attachments']): Promise<{ ok: boolean; messageId: string }> {
    const session = await this.getSession(sessionId);
    const settings = this.deps.settings.public();
    const provider = settings.providers.find((p) => p.id === session.providerId);
    const agent = settings.agents.find((a) => a.id === session.agentId) ?? settings.agents[0];

    const userMessage: ChatMessage = {
      id: newId('msg'),
      role: 'user',
      content: text,
      createdAt: nowIso(),
      attachments,
    };
    await this.sessions.appendMessage(sessionId, userMessage);

    const assistant: ChatMessage = {
      id: newId('msg'),
      role: 'assistant',
      content: '',
      createdAt: nowIso(),
      providerId: provider?.id,
      model: session.model,
    };
    await this.sessions.appendMessage(sessionId, assistant);

    const controller = new AbortController();
    this.active.set(sessionId, { controller, messageId: assistant.id });
    this.deps.emit({ type: 'turn_start', sessionId, messageId: assistant.id });

    void this.runTurn({ sessionId, assistantId: assistant.id, provider, agent, controller, settings })
      .catch((error: Error) => {
        log.error('agent', 'turn failed', error);
        this.deps.emit({ type: 'error', sessionId, message: error.message });
        this.deps.emit({ type: 'turn_end', sessionId, messageId: assistant.id, reason: 'error' });
      })
      .finally(() => {
        this.active.delete(sessionId);
      });

    return { ok: true, messageId: assistant.id };
  }

  async regenerate(sessionId: string): Promise<{ ok: boolean }> {
    const session = await this.getSession(sessionId);
    const lastUser = [...session.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) throw new Error('Nothing to regenerate');
    // Drop the trailing assistant/tool messages, then replay the last user turn.
    const keep: ChatMessage[] = [];
    for (const message of session.messages) {
      if (message.role === 'user' && message.id === lastUser.id) {
        keep.push(message);
        break;
      }
      keep.push(message);
    }
    session.messages = keep;
    session.messageCount = keep.length;
    await this.sessions.save(session);
    await this.send(sessionId, lastUser.content, lastUser.attachments);
    return { ok: true };
  }

  private async runTurn(args: {
    sessionId: string;
    assistantId: string;
    provider: ProviderConfig | undefined;
    agent: AgentConfig | undefined;
    controller: AbortController;
    settings: ReturnType<SettingsService['public']>;
  }): Promise<void> {
    const { sessionId, assistantId, provider, agent, controller, settings } = args;
    const session = await this.getSession(sessionId);
    const assistant = session.messages.find((m) => m.id === assistantId)!;

    if (!provider) {
      throw new Error('No provider configured. Open Settings â†’ Providers to connect one.');
    }
    if (provider.kind === 'acp') {
      await this.runAcpTurn(session, assistant, provider, controller);
      return;
    }

    const adapter = createAdapter(provider);
    const toolDefs = this.deps.toolRegistry.definitions(agent?.tools);
    const system = await this.buildSystemPrompt(session, agent, provider);
    const maxSteps = Math.max(1, Math.min(60, agent?.maxSteps ?? 24));

    let steps = 0;
    while (steps < maxSteps) {
      if (controller.signal.aborted) break;
      steps += 1;

      const llmMessages = toLlmMessages(session.messages.filter((m) => m.id !== assistant.id), system);
      const request = {
        model: session.model || provider.defaultModel,
        system,
        messages: llmMessages,
        tools: toolDefs,
        temperature: agent?.temperature ?? 0.3,
        maxTokens: 8192,
      };

      const pendingCalls: LlmToolCall[] = [];
      let stepText = '';
      let reasoning = '';

      try {
        for await (const event of adapter.stream(request, controller.signal)) {
          if (controller.signal.aborted) break;
          if (event.type === 'text') {
            stepText += event.delta;
            assistant.content += event.delta;
            this.deps.emit({ type: 'text_delta', sessionId, messageId: assistant.id, delta: event.delta });
          } else if (event.type === 'reasoning') {
            reasoning += event.delta;
            assistant.reasoning = (assistant.reasoning ?? '') + event.delta;
            this.deps.emit({ type: 'reasoning_delta', sessionId, messageId: assistant.id, delta: event.delta });
          } else if (event.type === 'tool_call') {
            pendingCalls.push(event.call);
          } else if (event.type === 'usage') {
            assistant.usage = event.usage;
            this.deps.emit({ type: 'usage', sessionId, messageId: assistant.id, usage: event.usage });
          }
        }
      } catch (error) {
        if (controller.signal.aborted) break;
        const message = error instanceof Error ? error.message : String(error);
        assistant.error = message;
        this.deps.emit({ type: 'error', sessionId, message });
        break;
      }

      if (!pendingCalls.length) break;

      // Record the tool calls on the assistant message and execute them.
      assistant.toolCalls = [...(assistant.toolCalls ?? [])];
      for (const call of pendingCalls) {
        const invocation: ToolInvocation = {
          id: call.id || newId('call'),
          name: call.name,
          args: call.args ?? {},
          status: 'pending',
        };
        assistant.toolCalls.push(invocation);
        this.callIndex.set(invocation.id, invocation);
        this.deps.emit({ type: 'tool_call', sessionId, messageId: assistant.id, call: invocation });

        const result = await this.executeTool(invocation, sessionId, controller.signal);
        Object.assign(invocation, result);
        this.deps.emit({ type: 'tool_result', sessionId, messageId: assistant.id, call: invocation });

        // Feed the result back as a tool message for the next model step.
        session.messages.push({
          id: newId('msg'),
          role: 'tool',
          content: truncate(result.output ?? '(no output)', 30_000),
          toolCallId: invocation.id,
          createdAt: nowIso(),
        });
      }
      await this.sessions.save(session);
    }

    assistant.createdAt = assistant.createdAt;
    session.updatedAt = nowIso();
    await this.sessions.save(session);
    this.deps.emit({
      type: 'turn_end',
      sessionId,
      messageId: assistant.id,
      reason: controller.signal.aborted ? 'cancelled' : steps >= maxSteps ? 'max_steps' : 'done',
    });
  }

  private async executeTool(invocation: ToolInvocation, sessionId: string, signal: AbortSignal): Promise<ToolInvocation> {
    const policy = this.deps.toolRegistry.policyFor(invocation.name);
    if (policy === 'deny') {
      return { ...invocation, status: 'denied', output: 'Tool is disabled by policy in Settings â†’ Tools.', startedAt: nowIso(), endedAt: nowIso(), durationMs: 0 };
    }
    if (policy === 'ask') {
      const approved = await this.deps.approvals.request(invocation.id);
      if (!approved) {
        return { ...invocation, status: 'denied', output: 'The user declined this tool call.', startedAt: nowIso(), endedAt: nowIso(), durationMs: 0 };
      }
    }
    if (signal.aborted) {
      return { ...invocation, status: 'denied', output: 'Cancelled before execution.' };
    }
    return this.deps.toolRegistry.invoke(invocation.name, invocation.args, { sessionId });
  }

  private async buildSystemPrompt(session: ChatSessionFull, agent: AgentConfig | undefined, provider: ProviderConfig): Promise<string> {
    const settings = this.deps.settings.public();
    const base = session.systemPrompt || agent?.systemPrompt || 'You are Neuro, the resident agent of Neuro OS.';
    const workspace = settings.workspaceRoot || this.deps.cwd();
    const skills = this.deps.marketplace.skillPromptBlock();
    const memories = this.deps.content.recall(
      session.messages.filter((m) => m.role === 'user').slice(-1)[0]?.content ?? '',
      4,
    );
    const memoryBlock = memories.length ? `\n\n## Remembered context\n${memories.map((m) => `- ${m.text}`).join('\n')}` : '';
    return `${base}

## Environment
- Operating system: ${process.platform} ${os.release()} (${os.arch()})
- Workspace root: ${workspace}
- Current date: ${new Date().toISOString()}
- Model: ${session.model} via ${provider.name}
- Shell: ${process.platform === 'win32' ? 'PowerShell' : process.env.SHELL ?? 'sh'}

## Rules of the environment
- File tools accept absolute paths. Paths inside the workspace root are pre-approved; anything outside needs a reason.
- Prefer \`shell.exec\` over describing commands. Prefer reading files over assuming.
- Keep responses in the user's language.${memoryBlock}${skills}${session.messages.length > 0 ? '' : ''}`;
  }

  /* ------------------------------ ACP ------------------------------ */

  private async runAcpTurn(session: ChatSessionFull, assistant: ChatMessage, provider: ProviderConfig, controller: AbortController): Promise<void> {
    const client = await this.ensureAcp(provider);
    const sessionId = session.id;
    this.deps.emit({ type: 'status', sessionId, status: `ACP Â· ${client.agentInfo?.title ?? provider.name}` });

    if (!client.currentSession) {
      await client.newSession(this.deps.settings.public().workspaceRoot || this.deps.cwd());
    }

    const knownTools = new Map<string, ToolInvocation>();
    const onUpdate = (update: AcpUpdate) => {
      if (controller.signal.aborted) return;
      switch (update.kind) {
        case 'text':
          assistant.content += update.text;
          this.deps.emit({ type: 'text_delta', sessionId, messageId: assistant.id, delta: update.text });
          break;
        case 'thought':
          assistant.reasoning = (assistant.reasoning ?? '') + update.text;
          this.deps.emit({ type: 'reasoning_delta', sessionId, messageId: assistant.id, delta: update.text });
          break;
        case 'tool': {
          const existing = knownTools.get(update.id);
          const invocation: ToolInvocation = existing ?? {
            id: update.id,
            name: update.title,
            args: {},
            status: 'running',
            startedAt: nowIso(),
          };
          invocation.name = update.title || invocation.name;
          invocation.status = update.status === 'completed' ? 'ok' : update.status === 'failed' ? 'error' : 'running';
          if (invocation.status !== 'running') invocation.endedAt = nowIso();
          assistant.toolCalls = [...(assistant.toolCalls ?? []).filter((t) => t.id !== invocation.id), invocation];
          knownTools.set(update.id, invocation);
          this.deps.emit({ type: existing ? 'tool_result' : 'tool_call', sessionId, messageId: assistant.id, call: invocation });
          break;
        }
        case 'error':
          assistant.error = update.message;
          this.deps.emit({ type: 'error', sessionId, message: update.message });
          break;
        case 'stop':
          this.deps.emit({ type: 'turn_end', sessionId, messageId: assistant.id, reason: update.reason === 'cancelled' ? 'cancelled' : 'done' });
          break;
        default:
          break;
      }
    };

    client.on('update', onUpdate);
    try {
      const stopReason = await client.prompt(session.messages.filter((m) => m.role === 'user').slice(-1)[0]?.content ?? '');
      await this.sessions.save(session);
      this.deps.emit({
        type: 'turn_end',
        sessionId,
        messageId: assistant.id,
        reason: stopReason === 'cancelled' || controller.signal.aborted ? 'cancelled' : 'done',
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        assistant.error = (error as Error).message;
        this.deps.emit({ type: 'error', sessionId, message: (error as Error).message });
        this.deps.emit({ type: 'turn_end', sessionId, messageId: assistant.id, reason: 'error' });
      }
    } finally {
      client.off('update', onUpdate);
      await this.sessions.save(session);
    }
  }

  async ensureAcp(provider: ProviderConfig): Promise<AcpClient> {
    const existing = this.acpClients.get(provider.id);
    if (existing?.isRunning) return existing;
    if (!provider.acp?.command) throw new Error('This ACP provider has no launch command configured.');
    const client = new AcpClient({
      command: provider.acp.command,
      args: provider.acp.args ?? [],
      cwd: provider.acp.cwd || this.deps.cwd(),
      env: provider.acp.env,
      onPermission: async () => true,
    });
    await client.connect();
    this.acpClients.set(provider.id, client);
    return client;
  }

  disconnectAcp(providerId: string): void {
    this.acpClients.get(providerId)?.disconnect();
    this.acpClients.delete(providerId);
  }

  acpStatus(providerId: string): { connected: boolean; agent?: { name: string; version: string } } {
    const client = this.acpClients.get(providerId);
    return { connected: Boolean(client?.isRunning), agent: client?.agentInfo ?? undefined };
  }

  async shutdown(): Promise<void> {
    this.deps.approvals.cancelAll();
    for (const client of this.acpClients.values()) client.disconnect();
    this.acpClients.clear();
  }
}

/* ------------------------------------------------------------------ */
/* Message conversion                                                  */
/* ------------------------------------------------------------------ */

function toLlmMessages(messages: ChatMessage[], _system: string): LlmMessage[] {
  const out: LlmMessage[] = [];
  const recent = messages.slice(-MAX_CONTEXT_MESSAGES);
  for (const message of recent) {
    if (message.role === 'user') {
      out.push({ role: 'user', content: message.content });
    } else if (message.role === 'assistant') {
      if (!message.content && !message.toolCalls?.length) continue;
      out.push({
        role: 'assistant',
        content: message.content,
        toolCalls: message.toolCalls?.map((call) => ({ id: call.id, name: call.name, args: call.args })),
      });
    } else if (message.role === 'tool') {
      const name = findToolName(messages, message.toolCallId);
      out.push({ role: 'tool', content: message.content, toolCallId: message.toolCallId, toolName: name });
    }
  }
  return out;
}

function findToolName(messages: ChatMessage[], callId?: string): string {
  if (!callId) return 'tool';
  for (const message of messages) {
    const hit = message.toolCalls?.find((call) => call.id === callId);
    if (hit) return hit.name;
  }
  return 'tool';
}

export const defaultWorkspaceCwd = (): string => path.join(os.homedir(), 'Neuro Workspace');

