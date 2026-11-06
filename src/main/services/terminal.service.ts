import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { TerminalInfo } from '@shared/types';
import { log } from '../core/ipc';
import { newId, nowIso } from '../core/util';

type PtyModule = typeof import('@homebridge/node-pty-prebuilt-multiarch');

let ptyModule: PtyModule | null = null;
let ptyTried = false;

function loadPty(): PtyModule | null {
  if (ptyTried) return ptyModule;
  ptyTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ptyModule = require('@homebridge/node-pty-prebuilt-multiarch') as PtyModule;
    log.info('terminal', 'native PTY backend available');
  } catch (error) {
    ptyModule = null;
    log.warn('terminal', 'native PTY unavailable, falling back to pipe mode', error);
  }
  return ptyModule;
}

export const ptyAvailable = (): boolean => loadPty() !== null;

function detectShell(): string {
  if (process.platform === 'win32') {
    const pwsh = ['C:\\Program Files\\PowerShell\\7\\pwsh.exe', path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'pwsh.exe')].find((p) => existsSync(p));
    return pwsh ?? 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (key === 'ELECTRON_RUN_AS_NODE') continue;
    env[key] = value;
  }
  env.NEURO_OS = '1';
  env.TERM_PROGRAM = 'Neuro OS';
  env.COLORTERM = 'truecolor';
  return env;
}

interface Session {
  info: TerminalInfo;
  pty?: import('@homebridge/node-pty-prebuilt-multiarch').IPty;
  child?: ChildProcessWithoutNullStreams;
  buffer: string;
  pending: string;
  busy: boolean;
  queue: string[];
}

export class TerminalService {
  private sessions = new Map<string, Session>();

  constructor(private readonly emitData: (id: string, data: string) => void, private readonly emitExit: (id: string, code: number) => void) {}

  list(): TerminalInfo[] {
    return [...this.sessions.values()].map((s) => s.info);
  }

  get(id: string): TerminalInfo | null {
    return this.sessions.get(id)?.info ?? null;
  }

  create(opts: { cwd?: string; shell?: string; cols?: number; rows?: number; title?: string; owner?: string }): TerminalInfo {
    const id = newId('term');
    const shell = opts.shell || detectShell();
    const cwd = opts.cwd && existsSync(opts.cwd) ? opts.cwd : os.homedir();
    const info: TerminalInfo = {
      id,
      title: opts.title ?? (path.basename(shell, '.exe') || 'shell'),
      cwd,
      shell,
      cols: opts.cols ?? 120,
      rows: opts.rows ?? 32,
      status: 'starting',
      createdAt: nowIso(),
      usingPty: false,
      owner: opts.owner,
    };
    const session: Session = { info, buffer: '', pending: '', busy: false, queue: [] };
    this.sessions.set(id, session);

    const pty = loadPty();
    log.info('terminal', `spawn ${shell} ${JSON.stringify(shellArgsFor(shell))} pty=${Boolean(pty)} cwd=${cwd}`);
    if (pty) {
      try {
        const proc = pty.spawn(shell, shellArgsFor(shell), {
          name: 'xterm-256color',
          cols: info.cols,
          rows: info.rows,
          cwd,
          env: cleanEnv(),
          useConpty: true,
        });
        session.pty = proc;
        session.info.usingPty = true;
        proc.onData((data) => {
          session.buffer = (session.buffer + data).slice(-200_000);
          this.emitData(id, data);
        });
        proc.onExit(({ exitCode }) => {
          session.info.status = 'exited';
          session.info.exitCode = exitCode;
          this.emitExit(id, exitCode);
        });
        session.info.status = 'running';
        return info;
      } catch (error) {
        log.warn('terminal', 'pty spawn failed, using pipe fallback', error);
      }
    }

    this.startPipeSession(session);
    return info;
  }

  private startPipeSession(session: Session): void {
    session.info.status = 'running';
    session.info.usingPty = false;
    this.emitData(
      session.info.id,
      `\x1b[38;5;111mNeuro OS shell\x1b[0m \x1b[90m· pipe mode (native PTY unavailable)\x1b[0m\r\n` +
        `\x1b[90mType a command and press Enter. \`cd\` changes directory.\x1b[0m\r\n\r\n`,
    );
    this.printPrompt(session);
  }

  private printPrompt(session: Session): void {
    const short = session.info.cwd.length > 46 ? `…${session.info.cwd.slice(-44)}` : session.info.cwd;
    this.emitData(session.info.id, `\x1b[38;5;75m${short}\x1b[0m \x1b[90m>\x1b[0m `);
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    if (session.pty) {
      session.pty.write(data);
      return;
    }
    // Line-oriented fallback shell.
    if (data === '\u0003') {
      this.emitData(id, '^C\r\n');
      session.pending = '';
      this.printPrompt(session);
      return;
    }
    for (const char of data) {
      if (char === '\r' || char === '\n') {
        const command = session.pending.trim();
        session.pending = '';
        this.emitData(id, '\r\n');
        if (command) this.enqueue(session, command);
        else this.printPrompt(session);
      } else if (char === '\u007f') {
        if (session.pending.length) {
          session.pending = session.pending.slice(0, -1);
          this.emitData(id, '\b \b');
        }
      } else if (char >= ' ') {
        session.pending += char;
        this.emitData(id, char);
      }
    }
  }

  private enqueue(session: Session, command: string): void {
    session.queue.push(command);
    if (!session.busy) void this.drain(session);
  }

  private async drain(session: Session): Promise<void> {
    session.busy = true;
    while (session.queue.length) {
      const command = session.queue.shift()!;
      await this.runCommand(session, command);
    }
    session.busy = false;
    this.printPrompt(session);
  }

  private runCommand(session: Session, command: string): Promise<void> {
    const cd = /^cd(?:\s+(.*))?$/i.exec(command);
    if (cd) {
      const targetRaw = (cd[1] ?? '~').trim().replace(/^["']|["']$/g, '');
      const target = targetRaw === '~' ? os.homedir() : targetRaw === '..' ? path.dirname(session.info.cwd) : path.resolve(session.info.cwd, targetRaw);
      if (existsSync(target) && path.extname(target) === '') {
        session.info.cwd = target;
      } else {
        this.emitData(session.info.id, `\x1b[31mcd: no such directory: ${targetRaw}\x1b[0m\r\n`);
      }
      return Promise.resolve();
    }
    if (/^(clear|cls)$/i.test(command)) {
      this.emitData(session.info.id, '\x1b[2J\x1b[H');
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const isWin = process.platform === 'win32';
      const shell = session.info.shell;
      const args = isWin ? ['-NoLogo', '-NoProfile', '-Command', command] : ['-lc', command];
      const child = spawn(shell, args, { cwd: session.info.cwd, env: cleanEnv(), windowsHide: true });
      child.stdout.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8').replace(/\r?\n/g, '\r\n');
        session.buffer = (session.buffer + text).slice(-200_000);
        this.emitData(session.info.id, text);
      });
      child.stderr.on('data', (chunk: Buffer) => {
        this.emitData(session.info.id, `\x1b[31m${chunk.toString('utf8').replace(/\r?\n/g, '\r\n')}\x1b[0m`);
      });
      child.on('error', (error) => {
        this.emitData(session.info.id, `\x1b[31m${error.message}\x1b[0m\r\n`);
        resolve();
      });
      child.on('close', () => resolve());
    });
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.info.cols = Math.max(20, cols);
    session.info.rows = Math.max(5, rows);
    try {
      session.pty?.resize(session.info.cols, session.info.rows);
    } catch {
      /* ignore */
    }
  }

  kill(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    try {
      session.pty?.kill();
    } catch {
      /* ignore */
    }
    session.info.status = 'exited';
    this.emitExit(id, 0);
    this.sessions.delete(id);
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id);
  }

  buffer(id: string): string {
    return this.sessions.get(id)?.buffer ?? '';
  }
}

function shellArgsFor(shell: string): string[] {
  const base = path.basename(shell).toLowerCase().replace(/\.exe$/, '');
  if (base === 'cmd') return ['/K'];
  if (base === 'powershell' || base === 'pwsh') {
    // -NoProfile matters: a broken user profile makes ConPTY drop into
    // PowerShell's help text and exit, which looks like a dead terminal.
    return ['-NoLogo', '-NoProfile'];
  }
  if (base === 'bash' || base === 'zsh' || base === 'sh' || base === 'fish') return ['-i'];
  return [];
}

