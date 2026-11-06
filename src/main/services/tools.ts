import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AnchorPin, ToolDef, ToolDescriptor, ToolInvocation, ToastPayload } from '@shared/types';
import type { ContentService } from './content.service';
import type { SettingsService } from './settings.service';
import type { SystemService } from './system.service';
import type { TerminalService } from './terminal.service';
import type { WorkspaceService } from './workspace.service';
import { log } from '../core/ipc';
import { newId, nowIso, truncate } from '../core/util';
import { httpFetch, readPage, webSearch } from './net';

export interface ToolRuntime {
  settings: SettingsService;
  workspace: WorkspaceService;
  system: SystemService;
  terminal: TerminalService;
  content: ContentService;
  cwd: () => string;
  searchMarketplace: (query: string) => Promise<{ id: string; name: string; tagline: string; kind: string }[]>;
  installMarketplace: (id: string) => Promise<string>;
  listSkills: () => Promise<{ id: string; name: string; description: string }[]>;
  readSkill: (id: string) => Promise<string>;
  ui: {
    navigate: (surface: string, params?: Record<string, string>) => void;
    toast: (toast: ToastPayload) => void;
    pin: (pin: Omit<AnchorPin, 'id' | 'order'>) => void;
  };
  sessionId?: string;
}

interface ToolResult {
  ok: boolean;
  output: string;
  data?: unknown;
}

type Handler = (args: Record<string, any>, rt: ToolRuntime) => Promise<ToolResult>;

interface RegisteredTool {
  def: ToolDef;
  handler: Handler;
}

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra });
const num = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'number', description, ...extra });
const bool = (description: string) => ({ type: 'boolean', description });
const strArray = (description: string) => ({ type: 'array', description, items: { type: 'string' } });

function define(
  name: string,
  title: string,
  description: string,
  category: ToolDef['category'],
  danger: ToolDef['danger'],
  parameters: Record<string, unknown>,
  handler: Handler,
): RegisteredTool {
  return { def: { name, title, description, category, danger, parameters }, handler };
}

/* ------------------------------------------------------------------ */
/* The catalog                                                         */
/* ------------------------------------------------------------------ */

const TOOLS: RegisteredTool[] = [
  define(
    'fs.list',
    'List directory',
    'List the entries of a directory on this machine. Returns name, kind, size and modification time. Use before reading files to understand structure.',
    'filesystem',
    'low',
    obj({ path: str('Absolute directory path. Omit to list the active workspace root.'), showHidden: bool('Include dotfiles. Default false.') }),
    async (args, rt) => {
      const target = args.path || rt.cwd();
      const entries = await rt.workspace.list(target, Boolean(args.showHidden));
      return {
        ok: true,
        output: entries.map((e) => `${e.kind === 'directory' ? 'DIR ' : 'FILE'} ${e.name}${e.kind === 'file' ? ` (${e.size}b)` : ''}`).join('\n') || '(empty directory)',
        data: { path: target, entries },
      };
    },
  ),
  define(
    'fs.read',
    'Read file',
    'Read a UTF-8 text file. Optionally slice by line range for large files. Never guess file contents — always read first.',
    'filesystem',
    'low',
    obj({ path: str('Absolute file path.'), startLine: num('1-based first line (optional).'), endLine: num('1-based last line, inclusive (optional).') }, ['path']),
    async (args, rt) => {
      const { content, stat } = await rt.workspace.read(String(args.path));
      if (args.startLine || args.endLine) {
        const lines = content.split('\n');
        const start = Math.max(1, Number(args.startLine ?? 1));
        const end = Math.min(lines.length, Number(args.endLine ?? lines.length));
        const slice = lines.slice(start - 1, end).map((line, i) => `${String(start + i).padStart(5)}│ ${line}`).join('\n');
        return { ok: true, output: slice, data: { path: stat.path, lines: stat.lines, range: [start, end] } };
      }
      return { ok: true, output: truncate(content, 40_000), data: { path: stat.path, size: stat.size, lines: stat.lines, language: stat.language } };
    },
  ),
  define(
    'fs.write',
    'Write file',
    'Create or overwrite a text file. Parent directories are created automatically. Prefer fs.edit for small changes to existing files.',
    'filesystem',
    'medium',
    obj({ path: str('Absolute file path.'), content: str('Full file content.') }, ['path', 'content']),
    async (args, rt) => {
      const stat = await rt.workspace.write(String(args.path), String(args.content ?? ''));
      return { ok: true, output: `Wrote ${stat.size} bytes to ${stat.path}`, data: stat };
    },
  ),
  define(
    'fs.edit',
    'Edit file',
    'Replace an exact snippet inside a file. Fails if the snippet is missing or ambiguous, which keeps edits safe.',
    'filesystem',
    'medium',
    obj(
      {
        path: str('Absolute file path.'),
        find: str('Exact text to find (include enough context to be unique).'),
        replace: str('Replacement text.'),
        replaceAll: bool('Replace every occurrence. Default false.'),
      },
      ['path', 'find', 'replace'],
    ),
    async (args, rt) => {
      const { content } = await rt.workspace.read(String(args.path));
      const find = String(args.find);
      const count = content.split(find).length - 1;
      if (count === 0) throw new Error('Snippet not found — read the file and retry with exact text.');
      if (count > 1 && !args.replaceAll) throw new Error(`Snippet appears ${count} times. Add surrounding context or set replaceAll.`);
      const next = args.replaceAll ? content.split(find).join(String(args.replace)) : content.replace(find, String(args.replace));
      const stat = await rt.workspace.write(String(args.path), next);
      return { ok: true, output: `Replaced ${args.replaceAll ? count : 1} occurrence(s) in ${stat.path}`, data: { path: stat.path, replacements: args.replaceAll ? count : 1 } };
    },
  ),
  define(
    'fs.mkdir',
    'Create directory',
    'Create a directory (recursively). Safe to call when it already exists.',
    'filesystem',
    'low',
    obj({ path: str('Absolute directory path.') }, ['path']),
    async (args, rt) => {
      await rt.workspace.mkdir(String(args.path));
      return { ok: true, output: `Directory ready: ${args.path}` };
    },
  ),
  define(
    'fs.rename',
    'Rename or move',
    'Rename or move a file or directory. Creates the destination parent folder when needed.',
    'filesystem',
    'medium',
    obj({ from: str('Source path.'), to: str('Destination path.') }, ['from', 'to']),
    async (args, rt) => {
      await rt.workspace.rename(String(args.from), String(args.to));
      return { ok: true, output: `Moved ${args.from} → ${args.to}` };
    },
  ),
  define(
    'fs.delete',
    'Delete paths',
    'Permanently delete files or directories. Destructive and irreversible — confirm the exact paths first.',
    'filesystem',
    'high',
    obj({ paths: strArray('Paths to delete.') }, ['paths']),
    async (args, rt) => {
      const list = (args.paths as string[]) ?? [];
      if (!list.length) throw new Error('No paths supplied');
      const deleted = await rt.workspace.remove(list);
      return { ok: true, output: `Deleted ${deleted} path(s)`, data: { deleted } };
    },
  ),
  define(
    'fs.search',
    'Search file contents',
    'Search file contents recursively with a plain-text query. Returns file, line and a preview. Skips node_modules and build output.',
    'filesystem',
    'low',
    obj({ query: str('Text to search for.'), root: str('Root directory. Defaults to the workspace root.'), maxResults: num('Max hits (default 120).') }, ['query']),
    async (args, rt) => {
      const hits = await rt.workspace.search(String(args.root || rt.cwd()), String(args.query), Number(args.maxResults ?? 120));
      return {
        ok: true,
        output: hits.length
          ? hits.map((h) => `${h.path}:${h.line}:${h.column}  ${h.preview}`).join('\n')
          : 'No matches.',
        data: hits,
      };
    },
  ),
  define(
    'workspace.info',
    'Workspace summary',
    'Summarize the active workspace: file count, total size, language breakdown and git status.',
    'filesystem',
    'low',
    obj({ root: str('Directory to summarize. Defaults to the workspace root.') }),
    async (args, rt) => {
      const info = await rt.workspace.info(String(args.root || rt.cwd()));
      return {
        ok: true,
        output: [
          `Workspace: ${info.name} (${info.root})`,
          `Files: ${info.fileCount} · ${(info.totalBytes / 1024 / 1024).toFixed(1)} MB`,
          `Languages: ${info.languages.slice(0, 8).map((l) => `${l.id}(${l.files})`).join(', ') || '—'}`,
          info.git ? `Git: ${info.git.branch} · ${info.git.dirty} changed · +${info.git.ahead}/-${info.git.behind}` : 'Git: not a repository',
        ].join('\n'),
        data: info,
      };
    },
  ),
  define(
    'git.status',
    'Git status',
    'Show branch, working-tree changes and the latest commit for a repository.',
    'shell',
    'low',
    obj({ cwd: str('Repository directory. Defaults to the workspace root.') }),
    async (args, rt) => {
      const cwd = String(args.cwd || rt.cwd());
      const run = (cmd: string) =>
        new Promise<string>((resolve) => {
          const child = spawn('git', ['-C', cwd, ...cmd.split(' ')], { windowsHide: true });
          let out = '';
          child.stdout.on('data', (d) => (out += d.toString()));
          child.stderr.on('data', (d) => (out += d.toString()));
          child.on('close', () => resolve(out.trim()));
          child.on('error', () => resolve(''));
        });
      const [status, logLine] = await Promise.all([run('status --porcelain=v1 -b'), run('log -1 --pretty=format:%h %s (%an, %ar)')]);
      if (!status) return { ok: false, output: 'Not a git repository (or git is not installed).' };
      return { ok: true, output: `${status}\n\nLatest: ${logLine}` };
    },
  ),
  define(
    'shell.exec',
    'Run shell command',
    'Execute a real command on this machine through PowerShell and capture stdout, stderr and the exit code. Use for builds, tests, git and system inspection.',
    'shell',
    'high',
    obj(
      {
        command: str('Command line to execute.'),
        cwd: str('Working directory. Defaults to the workspace root.'),
        timeoutMs: num('Timeout in milliseconds (default 120000, max 600000).'),
      },
      ['command'],
    ),
    async (args, rt) => {
      const cwd = String(args.cwd || rt.cwd());
      const timeout = Math.min(600_000, Number(args.timeoutMs ?? 120_000));
      const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
        const isWin = process.platform === 'win32';
        const shell = isWin ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
        const shellArgs = isWin ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', String(args.command)] : ['-lc', String(args.command)];
        const child = spawn(shell, shellArgs, { cwd, windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined as unknown as string } });
        let stdout = '';
        let stderr = '';
        const cap = (buf: string) => (buf.length > 80_000 ? buf.slice(-80_000) : buf);
        child.stdout.on('data', (d: Buffer) => (stdout = cap(stdout + d.toString('utf8'))));
        child.stderr.on('data', (d: Buffer) => (stderr = cap(stderr + d.toString('utf8'))));
        const timer = setTimeout(() => {
          child.kill();
          stderr += '\n[timeout]';
        }, timeout);
        child.on('error', (error) => {
          clearTimeout(timer);
          resolve({ code: -1, stdout, stderr: stderr + error.message });
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({ code, stdout, stderr });
        });
      });
      const parts = [result.stdout.trim(), result.stderr.trim() ? `[stderr]\n${result.stderr.trim()}` : ''].filter(Boolean);
      return {
        ok: result.code === 0,
        output: `exit ${result.code}\n${truncate(parts.join('\n\n') || '(no output)', 30_000)}`,
        data: result,
      };
    },
  ),
  define(
    'shell.session',
    'Run in terminal',
    'Run a command inside a persistent terminal session and return its screen output. Use when the user should see the command running.',
    'shell',
    'high',
    obj({ command: str('Command to run.'), cwd: str('Working directory (optional).') }, ['command']),
    async (args, rt) => {
      const info = rt.terminal.create({ cwd: String(args.cwd || rt.cwd()), title: 'agent' });
      await new Promise((r) => setTimeout(r, 900));
      rt.terminal.write(info.id, `${args.command}\r`);
      let previous = '';
      let stable = 0;
      for (let i = 0; i < 60; i += 1) {
        await new Promise((r) => setTimeout(r, 400));
        const current = rt.terminal.buffer(info.id);
        if (current === previous) stable += 1;
        else {
          stable = 0;
          previous = current;
        }
        if (stable >= 3) break;
      }
      const output = rt.terminal.buffer(info.id).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
      return { ok: true, output: truncate(output, 20_000), data: { terminalId: info.id } };
    },
  ),
  define(
    'http.fetch',
    'HTTP request',
    'Perform an HTTP request and return status, headers and a text body. HTML is reduced to readable text.',
    'network',
    'medium',
    obj({
      url: str('Absolute URL.'),
      method: str('HTTP method (default GET).'),
      headers: { type: 'object', description: 'Request headers.', additionalProperties: { type: 'string' } },
      body: str('Request body for POST/PUT.'),
    }, ['url']),
    async (args) => {
      const res = await httpFetch({
        url: String(args.url),
        method: args.method ? String(args.method) : 'GET',
        headers: (args.headers as Record<string, string>) ?? undefined,
        body: args.body ? String(args.body) : undefined,
      });
      return { ok: res.status < 400, output: `HTTP ${res.status} · ${res.contentType}\n\n${res.body}`, data: res };
    },
  ),
  define(
    'web.search',
    'Web search',
    'Search the public web and return ranked title/url/snippet results. Use before guessing at current facts.',
    'network',
    'low',
    obj({ query: str('Search query.') }, ['query']),
    async (args) => {
      const results = await webSearch(String(args.query), 8);
      return {
        ok: true,
        output: results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join('\n\n') || 'No results.',
        data: results,
      };
    },
  ),
  define(
    'browser.open',
    'Open in browser',
    'Open a URL in the Neuro OS browser surface so the user can see it. Does not return page content — use browser.read for that.',
    'ui',
    'low',
    obj({ url: str('URL to open.'), newTab: bool('Open in a new tab (default true).') }, ['url']),
    async (args, rt) => {
      rt.ui.navigate('browser', { url: String(args.url) });
      return { ok: true, output: `Opened ${args.url} in the browser surface.` };
    },
  ),
  define(
    'browser.read',
    'Read web page',
    'Fetch a web page and return its readable text plus title. Ideal for research and verification.',
    'network',
    'low',
    obj({ url: str('URL to read.'), maxChars: num('Max characters to return (default 18000).') }, ['url']),
    async (args) => {
      const page = await readPage(String(args.url), Number(args.maxChars ?? 18_000));
      return { ok: page.status < 400, output: `# ${page.title}\n${page.url}\n\n${page.text}`, data: { title: page.title, url: page.url, status: page.status } };
    },
  ),
  define(
    'ui.navigate',
    'Navigate interface',
    'Switch the user interface to another surface (desktop, chat, workspace, space, notebook, browser, terminal, marketplace, settings) with optional parameters.',
    'ui',
    'low',
    obj({ surface: str('One of: desktop, chat, workspace, space, notebook, browser, terminal, marketplace, settings.'), params: { type: 'object', description: 'Surface parameters, e.g. {"url": "..."} or {"path": "..."}.' } }, ['surface']),
    async (args, rt) => {
      rt.ui.navigate(String(args.surface), (args.params as Record<string, string>) ?? {});
      return { ok: true, output: `Navigated to ${args.surface}` };
    },
  ),
  define(
    'ui.toast',
    'Show notification toast',
    'Surface a short in-app toast to the user.',
    'ui',
    'low',
    obj({ title: str('Toast title.'), message: str('Optional body.'), kind: str('info | success | warning | error') }, ['title']),
    async (args, rt) => {
      rt.ui.toast({ title: String(args.title), message: args.message ? String(args.message) : undefined, kind: (args.kind as ToastPayload['kind']) ?? 'info' });
      return { ok: true, output: 'Toast shown.' };
    },
  ),
  define(
    'ui.pin',
    'Pin to Anchor',
    'Pin an entity (chat, note, file, space, notebook, link, terminal, widget) to the Anchor rail so it stays one click away.',
    'ui',
    'low',
    obj({ kind: str('chat | note | file | space | notebook | link | terminal | widget'), ref: str('Entity id or path/url.'), label: str('Display label.') }, ['kind', 'ref', 'label']),
    async (args, rt) => {
      rt.ui.pin({ kind: args.kind as AnchorPin['kind'], ref: String(args.ref), label: String(args.label), subtitle: args.subtitle ? String(args.subtitle) : undefined });
      return { ok: true, output: `Pinned ${args.label} to the Anchor.` };
    },
  ),
  define(
    'desktop.launch',
    'Launch application',
    'Launch an application or open a URL with the operating system default handler.',
    'system',
    'high',
    obj({ command: str('Executable name or URL.'), args: strArray('Arguments (optional).') }, ['command']),
    async (args, rt) => {
      const app = rt.system.launchApp(String(args.command), (args.args as string[]) ?? []);
      return { ok: true, output: `Launched ${app.name}${app.pid ? ` (pid ${app.pid})` : ''}`, data: app };
    },
  ),
  define(
    'system.info',
    'System information',
    'Report OS, CPU, memory, GPU and runtime versions for this machine.',
    'system',
    'low',
    obj({}),
    async (_args, rt) => {
      const info = await rt.system.info();
      return {
        ok: true,
        output: [
          `${info.name} ${info.version} · ${info.platform}/${info.arch}`,
          `Electron ${info.electron} · Chromium ${info.chrome} · Node ${info.node}`,
          `CPU ${info.cpus} cores · RAM ${(info.memoryTotal / 1024 ** 3).toFixed(1)} GB · GPU ${info.gpu}`,
          `Shell ${info.shell} · native PTY ${info.ptyAvailable ? 'available' : 'unavailable'}`,
        ].join('\n'),
        data: info,
      };
    },
  ),
  define(
    'system.stats',
    'Live system stats',
    'Return current CPU load, memory usage, uptime and process count.',
    'system',
    'low',
    obj({}),
    async (_args, rt) => {
      const stats = rt.system.stats();
      return {
        ok: true,
        output: `CPU ${stats.cpu}% · RAM ${(stats.memoryUsed / 1024 ** 3).toFixed(1)}/${(stats.memoryTotal / 1024 ** 3).toFixed(1)} GB · ${Math.floor(stats.uptime / 3600)}h uptime · ${stats.processes} processes`,
        data: stats,
      };
    },
  ),
  define(
    'system.screenshot',
    'Capture screen',
    'Capture the entire desktop as a PNG and return its path (and a data URL rendered in chat).',
    'system',
    'medium',
    obj({}),
    async (_args, rt) => {
      const shot = await rt.system.screenshot();
      return { ok: true, output: `Screenshot saved to ${shot.path}`, data: shot };
    },
  ),
  define(
    'system.windows',
    'List open windows',
    'List visible application windows with their process ids.',
    'system',
    'low',
    obj({}),
    async (_args, rt) => {
      const windows = await rt.system.windows();
      return { ok: true, output: windows.map((w) => `${w.processName} (${w.processId}): ${w.title}`).join('\n') || 'No visible windows.', data: windows };
    },
  ),
  define(
    'system.focusWindow',
    'Focus window',
    'Bring an application window to the foreground by (partial) title.',
    'system',
    'medium',
    obj({ title: str('Window title or fragment.') }, ['title']),
    async (args, rt) => {
      const ok = await rt.system.focusWindow(String(args.title));
      return { ok, output: ok ? `Focused a window matching "${args.title}"` : 'No matching window found.' };
    },
  ),
  define(
    'system.clipboard.read',
    'Read clipboard',
    'Read the current text contents of the system clipboard.',
    'system',
    'low',
    obj({}),
    async (_args, rt) => ({ ok: true, output: rt.system.clipboardRead() || '(clipboard is empty)' }),
  ),
  define(
    'system.clipboard.write',
    'Write clipboard',
    'Write text to the system clipboard.',
    'system',
    'medium',
    obj({ text: str('Text to copy.') }, ['text']),
    async (args, rt) => {
      rt.system.clipboardWrite(String(args.text ?? ''));
      return { ok: true, output: `Copied ${String(args.text ?? '').length} characters.` };
    },
  ),
  define(
    'system.notify',
    'Desktop notification',
    'Send a native operating-system notification.',
    'system',
    'low',
    obj({ title: str('Title.'), body: str('Body text.') }, ['title', 'body']),
    async (args, rt) => {
      rt.system.notify(String(args.title), String(args.body));
      return { ok: true, output: 'Notification sent.' };
    },
  ),
  define(
    'notes.create',
    'Create note',
    'Create a note in Neuro OS. Notes appear in Spaces and can be pinned to the Anchor.',
    'knowledge',
    'low',
    obj({ title: str('Note title.'), body: str('Markdown body.'), color: str('Hex accent colour (optional).') }, ['title', 'body']),
    async (args, rt) => {
      const note = rt.content.createNote(String(args.title), String(args.body), args.color ? String(args.color) : undefined);
      return { ok: true, output: `Note created: ${note.title} (${note.id})`, data: note };
    },
  ),
  define(
    'memory.remember',
    'Remember',
    'Persist a durable fact, preference or decision for future conversations.',
    'agent',
    'low',
    obj({ text: str('The fact to remember, written as a standalone sentence.'), tags: strArray('Optional tags.') }, ['text']),
    async (args, rt) => {
      const entry = rt.content.remember(String(args.text), (args.tags as string[]) ?? []);
      return { ok: true, output: `Remembered (${entry.id}).`, data: entry };
    },
  ),
  define(
    'memory.recall',
    'Recall',
    'Search durable memory for facts relevant to a query.',
    'agent',
    'low',
    obj({ query: str('What to recall.'), limit: num('Max entries (default 6).') }, ['query']),
    async (args, rt) => {
      const entries = rt.content.recall(String(args.query), Number(args.limit ?? 6));
      return { ok: true, output: entries.map((e) => `• ${e.text}`).join('\n') || 'Nothing stored yet.', data: entries };
    },
  ),
  define(
    'notebook.run',
    'Run notebook code',
    'Execute a snippet in the live notebook JS kernel and return its console output and result.',
    'knowledge',
    'medium',
    obj({ code: str('JavaScript (or TypeScript) code to execute.'), notebookId: str('Append to this notebook as a cell (optional).') }),
    async (args, rt) => {
      let notebookId = args.notebookId ? String(args.notebookId) : rt.content.notebooks()[0]?.id;
      if (!notebookId) {
        const created = rt.content.createNotebook('Scratch');
        notebookId = created.id;
      }
      const notebook = rt.content.notebook(notebookId)!;
      const cell = {
        id: newId('cell'),
        kind: 'code' as const,
        language: 'javascript' as const,
        source: String(args.code ?? ''),
        status: 'idle' as const,
        updatedAt: nowIso(),
      };
      notebook.cells.push(cell);
      rt.content.saveNotebook(notebook);
      const ran = await rt.content.runCell(notebookId, cell.id);
      return { ok: ran.status === 'ok', output: ran.output ?? '(no output)', data: ran };
    },
  ),
  define(
    'marketplace.search',
    'Search marketplace',
    'Search the Neuro OS marketplace for skills, plugins, agents and themes.',
    'marketplace',
    'low',
    obj({ query: str('Search terms.') }, ['query']),
    async (args, rt) => {
      const items = await rt.searchMarketplace(String(args.query));
      return { ok: true, output: items.map((i) => `${i.kind}: ${i.name} — ${i.tagline} (${i.id})`).join('\n') || 'No matches.', data: items };
    },
  ),
  define(
    'marketplace.install',
    'Install from marketplace',
    'Install a skill, plugin, agent or theme by id.',
    'marketplace',
    'medium',
    obj({ id: str('Catalog item id.') }, ['id']),
    async (args, rt) => {
      const message = await rt.installMarketplace(String(args.id));
      return { ok: true, output: message };
    },
  ),
  define(
    'skills.list',
    'List skills',
    'List installed skills available to this agent.',
    'marketplace',
    'low',
    obj({}),
    async (_args, rt) => {
      const skills = await rt.listSkills();
      return { ok: true, output: skills.map((s) => `${s.id}: ${s.name} — ${s.description}`).join('\n') || 'No skills installed.', data: skills };
    },
  ),
  define(
    'skills.read',
    'Read skill',
    'Read the full SKILL.md instructions of an installed skill so you can follow it.',
    'marketplace',
    'low',
    obj({ id: str('Skill id.') }, ['id']),
    async (args, rt) => {
      const content = await rt.readSkill(String(args.id));
      return { ok: true, output: truncate(content, 24_000) };
    },
  ),
];

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

export class ToolRegistry {
  private tools = new Map(TOOLS.map((tool) => [tool.def.name, tool]));
  private extras: ToolDescriptor[] = [];
  private external = new Map<string, (args: Record<string, unknown>) => Promise<ToolResult>>();

  constructor(private readonly runtime: () => ToolRuntime) {}

  list(): ToolDescriptor[] {
    return [
      ...TOOLS.map((t) => ({ ...t.def, source: 'builtin' as const })),
      ...this.extras,
    ];
  }

  definitions(names?: string[] | 'all'): ToolDef[] {
    const all = this.list();
    const allowed = !names || names === 'all' ? all : all.filter((t) => names.includes(t.name));
    return allowed.map(({ source, sourceId, ...def }) => def);
  }

  has(name: string): boolean {
    return this.tools.has(name) || this.external.has(name);
  }

  policyFor(name: string): 'ask' | 'auto' | 'deny' {
    const settings = this.runtime().settings.public();
    const configured = settings.toolPolicies[name] ?? settings.toolPolicies.default ?? 'ask';
    return configured as 'ask' | 'auto' | 'deny';
  }

  /** Register tools contributed by plugins or MCP servers. */
  registerExternal(
    descriptors: ToolDescriptor[],
    handlers: Record<string, (args: Record<string, unknown>) => Promise<ToolResult>>,
    replaceSource?: string,
  ): void {
    if (replaceSource) {
      this.extras = this.extras.filter((t) => t.sourceId !== replaceSource);
      for (const [name, handler] of [...this.external.entries()]) if (name.startsWith(`${replaceSource}:`)) this.external.delete(name);
    }
    for (const descriptor of descriptors) {
      this.extras = this.extras.filter((t) => t.name !== descriptor.name);
      this.extras.push(descriptor);
      const handler = handlers[descriptor.name];
      if (handler) this.external.set(descriptor.name, handler);
    }
  }

  async invoke(name: string, args: Record<string, unknown>, overrideRuntime?: Partial<ToolRuntime>): Promise<ToolInvocation> {
    const startedAt = nowIso();
    const started = Date.now();
    const invocation: ToolInvocation = { id: newId('call'), name, args, status: 'running', startedAt };
    try {
      const rt: ToolRuntime = { ...this.runtime(), ...(overrideRuntime ?? {}) };
      const external = this.external.get(name);
      let result: ToolResult;
      if (external) {
        result = await external(args);
      } else {
        const tool = this.tools.get(name);
        if (!tool) throw new Error(`Unknown tool: ${name}`);
        result = await tool.handler(args, rt);
      }
      invocation.status = result.ok ? 'ok' : 'error';
      invocation.output = truncate(result.output ?? '', 60_000);
      invocation.data = result.data;
    } catch (error) {
      invocation.status = 'error';
      invocation.output = error instanceof Error ? error.message : String(error);
      log.warn('tools', `${name} failed`, error);
    }
    invocation.endedAt = nowIso();
    invocation.durationMs = Date.now() - started;
    return invocation;
  }
}

export function toolSummary(defs: ToolDescriptor[]): Record<string, number> {
  return defs.reduce<Record<string, number>>((acc, tool) => {
    acc[tool.category] = (acc[tool.category] ?? 0) + 1;
    return acc;
  }, {});
}

export { fs as toolFs, path as toolPath };
