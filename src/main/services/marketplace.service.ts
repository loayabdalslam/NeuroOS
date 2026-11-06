import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { CatalogItem, InstalledItem, ToolDescriptor } from '@shared/types';
import { Paths } from '../core/store';
import { log } from '../core/ipc';
import { ensureDir, nowIso } from '../core/util';
import type { SettingsService } from './settings.service';
import type { ToolRegistry } from './tools';

/**
 * Marketplace + skill runtime.
 *
 * Catalog entries are declarative JSON. Installing a skill writes a real
 * SKILL.md to the profile; installing a plugin registers real callable tools
 * backed by the plugin's command template; installing an agent adds a full
 * agent definition. Everything is uninstallable and enabled/disabled live.
 */
export class MarketplaceService {
  private catalog: CatalogItem[] = [];
  private installed: InstalledItem[] = [];
  private registry: ToolRegistry;
  private settings: SettingsService;

  constructor(settings: SettingsService, registry: ToolRegistry) {
    this.settings = settings;
    this.registry = registry;
    this.installed = settings.public().marketplace.installed;
  }

  async init(): Promise<void> {
    this.catalog = await this.loadCatalog();
    await this.activatePlugins();
    log.info('marketplace', `catalog ${this.catalog.length} · installed ${this.installed.length}`);
  }

  private async loadCatalog(): Promise<CatalogItem[]> {
    const candidates = [
      path.join(app.getAppPath(), 'resources', 'catalog', 'catalog.json'),
      path.join(process.resourcesPath ?? '', 'app.asar', 'resources', 'catalog', 'catalog.json'),
      path.join(__dirname, '../../resources/catalog/catalog.json'),
    ];
    for (const candidate of candidates) {
      try {
        const raw = await fs.readFile(candidate, 'utf8');
        const parsed = JSON.parse(raw) as CatalogItem[];
        return parsed;
      } catch {
        /* try next */
      }
    }
    log.warn('marketplace', 'catalog.json not found; marketplace disabled');
    return [];
  }

  list(query?: string, kind?: string): CatalogItem[] {
    let items = this.catalog;
    if (kind && kind !== 'all') items = items.filter((i) => i.kind === kind);
    if (query && query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.tagline.toLowerCase().includes(q) ||
          i.tags.some((t) => t.includes(q)) ||
          i.category.toLowerCase().includes(q),
      );
    }
    return [...items].sort((a, b) => Number(b.featured ?? false) - Number(a.featured ?? false) || b.installs - a.installs);
  }

  installedList(): InstalledItem[] {
    return [...this.installed].sort((a, b) => (a.installedAt < b.installedAt ? 1 : -1));
  }

  async install(id: string): Promise<InstalledItem[]> {
    const item = this.catalog.find((c) => c.id === id);
    if (!item) throw new Error(`Unknown marketplace item: ${id}`);
    if (this.installed.some((i) => i.id === id)) return this.installedList();

    let storedPath: string | undefined;
    if (item.kind === 'skill') {
      const dir = path.join(Paths.skills, item.id);
      await ensureDir(dir);
      storedPath = path.join(dir, 'SKILL.md');
      await fs.writeFile(storedPath, item.content, 'utf8');
      await fs.writeFile(
        path.join(dir, 'manifest.json'),
        JSON.stringify({ id: item.id, name: item.name, version: item.version, description: item.tagline, tags: item.tags }, null, 2),
        'utf8',
      );
    } else if (item.kind === 'plugin') {
      const dir = path.join(Paths.plugins, item.id);
      await ensureDir(dir);
      storedPath = path.join(dir, 'plugin.json');
      await fs.writeFile(storedPath, JSON.stringify({ ...item }, null, 2), 'utf8');
    } else if (item.kind === 'agent') {
      const dir = path.join(Paths.plugins, item.id);
      await ensureDir(dir);
      storedPath = path.join(dir, 'agent.json');
      await fs.writeFile(storedPath, JSON.stringify({ ...item }, null, 2), 'utf8');
      this.installAgent(item);
    }

    const record: InstalledItem = {
      id: item.id,
      kind: item.kind,
      name: item.name,
      version: item.version,
      installedAt: nowIso(),
      enabled: true,
      path: storedPath,
      tools: item.tools?.map((t) => t.name),
      permissions: item.permissions,
    };
    this.installed.push(record);
    this.persist();
    await this.activatePlugins();
    return this.installedList();
  }

  async uninstall(id: string): Promise<InstalledItem[]> {
    const item = this.installed.find((i) => i.id === id);
    if (!item) return this.installedList();
    this.installed = this.installed.filter((i) => i.id !== id);
    this.persist();
    try {
      if (item.path) await fs.rm(path.dirname(item.path), { recursive: true, force: true });
    } catch (error) {
      log.warn('marketplace', 'cleanup failed', error);
    }
    await this.activatePlugins();
    return this.installedList();
  }

  async toggle(id: string, enabled: boolean): Promise<InstalledItem[]> {
    this.installed = this.installed.map((i) => (i.id === id ? { ...i, enabled } : i));
    this.persist();
    await this.activatePlugins();
    return this.installedList();
  }

  private installAgent(item: CatalogItem): void {
    try {
      const parsed = JSON.parse(item.content) as { systemPrompt: string; temperature?: number; maxSteps?: number; tools?: string[]; color?: string; icon?: string };
      const current = this.settings.public();
      if (current.agents.some((a) => a.id === item.id)) return;
      this.settings.saveAgent({
        id: item.id,
        name: item.name,
        description: item.tagline,
        systemPrompt: parsed.systemPrompt,
        temperature: parsed.temperature ?? 0.3,
        maxSteps: parsed.maxSteps ?? 24,
        tools: parsed.tools ?? 'all',
        color: parsed.color ?? item.accent,
        icon: parsed.icon ?? 'bot',
      });
    } catch (error) {
      log.warn('marketplace', 'agent manifest invalid', error);
    }
  }

  private persist(): void {
    const current = this.settings.public();
    this.settings.saveMarketplace({ ...current.marketplace, installed: this.installed });
  }

  /** Rebuild plugin-contributed tools from installed, enabled plugins. */
  async activatePlugins(): Promise<void> {
    const descriptors: ToolDescriptor[] = [];
    const handlers: Record<string, (args: Record<string, unknown>) => Promise<{ ok: boolean; output: string }>> = {};

    for (const record of this.installed) {
      if (record.kind !== 'plugin' || !record.enabled) continue;
      const item = this.catalog.find((c) => c.id === record.id);
      if (!item?.tools?.length) continue;
      for (const tool of item.tools) {
        const fullName = `${record.id}.${tool.name}`;
        descriptors.push({
          name: fullName,
          title: tool.name,
          description: tool.description,
          category: 'marketplace',
          danger: 'medium',
          parameters: tool.parameters,
          source: 'plugin',
          sourceId: record.id,
        });
        handlers[fullName] = async (args) => {
          const value = (item.entry?.value ?? '').replace(/\{(\w+)\}/g, (_m, key: string) => {
            if (key === 'cwd') return this.settings.public().workspaceRoot;
            const val = (args as Record<string, unknown>)[key];
            return val === undefined ? '' : String(val);
          });
          return runCommand(value, JSON.stringify(args), fullName);
        };
      }
    }
    this.registry.registerExternal(descriptors, handlers, 'plugin');
  }

  async listSkills(): Promise<{ id: string; name: string; description: string }[]> {
    const skills = this.installed.filter((i) => i.kind === 'skill' && i.enabled);
    const out: { id: string; name: string; description: string }[] = [];
    for (const skill of skills) {
      const item = this.catalog.find((c) => c.id === skill.id);
      out.push({ id: skill.id, name: skill.name, description: item?.tagline ?? skill.name });
    }
    return out;
  }

  async readSkill(id: string): Promise<string> {
    const file = path.join(Paths.skills, id, 'SKILL.md');
    if (!fsSync.existsSync(file)) throw new Error(`Skill ${id} is not installed`);
    return fs.readFile(file, 'utf8');
  }

  /** Compact skill index injected into every system prompt. */
  skillPromptBlock(): string {
    const skills = this.installed.filter((i) => i.kind === 'skill' && i.enabled);
    if (!skills.length) return '';
    const lines = skills.map((s) => {
      const item = this.catalog.find((c) => c.id === s.id);
      return `- ${s.name} (${s.id}): ${item?.tagline ?? ''} — call skills.read for the full procedure.`;
    });
    return `\n\n## Installed skills\n${lines.join('\n')}`;
  }
}

function runCommand(command: string, argsJson: string, toolName: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const shell = isWin ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
    const shellArgs = isWin ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command] : ['-lc', command];
    const child = spawn(shell, shellArgs, {
      windowsHide: true,
      env: { ...process.env, NEURO_TOOL: toolName, NEURO_ARGS: argsJson, ELECTRON_RUN_AS_NODE: undefined as unknown as string },
    });
    let output = '';
    child.stdout.on('data', (d: Buffer) => (output += d.toString('utf8')));
    child.stderr.on('data', (d: Buffer) => (output += d.toString('utf8')));
    const timer = setTimeout(() => child.kill(), 60_000);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, output: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, output: output.slice(0, 30_000) || `(exit ${code})` });
    });
  });
}
