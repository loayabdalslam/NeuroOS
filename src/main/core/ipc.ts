import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { app, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import type { EventChannel, EventMap, IpcChannel, IpcParams, IpcResult } from '@shared/ipc';
import { Paths } from './store';

/* ------------------------------------------------------------------ */
/* Logging                                                             */
/* ------------------------------------------------------------------ */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private stream: fs.WriteStream | null = null;
  private ring: string[] = [];
  private readonly development = !app.isPackaged;

  private ensureStream(): void {
    if (this.stream) return;
    try {
      fs.mkdirSync(Paths.logs, { recursive: true });
      this.stream = fs.createWriteStream(path.join(Paths.logs, 'neuro.log'), { flags: 'a' });
    } catch {
      this.stream = null;
    }
  }

  log(level: LogLevel, scope: string, message: string, detail?: unknown): void {
    const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}${
      detail === undefined ? '' : ` ${formatDetail(detail)}`
    }`;
    this.ring.push(line);
    if (this.ring.length > 500) this.ring.shift();
    this.ensureStream();
    this.stream?.write(`${line}\n`);
    if (this.development) {
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      fn(line);
    }
  }

  debug(scope: string, message: string, detail?: unknown): void {
    this.log('debug', scope, message, detail);
  }
  info(scope: string, message: string, detail?: unknown): void {
    this.log('info', scope, message, detail);
  }
  warn(scope: string, message: string, detail?: unknown): void {
    this.log('warn', scope, message, detail);
  }
  error(scope: string, message: string, detail?: unknown): void {
    this.log('error', scope, message, detail);
  }
  recent(): string[] {
    return [...this.ring];
  }
}

function formatDetail(detail: unknown): string {
  if (detail instanceof Error) return `${detail.name}: ${detail.message}`;
  try {
    const text = typeof detail === 'string' ? detail : JSON.stringify(detail);
    return text.length > 800 ? `${text.slice(0, 800)}…` : text;
  } catch {
    return String(detail);
  }
}

export const log = new Logger();

/* ------------------------------------------------------------------ */
/* Typed IPC router                                                    */
/* ------------------------------------------------------------------ */

export type Handler<C extends IpcChannel> = (
  params: IpcParams<C>,
  event: IpcMainInvokeEvent,
) => Promise<IpcResult<C>> | IpcResult<C>;

export type HandlerMap = { [C in IpcChannel]?: Handler<C> };

export class IpcRouter {
  private handlers = new Map<string, Handler<IpcChannel>>();

  constructor(private readonly window: () => BrowserWindow | null) {}

  register(map: HandlerMap): void {
    for (const [channel, handler] of Object.entries(map)) {
      if (!handler) continue;
      if (this.handlers.has(channel)) {
        throw new Error(`Duplicate IPC handler registered for ${channel}`);
      }
      this.handlers.set(channel, handler as Handler<IpcChannel>);
    }
  }

  attach(): void {
    for (const [channel, handler] of this.handlers) {
      ipcMain.handle(channel, async (event, params) => {
        try {
          return await handler(params, event);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          log.error('ipc', `${channel} failed: ${message}`, error);
          throw new Error(message);
        }
      });
    }
    log.info('ipc', `mounted ${this.handlers.size} channels`);
  }

  emit<E extends EventChannel>(channel: E, payload: EventMap[E]): void {
    const win = this.window();
    if (!win || win.isDestroyed()) return;
    win.webContents.send(`evt:${channel}`, payload);
  }
}

/* ------------------------------------------------------------------ */
/* In-process event bridge (services talk to each other here)          */
/* ------------------------------------------------------------------ */

export const bus = new EventEmitter();
bus.setMaxListeners(80);
