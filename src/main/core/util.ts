import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const nowIso = (): string => new Date().toISOString();
export const newId = (prefix = ''): string => (prefix ? `${prefix}_` : '') + randomUUID().replace(/-/g, '').slice(0, 18);

export const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

export function expandHome(input: string): string {
  if (!input) return input;
  if (input === '~') return os.homedir();
  if (input.startsWith('~/') || input.startsWith('~\\')) return path.join(os.homedir(), input.slice(2));
  return input;
}

export function normalizePath(input: string): string {
  return path.normalize(expandHome(input));
}

export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

/** Write JSON atomically: temp file then rename, so a crash never truncates state. */
export async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const payload = JSON.stringify(data, null, 2);
  await fsp.writeFile(tmp, payload, 'utf8');
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fsp.rename(tmp, file);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!code || !['EPERM', 'EBUSY', 'EACCES'].includes(code) || attempt === 5) {
        await fsp.rm(tmp, { force: true }).catch(() => undefined);
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

export function writeJsonAtomicSync(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      fs.renameSync(tmp, file);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!code || !['EPERM', 'EBUSY', 'EACCES'].includes(code) || attempt === 5) {
        try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
        throw error;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25 * (attempt + 1));
    }
  }
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fsp.readFile(file, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function readJsonSync<T>(file: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function isBinaryBuffer(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000);
  for (let i = 0; i < len; i += 1) if (buf[i] === 0) return true;
  return false;
}

export function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === null || patch === undefined) return base;
  if (Array.isArray(patch)) return patch as unknown as T;
  if (typeof patch !== 'object') return patch as unknown as T;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return patch as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined) continue;
    out[key] = deepMerge((base as Record<string, unknown>)[key], value);
  }
  return out as T;
}

export function truncate(text: string, max = 4000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number): T {
  let timer: NodeJS.Timeout | null = null;
  return ((...args: never[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  }) as T;
}

export function homeRelative(p: string): string {
  const home = os.homedir();
  return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function pickObject<T extends object>(obj: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const key of keys) if (obj[key] !== undefined) out[key] = obj[key];
  return out;
}
