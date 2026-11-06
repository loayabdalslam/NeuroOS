import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { AgentConfig, ProviderConfig, Settings } from '@shared/types';
import type { DeepPartial } from '@shared/ipc';
import { JsonStore, Paths, SecretVault } from '../core/store';
import { log } from '../core/ipc';
import { newId, nowIso } from '../core/util';

export const NEURO_SYSTEM_PROMPT = `You are Neuro, the resident intelligence of Neuro OS â€” an AI-native desktop environment.

You are not a chatbot in a browser tab. You are an operating-system agent with real, permissioned control over the machine: the filesystem, a real shell, a browser, notebooks, app windows, the taskbar and the marketplace of skills.

## Operating principles
1. Act, don't narrate. When a task needs a fact about the machine, call a tool. Never invent file contents, command output or URLs.
2. Prefer the smallest sufficient tool. Read before writing. Verify before claiming success.
3. Build in small verified steps: inspect â†’ change â†’ verify. Report what you actually observed.
4. Keep every action reversible. Never delete or overwrite without checking what is there.
5. When a tool fails, read the error, adapt, and try a different approach â€” do not repeat the same failing call.
6. Respect the workspace boundary. Paths outside the active workspace require explicit user consent.
7. Answer in the user's language. Be dense and concrete, never padded.

## Response style
- Lead with the outcome. Then the evidence (paths, command output, tool results).
- Use markdown: short paragraphs, fenced code with language tags, tight lists.
- When you changed files, list them. When you ran commands, show the meaningful output.
- Never claim you cannot do something you have a tool for.`;

const DEFAULT_SYSTEM_PROMPT = NEURO_SYSTEM_PROMPT;

export function defaultAgents(): AgentConfig[] {
  return [
    {
      id: 'neuro',
      name: 'Neuro',
      description: 'Generalist OS agent with full tool access across every surface.',
      systemPrompt: NEURO_SYSTEM_PROMPT,
      temperature: 0.3,
      maxSteps: 24,
      tools: 'all',
      color: '#4176e6',
      icon: 'sparkles',
      builtin: true,
    },
    {
      id: 'engineer',
      name: 'Engineer',
      description: 'Ships code: reads the tree, edits files, runs tests, keeps the build green.',
      systemPrompt: `${NEURO_SYSTEM_PROMPT}\n\n## Role: Engineer\nYou are pair-programming inside a real repository. Match the surrounding code style exactly. Run the project's own check command after edits when one exists. Prefer targeted edits over rewrites. Explain tradeoffs in one line, not five.`,
      temperature: 0.2,
      maxSteps: 40,
      tools: ['fs.list', 'fs.read', 'fs.write', 'fs.mkdir', 'fs.rename', 'fs.search', 'shell.exec', 'shell.session', 'notebook.run', 'workspace.info', 'git.status'],
      color: '#22c55e',
      icon: 'terminal',
      builtin: true,
    },
    {
      id: 'researcher',
      name: 'Researcher',
      description: 'Browses, reads, cross-checks and writes cited notes into your notebooks.',
      systemPrompt: `${NEURO_SYSTEM_PROMPT}\n\n## Role: Researcher\nGather primary sources first. Quote precisely, cite URLs inline. Separate observation from inference. End with the three most important unknowns.`,
      temperature: 0.4,
      maxSteps: 30,
      tools: ['browser.open', 'browser.read', 'http.fetch', 'fs.read', 'fs.write', 'notebook.run', 'notes.create', 'web.search'],
      color: '#a78bfa',
      icon: 'globe',
      builtin: true,
    },
    {
      id: 'architect',
      name: 'Architect',
      description: 'Designs systems, writes RFCs, reviews structure and keeps the big picture coherent.',
      systemPrompt: `${NEURO_SYSTEM_PROMPT}\n\n## Role: Architect\nOptimise for change over time: boundaries, contracts, failure modes, operability. Produce diagrams in ASCII or mermaid. Every recommendation needs a cost.`,
      temperature: 0.5,
      maxSteps: 20,
      tools: ['fs.list', 'fs.read', 'fs.search', 'workspace.info', 'notebook.run', 'notes.create'],
      color: '#f59e0b',
      icon: 'layers',
      builtin: true,
    },
  ];
}

export function defaultSettings(): Settings {
  const demoRoot = path.join(Paths.workspaces, 'Neuro Demo');
  return {
    version: 4,
    onboardingComplete: false,
    profile: { name: '', role: '', hue: 220 },
    locale: 'en',
    theme: {
      mode: 'dark',
      accent: 'neuro',
      density: 'comfortable',
      transparency: true,
      radius: 14,
      fontScale: 1,
      wallpaper: 'nebula',
      motion: 'full',
      glow: true,
    },
    taskbar: {
      position: 'bottom',
      size: 'md',
      pinned: ['desktop', 'chat', 'workspace', 'space', 'notebook', 'browser', 'terminal', 'marketplace'],
      showLabels: true,
      autoHide: false,
      clock24h: false,
      showSystemStats: true,
      showLanguage: true,
      blur: 24,
    },
    anchor: { enabled: true, side: 'right', width: 324, autoHide: false, pins: [] },
    pages: [{ id: 'page-desktop', surface: 'desktop', title: 'Desktop', params: {}, pinned: true, closable: false }],
    providers: [],
    agents: defaultAgents(),
    activeAgentId: 'neuro',
    toolPolicies: { default: 'ask', 'fs.read': 'auto', 'fs.list': 'auto', 'fs.stat': 'auto', 'fs.search': 'auto', 'workspace.info': 'auto', 'system.info': 'auto', 'http.fetch': 'auto', 'browser.read': 'auto', 'web.search': 'auto', 'notes.create': 'auto', 'notebook.run': 'auto' },
    workspaceRoot: demoRoot,
    recentWorkspaces: [demoRoot],
    marketplace: { installed: [], autoUpdate: true },
    window: { width: 1480, height: 940, maximized: false },
    telemetry: false,
    developerMode: false,
    createdAt: nowIso(),
  };
}

export class SettingsService {
  private store: JsonStore<Settings>;
  private vault = new SecretVault();

  constructor() {
    this.store = new JsonStore<Settings>(Paths.stateFile('settings'), defaultSettings(), (err) =>
      log.error('settings', 'persist failed', err),
    );
  }

  init(): Settings {
    // One-time profile bootstrap: point at a workspace that exists.
    const current = this.store.get();
    if (!current.workspaceRoot) {
      this.store.set({ workspaceRoot: path.join(Paths.workspaces, 'Neuro Demo') });
    }
    return this.public();
  }

  /** Settings with decrypted provider keys, safe for the renderer process. */
  public(): Settings {
    const s = structuredClone(this.store.get());
    s.providers = s.providers.map((p) => ({ ...p, apiKey: this.vault.get(`provider:${p.id}`) }));
    return s;
  }

  patch(patch: DeepPartial<Settings>): Settings {
    const sanitized = this.extractSecrets(patch as DeepPartial<Settings>);
    this.store.set(sanitized);
    return this.public();
  }

  reset(): Settings {
    this.store.replace(defaultSettings());
    return this.public();
  }

  completeOnboarding(input: {
    locale: string;
    name: string;
    role: string;
    theme: 'dark' | 'light' | 'system';
    accent: string;
    workspaceRoot: string | null;
    provider?: ProviderConfig | null;
  }): Settings {
    const patch: DeepPartial<Settings> = {
      onboardingComplete: true,
      locale: input.locale,
      profile: { name: input.name || 'Explorer', role: input.role || 'Builder' },
      theme: { mode: input.theme, accent: input.accent as Settings['theme']['accent'] },
      workspaceRoot: input.workspaceRoot ?? path.join(Paths.workspaces, 'Neuro Demo'),
      recentWorkspaces: [input.workspaceRoot ?? path.join(Paths.workspaces, 'Neuro Demo')],
      pages: [
        { id: 'page-desktop', surface: 'desktop', title: 'Desktop', params: {}, pinned: true, closable: false },
        { id: newId('page'), surface: 'chat', title: 'Chat', params: {}, pinned: true },
      ],
    };
    if (input.provider) {
      patch.providers = [...this.store.get().providers, { ...input.provider, apiKey: '' }];
      this.vault.set(`provider:${input.provider.id}`, input.provider.apiKey);
    }
    this.store.set(patch);
    return this.public();
  }

  saveProvider(provider: ProviderConfig): Settings {
    const providers = [...this.store.get().providers];
    const idx = providers.findIndex((p) => p.id === provider.id);
    const { apiKey, ...rest } = provider;
    if (idx >= 0) providers[idx] = rest as ProviderConfig;
    else providers.push(rest as ProviderConfig);
    // Never persist plaintext keys.
    this.vault.set(`provider:${provider.id}`, apiKey);
    this.store.set({ providers });
    return this.public();
  }

  removeProvider(id: string): Settings {
    this.vault.remove(`provider:${id}`);
    this.store.set({ providers: this.store.get().providers.filter((p) => p.id !== id) });
    return this.public();
  }

  getProvider(id: string): ProviderConfig | null {
    const provider = this.store.get().providers.find((p) => p.id === id);
    if (!provider) return null;
    return { ...provider, apiKey: this.vault.get(`provider:${provider.id}`) };
  }

  get raw(): Settings {
    return this.store.get();
  }

  saveAgent(agent: AgentConfig): Settings {
    const agents = [...this.store.get().agents];
    const idx = agents.findIndex((a) => a.id === agent.id);
    if (idx >= 0) agents[idx] = agent;
    else agents.push(agent);
    this.store.set({ agents });
    return this.public();
  }

  removeAgent(id: string): Settings {
    this.store.set({ agents: this.store.get().agents.filter((a) => a.id !== id) });
    return this.public();
  }

  saveMarketplace(patch: Settings['marketplace']): Settings {
    this.store.set({ marketplace: patch });
    return this.public();
  }

  private extractSecrets(patch: DeepPartial<Settings>): DeepPartial<Settings> {
    if (!patch.providers) return patch;
    const providers = patch.providers.map((p) => {
      if (p && typeof p === 'object' && 'apiKey' in p && p.apiKey !== undefined) {
        const { apiKey, ...rest } = p as ProviderConfig;
        this.vault.set(`provider:${(p as ProviderConfig).id}`, apiKey ?? '');
        return rest as ProviderConfig;
      }
      return p as ProviderConfig;
    });
    return { ...patch, providers };
  }

  async exportTo(file: string): Promise<void> {
    const data = this.store.get();
    fs.writeFileSync(file, JSON.stringify({ ...data, providers: data.providers.map((p) => ({ ...p, apiKey: '' })) }, null, 2), 'utf8');
  }

  async importFrom(file: string): Promise<Settings> {
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw) as Settings;
    this.store.replace({ ...defaultSettings(), ...parsed, onboardingComplete: true });
    return this.public();
  }
}

