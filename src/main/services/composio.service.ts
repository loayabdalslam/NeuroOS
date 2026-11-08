import { createHash, randomBytes } from 'node:crypto';
import type { ComposioAccountInfo, ComposioStatus, ComposioTool, ComposioToolkitInfo, ToolDescriptor } from '@shared/types';
import { JsonStore } from '../core/store';

interface SecretStoreLike {
  get: (key: string) => string;
  set: (key: string, value: string) => void;
  remove?: (key: string) => void;
}

interface LogLike {
  info: (scope: string, message: string, ...rest: unknown[]) => void;
  warn: (scope: string, message: string, ...rest: unknown[]) => void;
  error: (scope: string, message: string, ...rest: unknown[]) => void;
}

interface StoredTool {
  slug: string;
  name: string;
  description: string;
  toolkit: string;
  toolkitName: string;
  parameters: Record<string, unknown>;
}

interface ComposioState {
  userId: string;
  baseUrl: string;
  enabled: string[];
  catalog: StoredTool[];
  lastSync?: string;
}

interface ToolRegistryLike {
  setSource: (sourceId: string, tools: ToolDescriptor[], handlers: any) => void;
  removeSource: (sourceId: string) => void;
}

export interface ComposioHooks {
  vault: SecretStoreLike;
  registry: ToolRegistryLike;
  log: LogLike;
  openExternal: (url: string) => Promise<void>;
  onEvent?: (status: ComposioStatus) => void;
}

const DEFAULT_BASE = 'https://backend.composio.dev/api/v3.1';
const VAULT_KEY = 'composio:key';
const SOURCE = 'composio';

const DEFAULT_STATE: ComposioState = {
  userId: '',
  baseUrl: DEFAULT_BASE,
  enabled: [],
  catalog: [],
};

/**
 * Composio integration.
 *
 * Two layers:
 *  1. a catalog + connection manager over the Composio REST API v3.1;
 *  2. every enabled action is registered as a first-class Neuro tool, and two
 *     meta tools (search / execute) expose the entire catalog to the agent.
 */
export class ComposioService {
  private store: JsonStore<ComposioState>;
  private hooks: ComposioHooks;
  private accountsCache: ComposioAccountInfo[] = [];
  private lastError?: string;
  private syncing = false;

  constructor(options: { dataFile: string; hooks: ComposioHooks }) {
    this.store = new JsonStore<ComposioState>(options.dataFile, DEFAULT_STATE);
    this.hooks = options.hooks;
    if (!this.store.get().userId) {
      this.store.set({ userId: `neuro-${randomBytes(4).toString('hex')}` });
    }
  }

  async start(): Promise<void> {
    await this.registerTools();
    this.hooks.log.info('composio', this.status().configured ? 'configured' : 'not configured');
  }

  dispose(): void {
    this.hooks.registry.removeSource(SOURCE);
  }

  private get key(): string {
    return this.hooks.vault.get(VAULT_KEY);
  }

  status(): ComposioStatus {
    const state = this.store.get();
    return {
      configured: Boolean(this.key),
      apiKeySet: Boolean(this.key),
      userId: state.userId,
      baseUrl: state.baseUrl,
      tools: state.catalog.length,
      toolkits: new Set(state.catalog.map((tool) => tool.toolkit)).size,
      connected: this.accountsCache.length,
      enabled: state.enabled.length,
      lastSync: state.lastSync,
      error: this.lastError,
    };
  }

  configure(input: { apiKey?: string; baseUrl?: string; userId?: string }): ComposioStatus {
    if (input.apiKey !== undefined) {
      const value = input.apiKey.trim();
      if (value) this.hooks.vault.set(VAULT_KEY, value);
      else this.hooks.vault.remove?.(VAULT_KEY);
    }
    const patch: Partial<ComposioState> = {};
    if (input.baseUrl !== undefined) patch.baseUrl = input.baseUrl.trim() || DEFAULT_BASE;
    if (input.userId !== undefined && input.userId.trim()) patch.userId = input.userId.trim();
    if (Object.keys(patch).length) this.store.set(patch);
    this.lastError = undefined;
    this.emit();
    return this.status();
  }

  private emit(): void {
    this.hooks.onEvent?.(this.status());
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const apiKey = this.key;
    if (!apiKey) throw new Error('Composio API key is not configured');
    const base = this.store.get().baseUrl.replace(/\/+$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`${base}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          ...(init.headers ?? {}),
        },
      });
      const text = await response.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }
      if (!response.ok) {
        const record = json as { error?: { message?: string } | string; message?: string };
        const message =
          typeof record?.error === 'string'
            ? record.error
            : record?.error?.message ?? record?.message ?? `Composio HTTP ${response.status}`;
        throw new Error(message);
      }
      return json as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private items<T>(payload: unknown): T[] {
    if (Array.isArray(payload)) return payload as T[];
    const record = payload as { items?: T[]; data?: T[]; results?: T[] };
    return record?.items ?? record?.data ?? record?.results ?? [];
  }

  private normalizeTool(raw: Record<string, unknown>): StoredTool | null {
    const slug = String(raw.slug ?? raw.action ?? raw.name ?? '').trim();
    if (!slug) return null;
    const toolkit = raw.toolkit as Record<string, unknown> | string | undefined;
    const toolkitSlug = typeof toolkit === 'string' ? toolkit : String(toolkit?.slug ?? raw.toolkit_slug ?? 'other');
    const toolkitName = typeof toolkit === 'object' && toolkit ? String(toolkit.name ?? toolkitSlug) : toolkitSlug;
    const schema = (raw.input_parameters ?? raw.parameters ?? raw.input_schema ?? {}) as Record<string, unknown>;
    return {
      slug,
      name: String(raw.name ?? slug),
      description: String(raw.description ?? '').slice(0, 900),
      toolkit: toolkitSlug,
      toolkitName,
      parameters: schema && typeof schema === 'object' ? schema : { type: 'object', properties: {} },
    };
  }

  async sync(): Promise<ComposioStatus> {
    if (!this.key) {
      this.lastError = 'Add a Composio API key first';
      this.emit();
      return this.status();
    }
    if (this.syncing) return this.status();
    this.syncing = true;
    try {
      const collected: StoredTool[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const payload = await this.request<unknown>(`/tools?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        const rows = this.items<Record<string, unknown>>(payload);
        for (const row of rows) {
          const normalized = this.normalizeTool(row);
          if (normalized) collected.push(normalized);
        }
        const next = (payload as { next_cursor?: string }).next_cursor;
        if (rows.length < 100 || !next) break;
        cursor = next;
      }
      const unique = new Map(collected.map((tool) => [tool.slug, tool]));
      const catalog = [...unique.values()];
      const enabled = this.store.get().enabled.filter((slug) => unique.has(slug));
      this.store.set({ catalog, enabled, lastSync: new Date().toISOString() });
      this.lastError = undefined;
      await this.refreshAccounts().catch(() => undefined);
      await this.registerTools();
      this.hooks.log.info('composio', `synced ${catalog.length} tools · ${new Set(catalog.map((t) => t.toolkit)).size} toolkits`);
    } catch (error) {
      this.lastError = (error as Error).message;
      this.hooks.log.warn('composio', 'sync failed', error);
    } finally {
      this.syncing = false;
      this.emit();
    }
    return this.status();
  }

  async searchRemote(queryInput: string, limit = 24): Promise<ComposioTool[]> {
    const query = queryInput.trim().toLowerCase();
    if (!query) return [];
    const toolkits = await this.toolkits();
    const matches = toolkits
      .filter((toolkit) => toolkit.slug.includes(query) || toolkit.name.toLowerCase().includes(query) || (toolkit.description ?? '').toLowerCase().includes(query))
      .slice(0, 4);
    const collected = new Map<string, StoredTool>();
    for (const toolkit of matches) {
      let cursor: string | undefined;
      for (let page = 0; page < 5; page += 1) {
        try {
          const payload = await this.request<unknown>(
            `/tools?toolkit_slug=${encodeURIComponent(toolkit.slug)}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
          );
          for (const row of this.items<Record<string, unknown>>(payload)) {
            const normalized = this.normalizeTool(row);
            if (normalized) collected.set(normalized.slug, normalized);
          }
          const next = (payload as { next_cursor?: string }).next_cursor;
          if (!next) break;
          cursor = next;
        } catch (error) {
          this.lastError = (error as Error).message;
          break;
        }
      }
    }
    if (collected.size) {
      const catalog = [...this.store.get().catalog];
      const bySlug = new Map(catalog.map((tool) => [tool.slug, tool]));
      for (const tool of collected.values()) bySlug.set(tool.slug, tool);
      this.store.set({ catalog: [...bySlug.values()] });
      this.emit();
    }
    const local = this.tools({ query });
    if (local.length) return local.slice(0, limit);
    return [...collected.values()]
      .map((tool) => ({
        slug: tool.slug,
        name: tool.name,
        description: tool.description,
        toolkit: tool.toolkit,
        toolkitName: tool.toolkitName,
        parameters: tool.parameters,
        enabled: this.store.get().enabled.includes(tool.slug),
      }))
      .slice(0, limit);
  }

  tools(input?: { query?: string; toolkit?: string }): ComposioTool[] {
    const enabled = new Set(this.store.get().enabled);
    const query = input?.query?.trim().toLowerCase();
    return this.store
      .get()
      .catalog.filter((tool) => {
        if (input?.toolkit && tool.toolkit !== input.toolkit) return false;
        if (!query) return true;
        return (
          tool.slug.toLowerCase().includes(query) ||
          tool.name.toLowerCase().includes(query) ||
          tool.description.toLowerCase().includes(query) ||
          tool.toolkit.toLowerCase().includes(query)
        );
      })
      .map((tool) => ({
        slug: tool.slug,
        name: tool.name,
        description: tool.description,
        toolkit: tool.toolkit,
        toolkitName: tool.toolkitName,
        parameters: tool.parameters,
        enabled: enabled.has(tool.slug),
      }));
  }

  async toolkits(): Promise<ComposioToolkitInfo[]> {
    let remote: Record<string, unknown>[] = [];
    if (this.key) {
      try {
        remote = this.items<Record<string, unknown>>(await this.request<unknown>('/toolkits?limit=100'));
      } catch (error) {
        this.lastError = (error as Error).message;
      }
    }
    const counts = new Map<string, number>();
    const names = new Map<string, string>();
    for (const tool of this.store.get().catalog) {
      counts.set(tool.toolkit, (counts.get(tool.toolkit) ?? 0) + 1);
      names.set(tool.toolkit, tool.toolkitName);
    }
    const connectedToolkits = new Set(this.accountsCache.map((account) => account.toolkit));
    const merged = new Map<string, ComposioToolkitInfo>();
    for (const row of remote) {
      const slug = String(row.slug ?? '').trim();
      if (!slug) continue;
      const meta = (row.meta ?? {}) as Record<string, unknown>;
      merged.set(slug, {
        slug,
        name: String(row.name ?? slug),
        description: String(row.description ?? meta.description ?? ''),
        logo: typeof row.logo === 'string' ? row.logo : undefined,
        tools: counts.get(slug) ?? 0,
        connected: connectedToolkits.has(slug),
      });
    }
    for (const [slug, count] of counts) {
      if (!merged.has(slug)) {
        merged.set(slug, {
          slug,
          name: names.get(slug) ?? slug,
          tools: count,
          connected: connectedToolkits.has(slug),
        });
      }
    }
    return [...merged.values()].sort((a, b) => b.tools - a.tools || a.name.localeCompare(b.name));
  }

  async refreshAccounts(): Promise<ComposioAccountInfo[]> {
    if (!this.key) {
      this.accountsCache = [];
      return [];
    }
    const userId = encodeURIComponent(this.store.get().userId);
    let payload = await this.request<unknown>(`/connected_accounts?user_ids=${userId}&limit=100`);
    let rows = this.items<Record<string, unknown>>(payload);
    if (!rows.length) {
      // Accounts may be owned by a different Composio user (API key scope).
      payload = await this.request<unknown>('/connected_accounts?limit=100');
      rows = this.items<Record<string, unknown>>(payload);
    }
    this.accountsCache = rows.map((row) => {
      const toolkit = row.toolkit as Record<string, unknown> | string | undefined;
      return {
        id: String(row.id ?? row.connected_account_id ?? ''),
        toolkit: typeof toolkit === 'string' ? toolkit : String(toolkit?.slug ?? ''),
        status: String(row.status ?? 'ACTIVE'),
        alias: typeof row.alias === 'string' ? row.alias : undefined,
      };
    });
    this.emit();
    return this.accountsCache;
  }

  accounts(): ComposioAccountInfo[] {
    return this.accountsCache;
  }

  async connect(toolkit: string): Promise<{ redirectUrl: string; accountId: string }> {
    const authConfigs = this.items<Record<string, unknown>>(
      await this.request<unknown>(`/auth_configs?toolkit_slug=${encodeURIComponent(toolkit)}&limit=1`),
    );
    const authConfigId = String(authConfigs[0]?.id ?? '');
    if (!authConfigId) {
      throw new Error(
        `No auth config for "${toolkit}". Create one in the Composio dashboard (Auth configs → ${toolkit}), then retry.`,
      );
    }
    const payload = await this.request<Record<string, unknown>>('/connected_accounts/link', {
      method: 'POST',
      body: JSON.stringify({ auth_config_id: authConfigId, user_id: this.store.get().userId }),
    });
    const redirectUrl = String(payload.redirect_url ?? payload.redirectUrl ?? '');
    const accountId = String(payload.connected_account_id ?? payload.id ?? '');
    if (!redirectUrl) throw new Error('Composio did not return a redirect URL');
    await this.hooks.openExternal(redirectUrl);
    this.hooks.log.info('composio', `auth link opened for ${toolkit}`);
    return { redirectUrl, accountId };
  }

  async execute(slug: string, args: Record<string, unknown>): Promise<{ ok: boolean; output: string; data?: unknown }> {
    try {
      const payload = await this.request<Record<string, unknown>>(`/tools/execute/${encodeURIComponent(slug)}`, {
        method: 'POST',
        body: JSON.stringify({ user_id: this.store.get().userId, arguments: args }),
      });
      const successful = payload.successful !== false && !payload.error;
      const data = payload.data ?? payload.response_data ?? payload.result ?? payload;
      const output = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      return { ok: successful, output: output.slice(0, 20_000), data };
    } catch (error) {
      return { ok: false, output: `Composio: ${(error as Error).message}` };
    }
  }

  async toggle(slug: string, enabled: boolean): Promise<ComposioStatus> {
    const current = this.store.get().enabled;
    const next = enabled ? [...new Set([...current, slug])] : current.filter((item) => item !== slug);
    this.store.set({ enabled: next });
    await this.registerTools();
    this.emit();
    return this.status();
  }

  async registerTools(): Promise<void> {
    const registry = this.hooks.registry;
    registry.removeSource(SOURCE);
    const state = this.store.get();
    if (!this.key) return;

    const tools: ToolDescriptor[] = [];
    const handlers: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {};

    tools.push({
      name: 'composio.search',
      title: 'Search integrations',
      description:
        'Search the Composio catalog of third-party actions (Gmail, GitHub, Slack, Notion, Linear, Jira, Sheets and 100+ more). Returns slugs you can run with composio.execute.',
      category: 'network',
      danger: 'low',
      source: 'composio',
      sourceId: 'meta',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What you want to do, e.g. "send email" or "create a github issue".' },
          toolkit: { type: 'string', description: 'Optional toolkit slug to scope the search.' },
          limit: { type: 'number', description: 'Max results (default 12).' },
        },
        additionalProperties: false,
      },
    });
    handlers['composio.search'] = async (args) => {
      const query = String(args.query ?? '').toLowerCase();
      const toolkit = args.toolkit ? String(args.toolkit) : undefined;
      const limit = Math.min(Number(args.limit ?? 12) || 12, 40);
      let results = this.tools({ query, toolkit }).slice(0, limit);
      if (!results.length && query) {
        results = (await this.searchRemote(query, limit)).slice(0, limit);
      }
      if (!results.length) {
        return { ok: true, output: state.catalog.length ? 'No matching integrations.' : 'Catalog is empty — run a Composio sync first.' };
      }
      const lines = results.map((tool) => `- ${tool.slug} — ${tool.name} (${tool.toolkit})${tool.enabled ? ' [enabled]' : ''}`);
      return { ok: true, output: `${results.length} integration(s):\n${lines.join('\n')}` };
    };

    tools.push({
      name: 'composio.execute',
      title: 'Run integration action',
      description:
        'Execute any Composio action by slug with JSON arguments. Use composio.search first to discover slugs and their input schemas.',
      category: 'network',
      danger: 'medium',
      source: 'composio',
      sourceId: 'meta',
      parameters: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Action slug from composio.search, e.g. GITHUB_CREATE_ISSUE.' },
          arguments: { type: 'object', description: 'Arguments matching the action input schema.' },
        },
        required: ['slug'],
        additionalProperties: false,
      },
    });
    handlers['composio.execute'] = async (args) => {
      const slug = String(args.slug ?? '').trim();
      if (!slug) return { ok: false, output: 'slug is required' };
      const callArgs = (args.arguments ?? {}) as Record<string, unknown>;
      const result = await this.execute(slug, callArgs);
      return { ok: result.ok, output: result.output };
    };

    for (const slug of state.enabled) {
      const tool = state.catalog.find((item) => item.slug === slug);
      if (!tool) continue;
      const name = `composio.${slug.toLowerCase()}`;
      tools.push({
        name,
        title: tool.name,
        description: `${tool.description}\n\nComposio action: ${tool.slug} (${tool.toolkitName}).`,
        category: 'network',
        danger: 'medium',
        source: 'composio',
        sourceId: slug,
        parameters: tool.parameters,
      });
      handlers[name] = async (args) => {
        const result = await this.execute(tool.slug, args);
        return { ok: result.ok, output: result.output };
      };
    }

    registry.setSource(SOURCE, tools, handlers);
  }

  /** Stable, non-reversible identifier for logs. */
  fingerprint(): string {
    return createHash('sha256').update(this.store.get().userId).digest('hex').slice(0, 10);
  }
}
