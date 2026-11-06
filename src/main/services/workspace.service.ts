import { execFile } from 'node:child_process';
import fsp from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import type { FsEntry, FileStat, SearchHit, WorkspaceInfo } from '@shared/types';
import { Paths } from '../core/store';
import { log } from '../core/ipc';
import { ensureDir, formatBytes, isBinaryBuffer, normalizePath } from '../core/util';

const LANGUAGE_BY_EXT: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.json': 'json',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.css': 'css',
  '.scss': 'scss',
  '.html': 'html',
  '.htm': 'html',
  '.svg': 'xml',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.sql': 'sql',
  '.sh': 'shell',
  '.ps1': 'powershell',
  '.bat': 'batch',
  '.dockerfile': 'docker',
  '.ipynb': 'notebook',
  '.txt': 'text',
  '.csv': 'csv',
  '.env': 'dotenv',
  '.vue': 'vue',
  '.svelte': 'svelte',
};

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'out', 'build', '.next', '.cache', '__pycache__', '.venv', 'venv', 'release', '.turbo', 'target', '.idea', '.vscode']);
const MAX_READ_BYTES = 4 * 1024 * 1024;

export function languageFor(file: string): string {
  return LANGUAGE_BY_EXT[path.extname(file).toLowerCase()] ?? 'text';
}

export class WorkspaceService {
  private watchers = new Map<string, fs.FSWatcher>();
  private demoReady = false;

  async ensureDemoWorkspace(root?: string): Promise<string> {
    const dir = root ?? path.join(Paths.workspaces, 'Neuro Demo');
    if (this.demoReady && fs.existsSync(dir)) return dir;
    await ensureDir(dir);
    const files: Record<string, string> = {
      'README.md': `# Neuro Demo Workspace

This workspace is generated on first launch so the whole OS has something real
to read, edit, search and execute.

## What is here

| Path | Purpose |
| --- | --- |
| \`src/agent.ts\` | A tiny tool-calling agent loop you can edit live |
| \`src/tools.ts\` | Tool registry used by the sample agent |
| \`notes/roadmap.md\` | The product thinking behind Neuro OS |
| \`data/models.json\` | Provider and model presets |
| \`scripts/health.ps1\` | A real PowerShell health check |

## Try it

Open the **Terminal** and run:

\`\`\`powershell
node --version
Get-ChildItem -Recurse -Depth 2
\`\`\`

Then ask **Neuro** in chat:

> Read src/agent.ts and explain how the tool loop terminates.

Everything you change is written to disk immediately.
`,
      'src/agent.ts': `/**
 * A miniature version of the loop that powers Neuro OS.
 * Read this file, then ask the agent to extend it.
 */
import { registry, type ToolResult } from './tools';

export type Msg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string };

export interface ModelClient {
  complete(messages: Msg[], tools: unknown[]): Promise<{ text?: string; calls?: { id: string; name: string; args: unknown }[] }>;
}

export async function runAgent(client: ModelClient, system: string, prompt: string, maxSteps = 8) {
  const messages: Msg[] = [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ];

  for (let step = 0; step < maxSteps; step += 1) {
    const reply = await client.complete(messages, registry.definitions());
    if (reply.text) messages.push({ role: 'assistant', content: reply.text });
    if (!reply.calls?.length) return { messages, steps: step + 1 };

    for (const call of reply.calls) {
      let result: ToolResult;
      try {
        result = await registry.invoke(call.name, call.args);
      } catch (error) {
        result = { ok: false, output: (error as Error).message };
      }
      messages.push({ role: 'tool', content: JSON.stringify(result) });
    }
  }
  return { messages, steps: maxSteps };
}
`,
      'src/tools.ts': `export interface ToolResult {
  ok: boolean;
  output: string;
}

type Handler = (args: Record<string, unknown>) => Promise<ToolResult>;

class ToolRegistry {
  private handlers = new Map<string, { description: string; handler: Handler }>();

  register(name: string, description: string, handler: Handler) {
    this.handlers.set(name, { description, handler });
    return this;
  }

  definitions() {
    return [...this.handlers.entries()].map(([name, { description }]) => ({
      type: 'function',
      function: { name, description, parameters: { type: 'object', properties: {} } },
    }));
  }

  async invoke(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const entry = this.handlers.get(name);
    if (!entry) return { ok: false, output: \`Unknown tool: \${name}\` };
    return entry.handler(args);
  }
}

export const registry = new ToolRegistry().register('clock', 'Return the current time', async () => ({
  ok: true,
  output: new Date().toISOString(),
}));
`,
      'notes/roadmap.md': `# Neuro OS — product roadmap

## Principles
1. **Every surface is an agent.** Chat, files, notebooks, the browser and the taskbar share one tool bus.
2. **Local first.** Keys never leave the machine. Every byte of state is a readable JSON file.
3. **Composable.** Providers, tools, skills and themes are all plugins with a manifest.
4. **Fast by default.** No spinner without a reason, no animation that blocks input.

## Now
- [x] Kernel with typed IPC and atomic persistence
- [x] Multi-provider chat with streaming and tool calls
- [x] Real terminal, file explorer, code editor, browser
- [x] Anchors, taskbar, command palette

## Next
- [ ] Multi-agent rooms with hand-off
- [ ] Remote workspaces over SSH
- [ ] Skill authoring studio with live traces
- [ ] Voice surface with barge-in
`,
      'data/models.json': JSON.stringify(
        {
          providers: [
            { id: 'deepseek', models: ['deepseek-chat', 'deepseek-reasoner'], context: 131072 },
            { id: 'anthropic', models: ['claude-sonnet-4-5', 'claude-opus-4-1'], context: 200000 },
            { id: 'ollama', models: ['qwen2.5-coder:7b', 'llama3.1:8b'], context: 32768 },
          ],
          note: 'Editable preset data used by the demo agent.',
        },
        null,
        2,
      ),
      'scripts/health.ps1': `# Real PowerShell — run it from the Neuro OS terminal.
$ErrorActionPreference = 'Stop'
Write-Host "Neuro OS workspace health" -ForegroundColor Cyan
Write-Host "Node: $(node --version)"
Write-Host "npm:  $(npm --version)"
Write-Host "CPUs: $([Environment]::ProcessorCount)"
Write-Host "Free: $([math]::Round((Get-PSDrive C).Free / 1GB, 1)) GB"
Get-ChildItem -File -Recurse -Depth 1 | Select-Object -First 10 Name, Length | Format-Table
`,
      '.gitignore': `node_modules/
dist/
out/
*.log
.env
`,
    };

    for (const [rel, content] of Object.entries(files)) {
      const target = path.join(dir, rel);
      if (!fs.existsSync(target)) {
        await ensureDir(path.dirname(target));
        await fsp.writeFile(target, content, 'utf8');
      }
    }
    this.demoReady = true;
    return dir;
  }

  private resolve(input: string): string {
    return path.normalize(normalizePath(input));
  }

  async list(dir: string, showHidden = false): Promise<FsEntry[]> {
    const target = this.resolve(dir);
    const entries = await fsp.readdir(target, { withFileTypes: true });
    const out: FsEntry[] = [];
    for (const entry of entries) {
      if (!showHidden && entry.name.startsWith('.')) continue;
      if (entry.name === '$RECYCLE.BIN' || entry.name === 'System Volume Information') continue;
      const full = path.join(target, entry.name);
      let size = 0;
      let modifiedAt = new Date(0).toISOString();
      try {
        const st = await fsp.lstat(full);
        size = st.size;
        modifiedAt = st.mtime.toISOString();
      } catch {
        /* unreadable entry */
      }
      const kind = entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file';
      out.push({
        name: entry.name,
        path: full,
        kind,
        size,
        modifiedAt,
        extension: kind === 'file' ? path.extname(entry.name).replace('.', '') : undefined,
      });
    }
    return out.sort((a, b) => {
      const dirRank = (e: FsEntry) => (e.kind === 'directory' ? 0 : 1);
      if (dirRank(a) !== dirRank(b)) return dirRank(a) - dirRank(b);
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  async stat(file: string): Promise<FileStat> {
    const target = this.resolve(file);
    const st = await fsp.stat(target);
    let binary = false;
    let lines = 0;
    if (st.isFile()) {
      const handle = await fsp.open(target, 'r');
      try {
        const buf = Buffer.alloc(Math.min(4096, st.size));
        await handle.read(buf, 0, buf.length, 0);
        binary = isBinaryBuffer(buf);
      } finally {
        await handle.close();
      }
      if (!binary) {
        const content = await fsp.readFile(target, 'utf8');
        lines = content.length === 0 ? 0 : content.split('\n').length;
      }
    }
    return {
      path: target,
      size: st.size,
      createdAt: st.birthtime.toISOString(),
      modifiedAt: st.mtime.toISOString(),
      isDirectory: st.isDirectory(),
      binary,
      language: languageFor(target),
      lines,
    };
  }

  async read(file: string): Promise<{ content: string; stat: FileStat }> {
    const target = this.resolve(file);
    const stat = await this.stat(target);
    if (stat.size > MAX_READ_BYTES) throw new Error(`File is ${formatBytes(stat.size)} — too large to open in the editor (> 4 MB).`);
    if (stat.binary) throw new Error('Binary file — open it with a dedicated viewer or from the terminal.');
    const content = await fsp.readFile(target, 'utf8');
    return { content, stat };
  }

  async write(file: string, content: string): Promise<FileStat> {
    const target = this.resolve(file);
    await ensureDir(path.dirname(target));
    await fsp.writeFile(target, content, 'utf8');
    return this.stat(target);
  }

  async mkdir(dir: string): Promise<void> {
    await ensureDir(this.resolve(dir));
  }

  async rename(from: string, to: string): Promise<void> {
    await ensureDir(path.dirname(this.resolve(to)));
    await fsp.rename(this.resolve(from), this.resolve(to));
  }

  async remove(paths: string[]): Promise<number> {
    let deleted = 0;
    for (const p of paths) {
      await fsp.rm(this.resolve(p), { recursive: true, force: true });
      deleted += 1;
    }
    return deleted;
  }

  async search(root: string, query: string, maxResults = 200): Promise<SearchHit[]> {
    const results: SearchHit[] = [];
    if (!query.trim()) return results;
    const needle = query.toLowerCase();
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (results.length >= maxResults || depth > 10) return;
      let entries: fs.Dirent[];
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full, depth + 1);
          continue;
        }
        if (!entry.isFile()) continue;
        if (!/\.(ts|tsx|js|jsx|json|md|py|css|html|txt|yml|yaml|ps1|sh|rs|go|java|c|cpp|cs|rb|php|sql|toml)$/i.test(entry.name)) continue;
        let content: string;
        try {
          const st = await fsp.stat(full);
          if (st.size > 1_500_000) continue;
          content = await fsp.readFile(full, 'utf8');
        } catch {
          continue;
        }
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i += 1) {
          const idx = lines[i].toLowerCase().indexOf(needle);
          if (idx >= 0) {
            results.push({
              path: full,
              line: i + 1,
              column: idx + 1,
              preview: lines[i].slice(Math.max(0, idx - 60), idx + 140).trim(),
              matchLength: query.length,
            });
            if (results.length >= maxResults) return;
          }
        }
      }
    };
    await walk(this.resolve(root), 0);
    return results;
  }

  async info(root: string): Promise<WorkspaceInfo> {
    const target = this.resolve(root);
    let fileCount = 0;
    let totalBytes = 0;
    const languages = new Map<string, number>();
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (depth > 8 || fileCount > 20000) return;
      let entries: fs.Dirent[];
      try {
        entries = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full, depth + 1);
        } else if (entry.isFile()) {
          fileCount += 1;
          try {
            totalBytes += (await fsp.stat(full)).size;
          } catch {
            /* ignore */
          }
          const lang = languageFor(entry.name);
          if (lang !== 'text') languages.set(lang, (languages.get(lang) ?? 0) + 1);
        }
      }
    };
    await walk(target, 0);
    return {
      root: target,
      name: path.basename(target) || target,
      fileCount,
      totalBytes,
      languages: [...languages.entries()].map(([id, files]) => ({ id, files })).sort((a, b) => b.files - a.files),
      git: await this.gitInfo(target),
    };
  }

  private gitInfo(cwd: string): Promise<WorkspaceInfo['git']> {
    return new Promise((resolve) => {
      execFile('git', ['-C', cwd, 'status', '--porcelain=v1', '-b'], { timeout: 2500, windowsHide: true }, (error, stdout) => {
        if (error || !stdout) return resolve(null);
        const lines = stdout.trim().split('\n');
        const header = lines[0] ?? '';
        const branch = header.replace(/^##\s*/, '').split('...')[0].trim() || 'detached';
        const ahead = /ahead (\d+)/.exec(header)?.[1];
        const behind = /behind (\d+)/.exec(header)?.[1];
        resolve({
          branch,
          dirty: Math.max(0, lines.length - 1),
          ahead: ahead ? Number(ahead) : 0,
          behind: behind ? Number(behind) : 0,
        });
      });
    });
  }

  watch(root: string | null, notify: (payload: { root: string; path: string; kind: string }) => void): void {
    for (const watcher of this.watchers.values()) watcher.close();
    this.watchers.clear();
    if (!root || !fs.existsSync(root)) return;
    try {
      let timer: NodeJS.Timeout | null = null;
      const watcher = fs.watch(root, { recursive: true }, (kind, filename) => {
        if (!filename) return;
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          notify({ root, path: path.join(root, String(filename)), kind: String(kind) });
        }, 240);
      });
      watcher.on('error', (err) => log.warn('workspace', 'watcher error', err));
      this.watchers.set(root, watcher);
    } catch (error) {
      log.warn('workspace', 'watch unsupported', error);
    }
  }

  dispose(): void {
    for (const watcher of this.watchers.values()) watcher.close();
    this.watchers.clear();
  }
}
