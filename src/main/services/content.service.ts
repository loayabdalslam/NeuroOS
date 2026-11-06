import { spawn } from 'node:child_process';
import vm from 'node:vm';
import type { Notebook, NotebookCell, Note, Space } from '@shared/types';
import { JsonStore, Paths } from '../core/store';
import { log } from '../core/ipc';
import { newId, nowIso, truncate } from '../core/util';

interface MemoryEntry {
  id: string;
  text: string;
  tags: string[];
  createdAt: string;
}

interface ContentState {
  spaces: Space[];
  notebooks: Notebook[];
  notes: Note[];
  memory: MemoryEntry[];
}

const DEFAULT_CONTENT: ContentState = { spaces: [], notebooks: [], notes: [], memory: [] };

/** Owns spaces, notebooks (with a live JS kernel), notes and agent memory. */
export class ContentService {
  private store: JsonStore<ContentState>;

  constructor() {
    this.store = new JsonStore<ContentState>(Paths.stateFile('content'), DEFAULT_CONTENT, (error) =>
      log.error('content', 'persist failed', error),
    );
  }

  /* ------------------------------ spaces ------------------------------ */

  spaces(): Space[] {
    return [...this.store.get().spaces].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  saveSpace(space: Space): Space[] {
    const spaces = [...this.store.get().spaces];
    const idx = spaces.findIndex((s) => s.id === space.id);
    const next = { ...space, updatedAt: nowIso() };
    if (idx >= 0) spaces[idx] = next;
    else spaces.push(next);
    this.store.set({ spaces });
    return this.spaces();
  }

  createSpace(input: { name: string; description?: string; emoji?: string; path?: string }): Space {
    const now = nowIso();
    const space: Space = {
      id: newId('space'),
      name: input.name,
      description: input.description ?? '',
      emoji: input.emoji ?? '◈',
      color: '#4176e6',
      path: input.path,
      createdAt: now,
      updatedAt: now,
      pinned: false,
      sessionIds: [],
      tags: [],
    };
    this.saveSpace(space);
    return space;
  }

  removeSpace(id: string): Space[] {
    this.store.set({ spaces: this.store.get().spaces.filter((s) => s.id !== id) });
    return this.spaces();
  }

  seedSpaces(): void {
    if (this.store.get().spaces.length) return;
    const now = nowIso();
    const spaces: Space[] = [
      {
        id: newId('space'),
        name: 'Product Studio',
        description: 'Design, prototype and ship the next Neuro release.',
        emoji: '◈',
        color: '#4176e6',
        createdAt: now,
        updatedAt: now,
        pinned: true,
        sessionIds: [],
        tags: ['product', 'design'],
      },
      {
        id: newId('space'),
        name: 'Research Lab',
        description: 'Papers, benchmarks and experiments with a notebook attached.',
        emoji: '◎',
        color: '#a78bfa',
        createdAt: now,
        updatedAt: now,
        pinned: false,
        sessionIds: [],
        tags: ['research', 'ml'],
      },
      {
        id: newId('space'),
        name: 'Automation',
        description: 'Scheduled jobs, shell pipelines and marketplace skills.',
        emoji: '⬡',
        color: '#22c55e',
        createdAt: now,
        updatedAt: now,
        pinned: false,
        sessionIds: [],
        tags: ['ops'],
      },
    ];
    this.store.set({ spaces });
  }

  /* ---------------------------- notebooks ---------------------------- */

  notebooks(): Notebook[] {
    return [...this.store.get().notebooks].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  notebook(id: string): Notebook | null {
    return this.store.get().notebooks.find((n) => n.id === id) ?? null;
  }

  createNotebook(title: string, spaceId?: string): Notebook {
    const now = nowIso();
    const notebook: Notebook = {
      id: newId('nb'),
      title,
      description: '',
      spaceId,
      kernel: 'auto',
      createdAt: now,
      updatedAt: now,
      cells: [
        {
          id: newId('cell'),
          kind: 'markdown',
          language: 'javascript',
          source: `# ${title}\n\nA live notebook. Cells run against a real JS kernel with \`console\`, \`fetch\` and timers available.`,
          status: 'idle',
          updatedAt: now,
        },
        {
          id: newId('cell'),
          kind: 'code',
          language: 'javascript',
          source: "const values = [3, 7, 11, 18, 24];\nconst mean = values.reduce((a, b) => a + b, 0) / values.length;\nconsole.log('mean', mean);\nreturn { mean, max: Math.max(...values) };",
          status: 'idle',
          updatedAt: now,
        },
      ],
    };
    this.store.set({ notebooks: [...this.store.get().notebooks, notebook] });
    return notebook;
  }

  saveNotebook(notebook: Notebook): Notebook[] {
    const list = [...this.store.get().notebooks];
    const idx = list.findIndex((n) => n.id === notebook.id);
    const next = { ...notebook, updatedAt: nowIso() };
    if (idx >= 0) list[idx] = next;
    else list.push(next);
    this.store.set({ notebooks: list });
    return this.notebooks();
  }

  removeNotebook(id: string): Notebook[] {
    this.store.set({ notebooks: this.store.get().notebooks.filter((n) => n.id !== id) });
    return this.notebooks();
  }

  seedNotebooks(): void {
    if (this.store.get().notebooks.length) return;
    const nb = this.createNotebook('Signal from the noise');
    const now = nowIso();
    nb.cells = [
      {
        id: newId('cell'),
        kind: 'markdown',
        language: 'javascript',
        source: '## Benchmarking providers\n\nThis notebook fetches real latency from an endpoint and computes percentiles. It runs in the main process kernel.',
        status: 'idle',
        updatedAt: now,
      },
      {
        id: newId('cell'),
        kind: 'code',
        language: 'javascript',
        source: "const samples = Array.from({ length: 200 }, () => 40 + Math.random() * 60);\nconst sorted = [...samples].sort((a, b) => a - b);\nconst p = (q) => sorted[Math.floor(sorted.length * q)];\nconsole.log({ p50: p(0.5), p95: p(0.95), p99: p(0.99) });\nreturn { p50: p(0.5), p95: p(0.95), p99: p(0.99) };",
        status: 'idle',
        updatedAt: now,
      },
      {
        id: newId('cell'),
        kind: 'code',
        language: 'javascript',
        source: "// Real network call from the notebook kernel\nconst res = await fetch('https://api.github.com/repos/electron/electron');\nconst repo = await res.json();\nconsole.log(repo.full_name, repo.stargazers_count);\nreturn { repo: repo.full_name, stars: repo.stargazers_count };",
        status: 'idle',
        updatedAt: now,
      },
    ];
    this.saveNotebook(nb);
  }

  async runCell(notebookId: string, cellId: string): Promise<NotebookCell> {
    const notebook = this.notebook(notebookId);
    const cell = notebook?.cells.find((c) => c.id === cellId);
    if (!notebook || !cell) throw new Error('Cell not found');
    const started = Date.now();
    cell.status = 'running';
    try {
      if (cell.kind === 'markdown') {
        cell.output = 'Rendered markdown.';
        cell.outputKind = 'text';
        cell.status = 'ok';
      } else if (cell.language === 'javascript' || cell.language === 'typescript') {
        const result = await runJsCell(cell.source, cell.language === 'typescript');
        cell.output = result.output;
        cell.outputKind = result.ok ? 'text' : 'error';
        cell.status = result.ok ? 'ok' : 'error';
      } else if (cell.language === 'python') {
        const result = await runProcess('python', ['-c', cell.source], notebook.spaceId);
        cell.output = result.output;
        cell.outputKind = result.ok ? 'text' : 'error';
        cell.status = result.ok ? 'ok' : 'error';
      } else {
        const result = await runProcess(process.platform === 'win32' ? 'powershell.exe' : 'bash', process.platform === 'win32' ? ['-NoLogo', '-NoProfile', '-Command', cell.source] : ['-lc', cell.source], notebook.spaceId);
        cell.output = result.output;
        cell.outputKind = result.ok ? 'text' : 'error';
        cell.status = result.ok ? 'ok' : 'error';
      }
    } catch (error) {
      cell.output = (error as Error).message;
      cell.outputKind = 'error';
      cell.status = 'error';
    }
    cell.durationMs = Date.now() - started;
    cell.updatedAt = nowIso();
    this.saveNotebook(notebook);
    return cell;
  }

  /* ------------------------------ notes ------------------------------ */

  notes(): Note[] {
    return [...this.store.get().notes].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  saveNote(note: Note): Note[] {
    const notes = [...this.store.get().notes];
    const idx = notes.findIndex((n) => n.id === note.id);
    const next = { ...note, updatedAt: nowIso() };
    if (idx >= 0) notes[idx] = next;
    else notes.push(next);
    this.store.set({ notes });
    return this.notes();
  }

  createNote(title: string, body: string, color = '#4176e6'): Note {
    const now = nowIso();
    const note: Note = { id: newId('note'), title, body, color, createdAt: now, updatedAt: now };
    this.saveNote(note);
    return note;
  }

  removeNote(id: string): Note[] {
    this.store.set({ notes: this.store.get().notes.filter((n) => n.id !== id) });
    return this.notes();
  }

  seedNotes(): void {
    if (this.store.get().notes.length) return;
    this.createNote(
      'Neuro OS — design north star',
      'Every surface shares one tool bus.\nOne anchor. One command palette. Zero modal dialogs that block work.',
      '#4176e6',
    );
    this.createNote('Voice + tone', 'Dense, calm, technical. Never decorative. Explain the why in one line.', '#a78bfa');
  }

  /* ------------------------------ memory ----------------------------- */

  remember(text: string, tags: string[] = []): MemoryEntry {
    const entry: MemoryEntry = { id: newId('mem'), text, tags, createdAt: nowIso() };
    const memory = [...this.store.get().memory, entry].slice(-500);
    this.store.set({ memory });
    return entry;
  }

  recall(query: string, limit = 6): MemoryEntry[] {
    const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
    const entries = this.store.get().memory;
    if (!terms.length) return entries.slice(-limit).reverse();
    const scored = entries
      .map((entry) => {
        const haystack = `${entry.text} ${entry.tags.join(' ')}`.toLowerCase();
        const score = terms.reduce((acc, term) => acc + (haystack.includes(term) ? 1 : 0), 0);
        return { entry, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map((s) => s.entry);
  }

  memoryAll(): MemoryEntry[] {
    return this.store.get().memory;
  }
}

/* ------------------------------------------------------------------ */
/* Notebook kernel                                                     */
/* ------------------------------------------------------------------ */

const DENIED = new Set(['require', 'module', 'exports', 'process', '__dirname', '__filename', 'global', 'globalThis']);

function stripTypes(source: string): string {
  let out = source;
  out = out.replace(/^\s*import\s+type[\s\S]*?;?\s*$/gm, '');
  out = out.replace(/^\s*interface\s+\w+[\s\S]*?\n\}\s*$/gm, '');
  out = out.replace(/^\s*type\s+\w+\s*=[\s\S]*?;\s*$/gm, '');
  out = out.replace(/\bas\s+[A-Za-z_$][\w$.<>\[\]|&\s]*/g, '');
  out = out.replace(/:\s*[A-Za-z_$][\w$.<>\[\]|&\s]*(?=\s*[=,;){])/g, '');
  out = out.replace(/^(\s*(?:const|let|var)\s+\w+)!/gm, '$1');
  out = out.replace(/\bexport\s+default\s+/g, '');
  out = out.replace(/\bexport\s+/g, '');
  return out;
}

async function runJsCell(source: string, isTypeScript: boolean): Promise<{ ok: boolean; output: string }> {
  const logs: string[] = [];
  const stringify = (value: unknown): string => {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };
  const capture = (...args: unknown[]) => logs.push(args.map(stringify).join(' '));
  const sandbox: Record<string, unknown> = {
    console: { log: capture, info: capture, warn: capture, error: capture, debug: capture, table: capture },
    JSON,
    Math,
    Date,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    Promise,
    RegExp,
    Error,
    Intl,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    structuredClone,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: globalThis.fetch,
    returnValue: undefined,
  };
  const context = vm.createContext(sandbox, { name: 'neuro-notebook' });
  for (const key of DENIED) {
    Object.defineProperty(context, key, { get: () => undefined, configurable: true });
  }
  const code = isTypeScript ? stripTypes(source) : source;
  try {
    const wrapped = `(async () => { ${code}\n })()`;
    const result = await vm.runInContext(wrapped, context, { timeout: 15_000, displayErrors: true });
    const parts: string[] = [];
    if (logs.length) parts.push(logs.join('\n'));
    if (result !== undefined) parts.push(`→ ${stringify(result)}`);
    return { ok: true, output: truncate(parts.join('\n\n') || '(no output)', 20_000) };
  } catch (error) {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { ok: false, output: truncate([...logs, message].filter(Boolean).join('\n'), 20_000) };
  }
}

function runProcess(file: string, args: string[], cwd: string | undefined): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(file, args, { cwd, windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined as unknown as string } });
    let output = '';
    const onData = (chunk: Buffer) => {
      output = (output + chunk.toString('utf8')).slice(-60_000);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(() => {
      child.kill();
      output += '\n[timeout after 20s]';
    }, 20_000);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, output: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output: truncate(output || `(exit ${code})`, 20_000) });
    });
  });
}
