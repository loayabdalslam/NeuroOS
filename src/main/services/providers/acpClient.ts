import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { log } from '../../core/ipc';
import { newId } from '../../core/util';

/**
 * A complete client for the Agent Client Protocol (ACP) v1.
 *
 * Anything that speaks ACP — Gemini CLI, Claude Code bridges, Zed agents, custom
 * runtimes — can be attached as a Neuro OS provider. We implement the client
 * half of the protocol: initialization, sessions, prompts, the client-side
 * filesystem and terminal capabilities, and permission mediation.
 *
 * Spec: https://agentclientprotocol.com/protocol/v1/overview
 */

export interface AcpAgentInfo {
  name: string;
  title?: string;
  version: string;
}

export interface AcpInitializeResult {
  protocolVersion: number;
  agentCapabilities?: {
    loadSession?: boolean;
    promptCapabilities?: { image?: boolean; audio?: boolean; embeddedContext?: boolean };
    mcpCapabilities?: { http?: boolean; sse?: boolean };
  };
  agentInfo?: AcpAgentInfo;
  authMethods?: { id: string; name: string; description?: string }[];
}

export type AcpUpdate =
  | { kind: 'text'; text: string }
  | { kind: 'thought'; text: string }
  | { kind: 'tool'; id: string; title: string; status: string; toolKind?: string; content?: unknown }
  | { kind: 'plan'; entries: { content: string; status: string; priority?: string }[] }
  | { kind: 'mode'; currentModeId: string }
  | { kind: 'available_commands'; commands: { name: string; description: string }[] }
  | { kind: 'usage'; used: number; size: number }
  | { kind: 'stop'; reason: string }
  | { kind: 'error'; message: string };

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

const PROTOCOL_VERSION = 1;
const REQUEST_TIMEOUT = 120_000;

export interface AcpClientOptions {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  onPermission?: (request: unknown) => Promise<boolean>;
}

export class AcpClient extends EventEmitter {
  private child: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private stdoutBuffer = '';
  private terminals = new Map<string, { proc: ChildProcess; output: string; exitCode: number | null }>();
  private sessionId: string | null = null;
  private disposed = false;
  public agentInfo: AcpAgentInfo | null = null;
  public capabilities: AcpInitializeResult['agentCapabilities'] = {};

  constructor(private readonly options: AcpClientOptions) {
    super();
  }

  get isRunning(): boolean {
    return this.child !== null && !this.disposed;
  }

  get currentSession(): string | null {
    return this.sessionId;
  }

  async connect(): Promise<AcpInitializeResult> {
    if (this.child) throw new Error('ACP client already connected');
    const { command, args, cwd, env } = this.options;
    // Windows: .cmd/.ps1 shims and bare command names need a shell, but real
    // executables must be spawned directly. When a shell is used, quote any
    // argument containing spaces — Node concatenates them unescaped.
    const useShell =
      process.platform === 'win32' &&
      (!path.extname(command) || /\.(cmd|bat|ps1)$/i.test(command));
    const spawnArgs = useShell ? args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)) : args;
    const child = spawn(command, spawnArgs, {
      cwd,
      env: { ...(process.env as Record<string, string>), ...(env ?? {}), ELECTRON_RUN_AS_NODE: undefined as unknown as string },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      shell: useShell,
    });
    this.child = child;

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => this.onStdout(chunk));
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      const text = chunk.trim();
      if (text) log.debug('acp', `[${command}] ${text.slice(0, 400)}`);
    });
    child.on('exit', (code) => {
      log.info('acp', `agent exited with ${code}`);
      this.rejectAll(new Error(`ACP agent exited (code ${code ?? 'null'})`));
      this.emit('exit', code);
      this.child = null;
    });
    child.on('error', (error) => {
      log.error('acp', 'spawn failed', error);
      this.rejectAll(error);
      this.emit('error', error);
    });

    const result = (await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
        session: { configOptions: { boolean: {} } },
      },
      clientInfo: { name: 'neuro-os', title: 'Neuro OS', version: '1.0.0' },
    })) as AcpInitializeResult;

    this.agentInfo = result.agentInfo ?? null;
    this.capabilities = result.agentCapabilities ?? {};
    log.info('acp', `initialized ${this.agentInfo?.name ?? command} (protocol v${result.protocolVersion})`);
    this.emit('initialized', result);
    return result;
  }

  async newSession(targetCwd: string): Promise<string> {
    const result = (await this.request('session/new', { cwd: targetCwd, mcpServers: [] })) as { sessionId: string };
    this.sessionId = result.sessionId;
    return result.sessionId;
  }

  async loadSession(sessionId: string, targetCwd: string): Promise<void> {
    await this.request('session/load', { sessionId, cwd: targetCwd, mcpServers: [] });
    this.sessionId = sessionId;
  }

  async prompt(text: string): Promise<string> {
    if (!this.sessionId) throw new Error('No ACP session — call newSession first');
    // Prompt turns stream through notifications; the request resolves when the
    // agent finishes the turn (or is cancelled).
    const result = (await this.request('session/prompt', {
      sessionId: this.sessionId,
      prompt: [{ type: 'text', text }],
    })) as { stopReason?: string } | null;
    const stopReason = result?.stopReason ?? 'end_turn';
    this.emit('update', { kind: 'stop', reason: stopReason } satisfies AcpUpdate);
    return stopReason;
  }

  cancel(): void {
    if (!this.sessionId) return;
    this.notify('session/cancel', { sessionId: this.sessionId });
  }

  setMode(modeId: string): void {
    if (!this.sessionId) return;
    void this.request('session/set_mode', { sessionId: this.sessionId, modeId }).catch((error) =>
      log.warn('acp', `set_mode failed: ${(error as Error).message}`),
    );
  }

  disconnect(): void {
    this.disposed = true;
    for (const terminal of this.terminals.values()) {
      try {
        terminal.proc.kill();
      } catch {
        /* ignore */
      }
    }
    this.terminals.clear();
    this.rejectAll(new Error('ACP client disconnected'));
    try {
      this.child?.kill();
    } catch {
      /* ignore */
    }
    this.child = null;
  }

  /* ---------------------------------------------------------------- */
  /* JSON-RPC plumbing                                                */
  /* ---------------------------------------------------------------- */

  private send(payload: unknown): void {
    if (!this.child?.stdin?.writable) throw new Error('ACP agent is not running');
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  private notify(method: string, params: unknown): void {
    this.send({ jsonrpc: '2.0', method, params });
  }

  private request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`ACP request timed out: ${method}`));
      }, REQUEST_TIMEOUT);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.send({ jsonrpc: '2.0', id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error as Error);
      }
    });
  }

  private respond(id: number, result: unknown): void {
    this.send({ jsonrpc: '2.0', id, result });
  }

  private respondError(id: number, code: number, message: string): void {
    this.send({ jsonrpc: '2.0', id, error: { code, message } });
  }

  private rejectAll(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  private onStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    let newline = this.stdoutBuffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (line) {
        try {
          this.handleMessage(JSON.parse(line));
        } catch (error) {
          log.warn('acp', `unparseable line: ${line.slice(0, 200)}`);
        }
      }
      newline = this.stdoutBuffer.indexOf('\n');
    }
  }

  private handleMessage(message: any): void {
    if (message.method && message.id !== undefined) {
      void this.handleServerRequest(message);
      return;
    }
    if (message.method) {
      if (message.method === 'session/update') {
        this.handleSessionUpdate(message.params?.update);
      } else if (message.method === 'fs/read_text_file' || message.method === 'fs/write_text_file') {
        /* server request handled above */
      } else {
        log.debug('acp', `notification ${message.method}`);
      }
      return;
    }
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? 'ACP error'));
      else pending.resolve(message.result);
    }
  }

  private handleSessionUpdate(update: any): void {
    if (!update) return;
    switch (update.sessionUpdate) {
      case 'agent_message_chunk': {
        const text = textFromContent(update.content);
        if (text) this.emit('update', { kind: 'text', text } satisfies AcpUpdate);
        break;
      }
      case 'agent_thought_chunk': {
        const text = textFromContent(update.content);
        if (text) this.emit('update', { kind: 'thought', text } satisfies AcpUpdate);
        break;
      }
      case 'tool_call': {
        this.emit('update', {
          kind: 'tool',
          id: update.toolCallId ?? newId('acp_tool'),
          title: update.title ?? update.kind ?? 'tool',
          status: update.status ?? 'pending',
          toolKind: update.kind,
          content: update.content,
        } satisfies AcpUpdate);
        break;
      }
      case 'tool_call_update': {
        this.emit('update', {
          kind: 'tool',
          id: update.toolCallId ?? 'tool',
          title: update.title ?? 'tool',
          status: update.status ?? 'completed',
          toolKind: update.kind,
          content: update.content,
        } satisfies AcpUpdate);
        break;
      }
      case 'plan': {
        this.emit('update', { kind: 'plan', entries: update.entries ?? [] } satisfies AcpUpdate);
        break;
      }
      case 'current_mode_update': {
        this.emit('update', { kind: 'mode', currentModeId: update.currentModeId } satisfies AcpUpdate);
        break;
      }
      case 'available_commands_update': {
        this.emit('update', { kind: 'available_commands', commands: update.availableCommands ?? [] } satisfies AcpUpdate);
        break;
      }
      case 'usage_update': {
        this.emit('update', { kind: 'usage', used: update.used ?? 0, size: update.size ?? 0 } satisfies AcpUpdate);
        break;
      }
      default:
        log.debug('acp', `unhandled update ${update.sessionUpdate}`);
    }
  }

  private async handleServerRequest(message: any): Promise<void> {
    const { id, method, params } = message;
    try {
      switch (method) {
        case 'fs/read_text_file': {
          const content = await fs.readFile(params.path, 'utf8');
          this.respond(id, { content });
          return;
        }
        case 'fs/write_text_file': {
          await fs.mkdir(path.dirname(params.path), { recursive: true });
          await fs.writeFile(params.path, params.content ?? '', 'utf8');
          this.respond(id, null);
          return;
        }
        case 'session/request_permission': {
          const allowed = await this.options.onPermission?.(params);
          const options = (params.options ?? []) as { optionId: string; kind: string }[];
          const allow = options.find((o) => o.kind === 'allow_once' || o.kind === 'allow_always') ?? options[0];
          const reject = options.find((o) => o.kind === 'reject_once' || o.kind === 'reject_always') ?? options[options.length - 1];
          const chosen = allowed === false ? reject : allow;
          this.respond(id, chosen ? { outcome: { outcome: 'selected', optionId: chosen.optionId } } : { outcome: { outcome: 'cancelled' } });
          return;
        }
        case 'terminal/create': {
          const terminalId = newId('acpterm');
          const proc = spawn(params.command, params.args ?? [], {
            cwd: params.cwd,
            env: { ...(process.env as Record<string, string>), ...(params.env ?? []) },
            windowsHide: true,
            shell: process.platform === 'win32',
          });
          const record = { proc, output: '', exitCode: null as number | null };
          proc.stdout?.on('data', (chunk: Buffer) => {
            record.output += chunk.toString('utf8');
          });
          proc.stderr?.on('data', (chunk: Buffer) => {
            record.output += chunk.toString('utf8');
          });
          proc.on('close', (code) => {
            record.exitCode = code ?? 0;
          });
          this.terminals.set(terminalId, record);
          this.respond(id, { terminalId });
          return;
        }
        case 'terminal/output': {
          const record = this.terminals.get(params.terminalId);
          this.respond(id, { output: record?.output ?? '', truncated: false, exitStatus: record?.exitCode !== null ? { exitCode: record?.exitCode } : null });
          return;
        }
        case 'terminal/wait_for_exit': {
          const record = this.terminals.get(params.terminalId);
          if (!record) {
            this.respondError(id, -32000, 'Unknown terminal');
            return;
          }
          if (record.exitCode !== null) this.respond(id, { exitCode: record.exitCode });
          else record.proc.on('close', (code) => this.respond(id, { exitCode: code ?? 0 }));
          return;
        }
        case 'terminal/kill': {
          const record = this.terminals.get(params.terminalId);
          record?.proc.kill();
          this.respond(id, null);
          return;
        }
        case 'terminal/release': {
          const record = this.terminals.get(params.terminalId);
          record?.proc.kill();
          this.terminals.delete(params.terminalId);
          this.respond(id, null);
          return;
        }
        default:
          this.respondError(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      log.warn('acp', `${method} failed`, error);
      this.respondError(id, -32000, (error as Error).message);
    }
  }
}

function textFromContent(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(textFromContent).join('');
  if (typeof content.text === 'string') return content.text;
  if (content.type === 'text') return content.text ?? '';
  return '';
}
