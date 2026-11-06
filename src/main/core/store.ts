import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { ChatMessage, ChatSession, ChatSessionFull, ID } from '@shared/types';
import { deepMerge, ensureDir, newId, nowIso, readJson, readJsonSync, writeJsonAtomic } from './util';

/** Canonical on-disk layout for every Neuro OS profile. */
export const Paths = {
  get userData(): string {
    return app.getPath('userData');
  },
  get state(): string {
    return path.join(Paths.userData, 'state');
  },
  get sessions(): string {
    return path.join(Paths.userData, 'sessions');
  },
  get skills(): string {
    return path.join(Paths.userData, 'skills');
  },
  get plugins(): string {
    return path.join(Paths.userData, 'plugins');
  },
  get logs(): string {
    return path.join(Paths.userData, 'logs');
  },
  get cache(): string {
    return path.join(Paths.userData, 'cache');
  },
  get browser(): string {
    return path.join(Paths.userData, 'browser');
  },
  get workspaces(): string {
    return path.join(Paths.userData, 'workspaces');
  },
  stateFile(name: string): string {
    return path.join(Paths.state, `${name}.json`);
  },
  sessionFile(id: ID): string {
    return path.join(Paths.sessions, `${id}.json`);
  },
};

export async function ensureProfileDirs(): Promise<void> {
  for (const dir of [Paths.state, Paths.sessions, Paths.skills, Paths.plugins, Paths.logs, Paths.cache, Paths.browser, Paths.workspaces]) {
    await ensureDir(dir);
  }
}

/**
 * A tiny document store with an in-memory cache, coalesced writes and atomic
 * persistence. Every subsystem owns one store; there is no shared mutable blob.
 */
export class JsonStore<T extends object> {
  private cache: T;
  private dirty = false;
  private writing: Promise<void> | null = null;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly file: string,
    private readonly defaults: T,
    private readonly onError: (err: unknown) => void = () => {},
  ) {
    this.cache = deepMerge(defaults, readJsonSync<T>(file, {} as T));
  }

  get(): T {
    return this.cache;
  }

  replace(value: T): T {
    this.cache = value;
    this.schedule();
    return this.cache;
  }

  set(patch: unknown): T {
    this.cache = deepMerge(this.cache, patch);
    this.schedule();
    return this.cache;
  }

  private schedule(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 60);
  }

  async flush(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    if (this.writing) await this.writing;
    this.writing = writeJsonAtomic(this.file, this.cache).catch(this.onError);
    await this.writing;
    this.writing = null;
  }

  async reload(): Promise<T> {
    this.cache = deepMerge(this.defaults, await readJson<T>(this.file, {} as T));
    return this.cache;
  }
}

/**
 * Encrypts provider keys with the OS keychain (DPAPI on Windows, Keychain on
 * macOS, libsecret on Linux) through Electron safeStorage.
 */
export class SecretVault {
  private secrets: Record<string, string> = {};
  private file: string;
  private available: boolean;

  constructor() {
    this.file = path.join(Paths.state, 'vault.json');
    this.available = safeStorage.isEncryptionAvailable();
    if (fs.existsSync(this.file)) {
      try {
        this.secrets = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Record<string, string>;
      } catch {
        this.secrets = {};
      }
    }
  }

  get encryptionAvailable(): boolean {
    return this.available;
  }

  set(key: string, value: string): void {
    if (!value) {
      delete this.secrets[key];
    } else if (this.available) {
      this.secrets[key] = `enc:${safeStorage.encryptString(value).toString('base64')}`;
    } else {
      this.secrets[key] = `raw:${Buffer.from(value, 'utf8').toString('base64')}`;
    }
    this.persist();
  }

  get(key: string): string {
    const stored = this.secrets[key];
    if (!stored) return '';
    try {
      if (stored.startsWith('enc:') && this.available) {
        return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'));
      }
      if (stored.startsWith('raw:')) return Buffer.from(stored.slice(4), 'base64').toString('utf8');
    } catch {
      return '';
    }
    return '';
  }

  remove(key: string): void {
    delete this.secrets[key];
    this.persist();
  }

  private persist(): void {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.secrets, null, 2), { encoding: 'utf8', mode: 0o600 });
    } catch {
      /* non-fatal */
    }
  }
}

interface SessionIndexEntry extends ChatSession {}

/** Append-oriented chat persistence: an index plus one document per session. */
export class SessionStore {
  private index: SessionIndexEntry[] = [];
  private cache = new Map<ID, ChatSessionFull>();
  private indexFile = path.join(Paths.sessions, 'index.json');
  private loaded = false;

  async init(): Promise<void> {
    if (this.loaded) return;
    await ensureDir(Paths.sessions);
    this.index = await readJson<SessionIndexEntry[]>(this.indexFile, []);
    this.loaded = true;
  }

  list(): ChatSession[] {
    return [...this.index].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async get(id: ID): Promise<ChatSessionFull | null> {
    if (this.cache.has(id)) return structuredClone(this.cache.get(id)!);
    const data = await readJson<ChatSessionFull | null>(Paths.sessionFile(id), null);
    if (data) this.cache.set(id, data);
    return data ? structuredClone(data) : null;
  }

  async create(init: Partial<ChatSessionFull> & { providerId: ID; model: string }): Promise<ChatSessionFull> {
    const now = nowIso();
    const session: ChatSessionFull = {
      id: newId('ses'),
      title: init.title ?? 'New conversation',
      providerId: init.providerId,
      model: init.model,
      spaceId: init.spaceId,
      agentId: init.agentId,
      systemPrompt: init.systemPrompt,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      messages: [],
    };
    this.cache.set(session.id, session);
    await this.save(session);
    return structuredClone(session);
  }

  async save(session: ChatSessionFull): Promise<void> {
    this.cache.set(session.id, session);
    await writeJsonAtomic(Paths.sessionFile(session.id), session);
    const meta: SessionIndexEntry = {
      id: session.id,
      title: session.title,
      providerId: session.providerId,
      model: session.model,
      spaceId: session.spaceId,
      agentId: session.agentId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messageCount: session.messageCount,
      pinned: session.pinned,
      archived: session.archived,
    };
    const idx = this.index.findIndex((s) => s.id === session.id);
    if (idx >= 0) this.index[idx] = meta;
    else this.index.push(meta);
    await writeJsonAtomic(this.indexFile, this.index);
  }

  async appendMessage(id: ID, message: ChatMessage): Promise<ChatSessionFull | null> {
    const session = await this.get(id);
    if (!session) return null;
    session.messages.push(message);
    session.messageCount = session.messages.length;
    session.updatedAt = nowIso();
    if (session.title === 'New conversation' && message.role === 'user') {
      session.title = message.content.replace(/\s+/g, ' ').trim().slice(0, 56) || 'New conversation';
    }
    await this.save(session);
    return session;
  }

  async patch(id: ID, patch: Partial<ChatSessionFull>): Promise<ChatSessionFull | null> {
    const session = await this.get(id);
    if (!session) return null;
    const next = { ...session, ...patch, id: session.id };
    await this.save(next);
    return next;
  }

  async delete(id: ID): Promise<void> {
    this.cache.delete(id);
    this.index = this.index.filter((s) => s.id !== id);
    await writeJsonAtomic(this.indexFile, this.index);
    await fsp.rm(Paths.sessionFile(id), { force: true });
  }
}
