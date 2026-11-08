const fs = require('fs');
const p = 'src/main/services/plugins.service.ts';
let c = fs.readFileSync(p, 'utf8');

// imports
c = c.replace(
  "import { execFile } from 'node:child_process';",
  "import { execFile, spawn, type ChildProcess } from 'node:child_process';",
);
c = c.replace("import vm from 'node:vm';\n", '');
c = c.replace("import { JsonStore, Paths } from '../core/store';", "import { app } from 'electron';\nimport { JsonStore, Paths } from '../core/store';");

// host bookkeeping on the class
c = c.replace(
  "  private loaded = new Map<string, LoadedPlugin>();",
  `  private loaded = new Map<string, LoadedPlugin>();
  private hosts = new Map<string, { proc: ChildProcess; pending: Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>; nextId: number }>();`,
);

// unload kills the host process
c = c.replace(
  `  private unload(id: string): void {
    this.registry.removeSource(\`plugin:\${id}\`);
    this.loaded.delete(id);
  }`,
  `  private unload(id: string): void {
    this.registry.removeSource(\`plugin:\${id}\`);
    const host = this.hosts.get(id);
    if (host) {
      try {
        host.proc.send({ type: 'shutdown' });
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        try {
          host.proc.kill();
        } catch {
          /* ignore */
        }
      }, 500).unref?.();
      this.hosts.delete(id);
    }
    this.loaded.delete(id);
  }`,
);

// replace the whole load + runModule section with a process-isolated loader
const start = c.indexOf('  private async load(entry: PluginEntry): Promise<void> {');
const end = c.indexOf('  private async readStorage(id: string): Promise<Record<string, unknown>> {');
if (start < 0 || end < 0) throw new Error('plugin section markers not found');

const replacement = `  private async load(entry: PluginEntry): Promise<void> {
    this.unload(entry.id);
    const runtime: LoadedPlugin = { tools: [], commands: new Map(), adapters: new Map(), themes: [], logs: [], storage: {} };
    entry.error = undefined;

    try {
      const manifest = entry.manifest;
      runtime.themes = (manifest.contributes?.themes ?? []).map((theme) => ({
        id: \`\${entry.id}.\${theme.id}\`,
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

      let available: { tools: string[]; commands: string[] } = { tools: [], commands: [] };
      if (manifest.main) {
        runtime.storage = await this.readStorage(entry.id);
        available = await this.startHost(entry, runtime);
      }

      const handlers: Record<string, (args: Record<string, unknown>) => Promise<{ ok: boolean; output: string; data?: unknown }>> = {};
      for (const contribution of manifest.contributes?.tools ?? []) {
        const name = \`\${entry.id}.\${contribution.name}\`;
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
          try {
            const result = await this.callHost(entry.id, 'invoke', {
              handler: contribution.handler,
              args,
              ctx: {
                pluginId: entry.id,
                workspaceRoot: this.hooks.cwd?.() ?? '.',
                log: (message: string) => this.logLine(entry.id, message),
              },
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
        void available;
      }
      this.registry.setSource(\`plugin:\${entry.id}\`, runtime.tools, handlers);

      for (const command of manifest.contributes?.commands ?? []) {
        if (!available.commands.includes(command.id)) continue;
        runtime.commands.set(command.id, async () => String((await this.callHost(entry.id, 'command', { command: command.id })) ?? ''));
      }

      if ((manifest.contributes?.adapters ?? []).length) {
        this.logLine(entry.id, 'adapters are disabled in the sandboxed plugin host');
      }

      runtime.storage = await this.readStorage(entry.id);
      this.loaded.set(entry.id, { ...runtime, logs: runtime.logs });
      this.logLine(entry.id, \`loaded \${entry.name}@\${entry.version} · \${runtime.tools.length} tools · \${runtime.themes.length} themes (isolated)\`);
    } catch (error) {
      entry.error = (error as Error).message;
      runtime.logs.push(\`ERROR \${(error as Error).message}\`);
      this.loaded.set(entry.id, runtime);
      log.error('plugins', \`failed to load \${entry.id}: \${(error as Error).message}\`);
    }
  }

  private async startHost(entry: PluginEntry, runtime: LoadedPlugin): Promise<{ tools: string[]; commands: string[] }> {
    const hostSource = path.join(app.getAppPath(), 'resources', 'plugin-host.cjs');
    const hostFile = path.join(Paths.cache, 'plugin-host.cjs');
    await fs.mkdir(Paths.cache, { recursive: true });
    await fs.copyFile(hostSource, hostFile);

    const proc = spawn(
      process.execPath,
      [
        '--experimental-permission',
        \`--allow-fs-read=\${entry.path}\`,
        \`--allow-fs-read=\${entry.path}\${path.sep}*\`,
        \`--allow-fs-read=\${hostFile}\`,
        hostFile,
      ],
      {
        env: {
          ELECTRON_RUN_AS_NODE: '1',
          PATH: process.env.PATH ?? '',
          SystemRoot: process.env.SystemRoot ?? '',
          TEMP: process.env.TEMP ?? '',
          TMP: process.env.TMP ?? '',
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        windowsHide: true,
      },
    );

    const state = { proc, pending: new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>(), nextId: 1 };
    this.hosts.set(entry.id, state);

    proc.stderr?.setEncoding('utf8');
    proc.stderr?.on('data', (chunk: string) => {
      for (const line of chunk.split('\\n').filter(Boolean)) {
        if (line.includes('ExperimentalWarning')) continue;
        this.logLine(entry.id, line.slice(0, 400));
      }
    });
    proc.on('exit', (code) => {
      if (this.hosts.get(entry.id) === state) {
        this.hosts.delete(entry.id);
        this.logLine(entry.id, \`host exited (\${code ?? 'null'})\`);
      }
    });

    const ready = new Promise<{ tools: string[]; commands: string[] }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('plugin host did not start in time')), 15_000);
      const onMessage = (message: any): void => {
        if (!message || typeof message !== 'object') return;
        if (message.type === 'ready') {
          clearTimeout(timer);
          proc.off('message', onMessage);
          resolve({ tools: message.tools ?? [], commands: message.commands ?? [] });
          return;
        }
        if (message.type === 'initError') {
          clearTimeout(timer);
          proc.off('message', onMessage);
          reject(new Error(String(message.error).slice(0, 800)));
          return;
        }
        void this.onHostMessage(entry, state, message);
      };
      proc.on('message', onMessage);
      proc.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });

    proc.send({
      type: 'init',
      manifest: entry.manifest,
      permissions: entry.permissions,
      storage: runtime.storage,
      cwd: entry.path,
      mainPath: path.join(entry.path, entry.manifest.main ?? 'main.js'),
    });

    return ready;
  }

  private async onHostMessage(
    entry: PluginEntry,
    state: { proc: ChildProcess; pending: Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }> },
    message: any,
  ): Promise<void> {
    if (message.type === 'result') {
      const pending = state.pending.get(message.id);
      if (!pending) return;
      state.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.ok) pending.resolve(message.value);
      else pending.reject(new Error(String(message.error ?? 'plugin call failed')));
      return;
    }
    if (message.type === 'log') {
      this.logLine(entry.id, String(message.message ?? ''));
      return;
    }
    if (message.type === 'api') {
      try {
        const value = await this.handleHostApi(entry, message.method, message.args);
        state.proc.send({ type: 'apiResult', id: message.id, ok: true, value });
      } catch (error) {
        state.proc.send({ type: 'apiResult', id: message.id, ok: false, error: (error as Error).message });
      }
    }
  }

  private callHost(pluginId: string, type: 'invoke' | 'command', payload: Record<string, unknown>): Promise<any> {
    const state = this.hosts.get(pluginId);
    if (!state) return Promise.reject(new Error('plugin host is not running'));
    const id = state.nextId;
    state.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        state.pending.delete(id);
        reject(new Error('plugin call timed out after 120s'));
      }, 120_000);
      state.pending.set(id, { resolve, reject, timer });
      state.proc.send({ type, id, ...payload });
    });
  }

  private async handleHostApi(entry: PluginEntry, method: string, args: any): Promise<any> {
    const permissions = new Set(entry.permissions);
    const need = (permission: PluginPermission): void => {
      if (!permissions.has(permission)) throw new Error(\`plugin lacks the "\${permission}" permission\`);
    };
    const storageFile = path.join(entry.path, 'storage.json');
    const persist = (): void => {
      const loaded = this.loaded.get(entry.id);
      const storage = loaded?.storage ?? {};
      fsSync.writeFileSync(storageFile, JSON.stringify(storage, null, 2), 'utf8');
    };

    switch (method) {
      case 'log':
        this.logLine(entry.id, (Array.isArray(args) ? args : [args]).map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join(' '));
        return null;
      case 'storage.set': {
        need('fs');
        const loaded = this.loaded.get(entry.id);
        if (loaded) loaded.storage[args[0]] = args[1];
        persist();
        return null;
      }
      case 'storage.delete': {
        need('fs');
        const loaded = this.loaded.get(entry.id);
        if (loaded) delete loaded.storage[args];
        persist();
        return null;
      }
      case 'fs.readFile':
        need('fs');
        return fs.readFile(String(args), 'utf8');
      case 'fs.writeFile':
        need('fs');
        await fs.mkdir(path.dirname(String(args[0])), { recursive: true });
        await fs.writeFile(String(args[0]), String(args[1]), 'utf8');
        return null;
      case 'fs.list':
        need('fs');
        return fs.readdir(String(args));
      case 'fs.exists':
        need('fs');
        return fsSync.existsSync(String(args));
      case 'fs.stat': {
        need('fs');
        const info = await fs.stat(String(args));
        return { isDirectory: info.isDirectory(), size: info.size, modifiedAt: info.mtime.toISOString() };
      }
      case 'shell.exec': {
        need('shell');
        const isWin = process.platform === 'win32';
        const shell = isWin ? 'powershell.exe' : '/bin/bash';
        const shellArgs = isWin ? ['-NoLogo', '-NoProfile', '-Command', String(args)] : ['-lc', String(args)];
        const { stdout, stderr } = await execFileAsync(shell, shellArgs, { timeout: 120_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
        return { stdout, stderr };
      }
      case 'net.fetch': {
        need('net');
        const response = await fetch(String(args[0]), args[1]);
        return { status: response.status, ok: response.ok, text: await response.text() };
      }
      case 'ui.toast':
        need('ui');
        this.hooks.toast({ title: String(args[0]), message: args[1] ? String(args[1]) : undefined, kind: 'info' });
        return null;
      case 'ui.navigate':
        need('ui');
        this.hooks.navigate(String(args[0]), args[1]);
        return null;
      case 'mail.send':
        need('mail');
        return this.hooks.mailSend?.(args);
      case 'agents.run':
        need('agents');
        return this.hooks.agentRun?.(String(args[0]), args[1]);
      default:
        throw new Error(\`unsupported plugin api: \${method}\`);
    }
  }

`;

c = c.slice(0, start) + replacement + c.slice(end);
fs.writeFileSync(p, c, 'utf8');
console.log('plugin service refactored');
