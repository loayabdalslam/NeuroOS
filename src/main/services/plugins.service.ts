import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import vm from 'node:vm';
import type {
  InstalledTheme,
  PluginManifest,
  PluginPermission,
  PluginProviderEntry,
  PluginRecord,
  ToastPayload,
  ToolDescriptor,
} from '@shared/types';
import type { ProviderAdapter, LlmStreamEvent } from './providers/adapters';
import { JsonStore, Paths } from '../core/store';
import { log } from '../core/ipc';
import { newId, nowIso, truncate } from '../core/util';
import type { ToolRegistry } from './tools';

const execFileAsync = promisify(execFile);

const MANIFEST_FILES = ['neuro.plugin.json', 'plugin.json', 'manifest.json'];
const VALID_PERMISSIONS: PluginPermission[] = ['fs', 'shell', 'net', 'ui', 'mail', 'automation', 'agents'];

interface PluginEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  path: string;
  enabled: boolean;
  installedAt: string;
  permissions: PluginPermission[];
  manifest: PluginManifest;
  error?: string;
}

interface PluginState {
  entries: PluginEntry[];
}

interface LoadedPlugin {
  tools: ToolDescriptor[];
  commands: Map<string, (args?: unknown) => Promise<string> | string>;
  adapters: Map<string, { name: string; models: string[]; stream: (request: unknown, signal?: AbortSignal) => AsyncGenerator<unknown> }>;
  themes: InstalledTheme[];
  logs: string[];
  storage: Record<string, unknown>;
}

export interface PluginHooks {
  toast: (toast: ToastPayload) => void;
  navigate: (surface: string, params?: Record<string, string>) => void;
  mailSend?: (input: { to: string; subject: string; body: string }) => Promise<unknown>;
  agentRun?: (prompt: string, agentId?: string) => Promise<string>;
  cwd?: () => string;
}

const DEFAULT_STATE: PluginState = { entries: [] };

export class PluginService {
  private store: JsonStore<PluginState>;
  private loaded = new Map<string, LoadedPlugin>();
  private registry: ToolRegistry;
  private hooks: PluginHooks;
  private onChange: () => void;

  constructor(deps: { registry: ToolRegistry; hooks: PluginHooks; onChange: () => void }) {
    this.registry = deps.registry;
    this.hooks = deps.hooks;
    this.onChange = deps.onChange;
    this.store = new JsonStore<PluginState>(Paths.stateFile('plugins'), DEFAULT_STATE, (error) =>
      log.error('plugins', 'persist failed', error),
    );
  }

  async init(): Promise<void> {
    await this.ensureDirs();
    for (const entry of this.store.get().entries) {
      if (!entry.enabled) continue;
      await this.load(entry);
    }
    log.info('plugins', `${this.store.get().entries.length} installed · ${this.loaded.size} loaded`);
  }

  private async ensureDirs(): Promise<void> {
    await fs.mkdir(Paths.plugins, { recursive: true });
  }

  /* -------------------------------- queries -------------------------------- */

  list(): PluginRecord[] {
    return this.store.get().entries.map((entry) => {
      const runtime = this.loaded.get(entry.id);
      const manifest = entry.manifest;
      return {
        id: entry.id,
        name: entry.name,
        version: entry.version,
        description: entry.description,
        author: entry.author,
        path: entry.path,
        enabled: entry.enabled,
        installedAt: entry.installedAt,
        permissionList: entry.permissions,
        contributions: {
          tools: manifest.contributes?.tools?.length ?? 0,
          themes: manifest.contributes?.themes?.length ?? 0,
          providers: manifest.contributes?.providers?.length ?? 0,
          adapters: manifest.contributes?.adapters?.length ?? 0,
          commands: manifest.contributes?.commands?.length ?? 0,
        },
        status: !entry.enabled ? 'disabled' : entry.error || !runtime ? 'error' : 'loaded',
        error: entry.error,
      };
    });
  }

  themes(): InstalledTheme[] {
    return [...this.loaded.values()].flatMap((runtime) => runtime.themes);
  }

  providers(): PluginProviderEntry[] {
    const entries: PluginProviderEntry[] = [];
    for (const entry of this.store.get().entries) {
      if (!entry.enabled) continue;
      for (const provider of entry.manifest.contributes?.providers ?? []) {
        entries.push({
          id: `plugin:${entry.id}:${provider.id}`,
          pluginId: entry.id,
          pluginName: entry.name,
          name: provider.name,
          description: provider.description,
          baseUrl: provider.baseUrl,
          models: provider.models ?? [],
          kind: 'preset',
        });
      }
      for (const adapter of entry.manifest.contributes?.adapters ?? []) {
        entries.push({
          id: `plugin:${entry.id}:${adapter.id}`,
          pluginId: entry.id,
          pluginName: entry.name,
          name: adapter.name,
          description: adapter.description,
          models: adapter.models,
          kind: 'adapter',
        });
      }
    }
    return entries;
  }

  logs(id: string): string[] {
    return this.loaded.get(id)?.logs ?? [];
  }

  /* -------------------------------- install -------------------------------- */

  async installFromPath(sourcePath: string): Promise<PluginRecord> {
    await this.ensureDirs();
    const stat = await fs.stat(sourcePath);
    let folder = sourcePath;
    let cleanup: string | null = null;

    if (stat.isFile()) {
      const lower = sourcePath.toLowerCase();
      if (!lower.endsWith('.zip') && !lower.endsWith('.neuro')) throw new Error('Plugin package must be a folder or a .zip archive');
      folder = await fs.mkdtemp(path.join(Paths.cache, 'plugin-'));
      cleanup = folder;
      await this.extractZip(sourcePath, folder);
      // Some archives nest everything in a single top folder.
      const children = await fs.readdir(folder, { withFileTypes: true });
      const dirs = children.filter((child) => child.isDirectory());
      const hasManifest = MANIFEST_FILES.some((file) => fsSync.existsSync(path.join(folder, file)));
      if (!hasManifest && dirs.length === 1) folder = path.join(folder, dirs[0].name);
    }

    const manifestPath = await this.findManifest(folder);
    if (!manifestPath) throw new Error(`No plugin manifest found. Expected one of: ${MANIFEST_FILES.join(', ')}`);
    const manifest = await this.readManifest(manifestPath);
    this.validateManifest(manifest);

    const existing = this.store.get().entries.find((entry) => entry.id === manifest.id);
    if (existing) throw new Error(`Plugin "${manifest.id}" is already installed. Uninstall it first.`);

    const destination = path.join(Paths.plugins, manifest.id);
    await fs.rm(destination, { recursive: true, force: true });
    await fs.cp(folder, destination, { recursive: true });
    if (cleanup) await fs.rm(cleanup, { recursive: true, force: true });

    const entry: PluginEntry = {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      path: destination,
      enabled: true,
      installedAt: nowIso(),
      permissions: (manifest.permissions ?? []).filter((permission) => VALID_PERMISSIONS.includes(permission)),
      manifest,
    };
    this.store.set({ entries: [...this.store.get().entries, entry] });
    await this.load(entry);
    this.persistEntry(entry);
    this.onChange();
    log.info('plugins', `installed ${manifest.id}@${manifest.version}`);
    return this.list().find((record) => record.id === manifest.id)!;
  }

  async installFromArchive(archivePath: string): Promise<PluginRecord> {
    return this.installFromPath(archivePath);
  }

  async installFromUrl(url: string): Promise<PluginRecord> {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const temp = path.join(Paths.cache, `${newId('plugin')}.zip`);
    await fs.writeFile(temp, buffer);
    try {
      return await this.installFromPath(temp);
    } finally {
      await fs.rm(temp, { force: true });
    }
  }

  private async findManifest(folder: string): Promise<string | null> {
    for (const file of MANIFEST_FILES) {
      const candidate = path.join(folder, file);
      if (fsSync.existsSync(candidate)) return candidate;
    }
    return null;
  }

  private async readManifest(file: string): Promise<PluginManifest> {
    const raw = await fs.readFile(file, 'utf8');
    try {
      return JSON.parse(raw) as PluginManifest;
    } catch (error) {
      throw new Error(`Manifest is not valid JSON: ${(error as Error).message}`);
    }
  }

  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.id || !/^[a-z0-9][a-z0-9-_.]{1,48}$/i.test(manifest.id)) {
      throw new Error('Manifest "id" must be 2-49 chars: letters, numbers, dash, underscore or dot');
    }
    if (!manifest.name) throw new Error('Manifest is missing "name"');
    if (!manifest.version) throw new Error('Manifest is missing "version"');
    for (const permission of manifest.permissions ?? []) {
      if (!VALID_PERMISSIONS.includes(permission)) throw new Error(`Unknown permission "${permission}"`);
    }
    for (const tool of manifest.contributes?.tools ?? []) {
      if (!tool.name || !tool.parameters) throw new Error(`Tool "${tool.name ?? '?'}" needs "name" and "parameters"`);
    }
    for (const theme of manifest.contributes?.themes ?? []) {
      if (!theme.id || !theme.name || !theme.design) throw new Error('Themes need "id", "name" and "design"');
    }
  }

  private async extractZip(archive: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });
    try {
      if (process.platform === 'win32') {
        await execFileAsync(
          'powershell.exe',
          ['-NoLogo', '-NoProfile', '-Command', `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`],
          { timeout: 60_000, windowsHide: true },
        );
      } else {
        await execFileAsync('unzip', ['-o', archive, '-d', destination], { timeout: 60_000 });
      }
    } catch (error) {
      throw new Error(`Could not extract archive: ${(error as Error).message}`);
    }
  }

  private persistEntry(entry: PluginEntry): void {
    const entries = this.store.get().entries.map((item) => (item.id === entry.id ? entry : item));
    this.store.set({ entries });
  }

  /* -------------------------------- lifecycle ------------------------------ */

  async uninstall(id: string): Promise<PluginRecord[]> {
    const entry = this.store.get().entries.find((item) => item.id === id);
    if (!entry) return this.list();
    this.unload(id);
    this.store.set({ entries: this.store.get().entries.filter((item) => item.id !== id) });
    try {
      await fs.rm(entry.path, { recursive: true, force: true });
    } catch (error) {
      log.warn('plugins', 'could not remove plugin files', error);
    }
    this.onChange();
    return this.list();
  }

  async toggle(id: string, enabled: boolean): Promise<PluginRecord[]> {
    const entry = this.store.get().entries.find((item) => item.id === id);
    if (!entry) return this.list();
    entry.enabled = enabled;
    if (!enabled) this.unload(id);
    else await this.load(entry);
    this.persistEntry(entry);
    this.onChange();
    return this.list();
  }

  async reload(id: string): Promise<PluginRecord[]> {
    const entry = this.store.get().entries.find((item) => item.id === id);
    if (!entry) return this.list();
    this.unload(id);
    if (entry.enabled) await this.load(entry);
    this.persistEntry(entry);
    this.onChange();
    return this.list();
  }

  async runCommand(pluginId: string, commandId: string): Promise<{ ok: boolean; output: string }> {
    const runtime = this.loaded.get(pluginId);
    const handler = runtime?.commands.get(commandId);
    if (!handler) return { ok: false, output: `Command "${commandId}" is not available` };
    try {
      const output = await handler();
      return { ok: true, output: String(output ?? '') };
    } catch (error) {
      return { ok: false, output: (error as Error).message };
    }
  }

  adapterFor(providerId: string): ProviderAdapter | null {
    const match = /^plugin:([^:]+):(.+)$/.exec(providerId);
    if (!match) return null;
    const runtime = this.loaded.get(match[1]);
    const adapter = runtime?.adapters.get(match[2]);
    if (!adapter) return null;
    const entry = this.store.get().entries.find((item) => item.id === match[1]);
    const models = entry?.manifest.contributes?.adapters?.find((item) => item.id === match[2])?.models ?? adapter.models;
    return {
      stream: (request, signal) => bridgeAdapter(adapter.stream(request, signal)),
      listModels: async () => models.map((id) => ({ id, label: id, supportsTools: true })),
      probe: async () => ({ ok: true, latencyMs: 0, message: `Plugin adapter · ${adapter.name}` }),
    };
  }

  /* --------------------------------- loading ------------------------------- */

  private unload(id: string): void {
    this.registry.removeSource(`plugin:${id}`);
    this.loaded.delete(id);
  }

  private async load(entry: PluginEntry): Promise<void> {
    this.unload(entry.id);
    const runtime: LoadedPlugin = { tools: [], commands: new Map(), adapters: new Map(), themes: [], logs: [], storage: {} };
    entry.error = undefined;

    try {
      const manifest = entry.manifest;
      runtime.themes = (manifest.contributes?.themes ?? []).map((theme) => ({
        id: `${entry.id}.${theme.id}`,
        name: theme.name,
        description: theme.description,
        pluginId: entry.id,
        design: theme.design,
        mode: theme.mode,
        surface: theme.surface,
        accent: theme.accent,
        radius: theme.radius,
        wallpaper: theme.wallpaper,
        colors: theme.colors,
      }));

      let exports: Record<string, unknown> = {};
      if (manifest.main) {
        const mainFile = path.join(entry.path, manifest.main);
        if (!fsSync.existsSync(mainFile)) throw new Error(`Entry file not found: ${manifest.main}`);
        const code = await fs.readFile(mainFile, 'utf8');
        exports = this.runModule(entry, code, runtime);
      }

      const toolExports = (exports.tools ?? {}) as Record<string, (args: Record<string, unknown>, ctx: unknown) => unknown>;
      const handlers: Record<string, (args: Record<string, unknown>) => Promise<{ ok: boolean; output: string; data?: unknown }>> = {};
      for (const contribution of manifest.contributes?.tools ?? []) {
        const handler = toolExports[contribution.handler] ?? (exports[contribution.handler] as typeof toolExports[string]);
        const name = `${entry.id}.${contribution.name}`;
        const descriptor: ToolDescriptor = {
          name,
          title: contribution.title ?? contribution.name,
          description: contribution.description,
          category: contribution.category ?? 'marketplace',
          danger: contribution.danger ?? 'medium',
          parameters: contribution.parameters,
          source: 'plugin',
          sourceId: entry.id,
        };
        runtime.tools.push(descriptor);
        handlers[name] = async (args) => {
          if (!handler) return { ok: false, output: `Tool handler "${contribution.handler}" is missing from module.exports.tools` };
          try {
            const result = await handler(args, {
              pluginId: entry.id,
              workspaceRoot: this.hooks.cwd?.() ?? '.',
              log: (message: string) => this.logLine(entry.id, message),
            });
            if (typeof result === 'string') return { ok: true, output: result };
            if (result && typeof result === 'object') {
              const shaped = result as { ok?: boolean; output?: string; data?: unknown };
              return { ok: shaped.ok !== false, output: String(shaped.output ?? JSON.stringify(shaped.data ?? result)), data: shaped.data };
            }
            return { ok: true, output: String(result ?? '') };
          } catch (error) {
            return { ok: false, output: (error as Error).message };
          }
        };
      }
      this.registry.setSource(`plugin:${entry.id}`, runtime.tools, handlers);

      const commandExports = (exports.commands ?? {}) as Record<string, () => unknown>;
      for (const command of manifest.contributes?.commands ?? []) {
        const handler = commandExports[command.id] ?? (exports[command.id] as (() => unknown) | undefined);
        if (typeof handler === 'function') {
          runtime.commands.set(command.id, async () => String((await handler()) ?? ''));
        }
      }

      const adapterExports = (exports.adapters ?? {}) as Record<string, unknown>;
      for (const adapter of manifest.contributes?.adapters ?? []) {
        const fn = adapterExports[adapter.id] as
          | ((request: unknown, signal?: AbortSignal) => AsyncGenerator<unknown>)
          | undefined;
        if (typeof fn === 'function') {
          runtime.adapters.set(adapter.id, { name: adapter.name, models: adapter.models, stream: fn });
        }
      }

      runtime.storage = await this.readStorage(entry.id);
      this.loaded.set(entry.id, { ...runtime, logs: runtime.logs });
      this.logLine(entry.id, `loaded ${entry.name}@${entry.version} · ${runtime.tools.length} tools · ${runtime.themes.length} themes`);
    } catch (error) {
      entry.error = (error as Error).message;
      runtime.logs.push(`ERROR ${(error as Error).message}`);
      this.loaded.set(entry.id, runtime);
      log.error('plugins', `failed to load ${entry.id}: ${(error as Error).message}`);
    }
  }

  private runModule(entry: PluginEntry, code: string, runtime: LoadedPlugin): Record<string, unknown> {
    const permissions = new Set(entry.permissions);
    const module = { exports: {} as Record<string, unknown> };
    const storageFile = path.join(entry.path, 'storage.json');

    const api = {
      apiVersion: 1,
      manifest: entry.manifest,
      log: (...args: unknown[]) => this.logLine(entry.id, args.map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join(' ')),
      storage: {
        get: (key: string) => runtime.storage[key],
        set: (key: string, value: unknown) => {
          runtime.storage[key] = value;
          fsSync.writeFileSync(storageFile, JSON.stringify(runtime.storage, null, 2), 'utf8');
        },
        delete: (key: string) => {
          delete runtime.storage[key];
          fsSync.writeFileSync(storageFile, JSON.stringify(runtime.storage, null, 2), 'utf8');
        },
        all: () => ({ ...runtime.storage }),
      },
      fs: permissions.has('fs')
        ? {
            readFile: async (file: string) => fs.readFile(file, 'utf8'),
            writeFile: async (file: string, content: string) => {
              await fs.mkdir(path.dirname(file), { recursive: true });
              await fs.writeFile(file, content, 'utf8');
            },
            list: async (dir: string) => fs.readdir(dir),
            exists: (file: string) => fsSync.existsSync(file),
            stat: async (file: string) => {
              const info = await fs.stat(file);
              return { isDirectory: info.isDirectory(), size: info.size, modifiedAt: info.mtime.toISOString() };
            },
          }
        : undefined,
      shell: permissions.has('shell')
        ? {
            exec: async (command: string) => {
              const isWin = process.platform === 'win32';
              const shell = isWin ? 'powershell.exe' : '/bin/bash';
              const args = isWin ? ['-NoLogo', '-NoProfile', '-Command', command] : ['-lc', command];
              const { stdout, stderr } = await execFileAsync(shell, args, { timeout: 120_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
              return { stdout, stderr };
            },
          }
        : undefined,
      net: permissions.has('net')
        ? {
            fetch: async (url: string, init?: RequestInit) => {
              const response = await fetch(url, init);
              return { status: response.status, ok: response.ok, text: await response.text() };
            },
          }
        : undefined,
      ui: permissions.has('ui')
        ? {
            toast: (title: string, message?: string) => this.hooks.toast({ title, message, kind: 'info' }),
            navigate: (surface: string, params?: Record<string, string>) => this.hooks.navigate(surface, params),
          }
        : undefined,
      mail: permissions.has('mail')
        ? {
            send: async (input: { to: string; subject: string; body: string }) => this.hooks.mailSend?.(input),
          }
        : undefined,
      agents: permissions.has('agents')
        ? {
            run: async (prompt: string, agentId?: string) => this.hooks.agentRun?.(prompt, agentId),
          }
        : undefined,
    };

    const context = vm.createContext({
      module,
      exports: module.exports,
      neuro: api,
      console: {
        log: (...args: unknown[]) => this.logLine(entry.id, args.map(String).join(' ')),
        warn: (...args: unknown[]) => this.logLine(entry.id, `warn: ${args.map(String).join(' ')}`),
        error: (...args: unknown[]) => this.logLine(entry.id, `error: ${args.map(String).join(' ')}`),
        info: (...args: unknown[]) => this.logLine(entry.id, args.map(String).join(' ')),
        debug: (...args: unknown[]) => this.logLine(entry.id, args.map(String).join(' ')),
      },
      setTimeout,
      clearTimeout,
      setInterval,
      clearInterval,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      structuredClone,
      JSON,
      Math,
      Date,
      Promise,
      fetch: undefined,
    }, { codeGeneration: { strings: false, wasm: false } });

    const wrapper = `(function (module, exports, neuro) {\n${code}\n})(module, module.exports, neuro)`;
    vm.runInContext(wrapper, context, { timeout: 5000, filename: `${entry.id}/${entry.manifest.main}` });
    return module.exports;
  }

  private async readStorage(id: string): Promise<Record<string, unknown>> {
    const entry = this.store.get().entries.find((item) => item.id === id);
    if (!entry) return {};
    try {
      const raw = await fs.readFile(path.join(entry.path, 'storage.json'), 'utf8');
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private logLine(id: string, message: string): void {
    const runtime = this.loaded.get(id);
    const line = `${new Date().toISOString().slice(11, 19)} ${truncate(message, 500)}`;
    if (runtime) runtime.logs = [...runtime.logs.slice(-199), line];
    log.debug('plugins', `[${id}] ${truncate(message, 300)}`);
  }
}

async function* bridgeAdapter(source: AsyncGenerator<unknown>): AsyncGenerator<LlmStreamEvent> {
  for await (const event of source) {
    if (event && typeof event === 'object' && 'type' in (event as Record<string, unknown>)) {
      yield event as LlmStreamEvent;
    }
  }
  yield { type: 'done' };
}
