import os from 'node:os';
import path from 'node:path';
import type { AgentEvent, KernelStatus, ToastPayload, AnchorPin } from '@shared/types';
import type { EventChannel, EventMap } from '@shared/ipc';
import { log } from './core/ipc';
import { ensureProfileDirs, Paths } from './core/store';
import { nowIso, newId } from './core/util';
import { AgentService, ApprovalRegistry } from './services/agent.service';
import { ContentService } from './services/content.service';
import { MarketplaceService } from './services/marketplace.service';
import { SettingsService } from './services/settings.service';
import { SystemService } from './services/system.service';
import { TerminalService } from './services/terminal.service';
import { ToolRegistry, type ToolRuntime } from './services/tools';
import { WorkspaceService } from './services/workspace.service';
import { AcpClient } from './services/providers/acpClient';
import { MailService } from './services/mail.service';
import { PluginService } from './services/plugins.service';
import { CompositionService } from './services/composition.service';
import { AutomationService } from './services/automation.service';

export interface Kernel {
  settings: SettingsService;
  workspace: WorkspaceService;
  system: SystemService;
  content: ContentService;
  terminal: TerminalService;
  tools: ToolRegistry;
  marketplace: MarketplaceService;
  agent: AgentService;
  mail: MailService;
  plugins: PluginService;
  compositions: CompositionService;
  automation: AutomationService;
  approvals: ApprovalRegistry;
  emit: <E extends EventChannel>(channel: E, payload: EventMap[E]) => void;
  status: () => KernelStatus;
  acpClient: (providerId: string) => AcpClient | undefined;
  startedAt: string;
  dispose: () => Promise<void>;
}

export function createKernel(emitRaw: <E extends EventChannel>(channel: E, payload: EventMap[E]) => void): Kernel {
  const startedAt = nowIso();
  const settings = new SettingsService();
  settings.init();
  const workspace = new WorkspaceService();
  const system = new SystemService();
  const content = new ContentService();
  const approvals = new ApprovalRegistry();

  const activeAgentEvents = new Set<(event: AgentEvent) => void>();
  const emit: Kernel['emit'] = (channel, payload) => {
    emitRaw(channel, payload);
  };

  const terminal = new TerminalService(
    (id, data) => {
      // Data flows at high frequency; coalesce per animation frame on the UI.
      emitRaw('terminal:data', { id, data });
    },
    (id, code) => emitRaw('terminal:exit', { id, code }),
  );

  const late: { mail?: MailService; automation?: AutomationService; plugins?: PluginService } = {};

  const runtime = (): ToolRuntime => ({
    settings,
    workspace,
    system,
    terminal,
    content,
    cwd: () => settings.public().workspaceRoot || path.join(os.homedir(), 'Neuro Workspace'),
    searchMarketplace: async (query) =>
      marketplace.list(query).map((item) => ({ id: item.id, name: item.name, tagline: item.tagline, kind: item.kind })),
    installMarketplace: async (id) => {
      await marketplace.install(id);
      return `Installed ${id}. It is available immediately.`;
    },
    listSkills: () => marketplace.listSkills(),
    readSkill: (id) => marketplace.readSkill(id),
    ui: {
      navigate: (surface, params) => emitRaw('ui:navigate', { surface, params: params ?? {} }),
      toast: (toast: ToastPayload) => emitRaw('toast', { ...toast, id: toast.id ?? newId('toast') }),
      pin: (pin: Omit<AnchorPin, 'id' | 'order'>) => {
        const current = settings.public();
        const pins = [...current.anchor.pins, { ...pin, id: newId('pin'), order: current.anchor.pins.length }];
        settings.patch({ anchor: { pins } });
        emitRaw('settings:changed', settings.public());
      },
      openApp: (appId) => emitRaw('os:open', { appId }),
    },
    mail: {
      status: () => late.mail!.status(),
      messages: (folder, limit) => late.mail!.messages(folder, limit),
      send: (input) => late.mail!.send(input),
    },
    automation: {
      list: () => late.automation!.list(),
      run: (id, input) => late.automation!.run(id, 'agent', input),
    },
    plugins: { list: () => late.plugins!.list() },
  });

  const tools = new ToolRegistry(runtime);
  const marketplace = new MarketplaceService(settings, tools);

  let plugins: PluginService | null = null;

  const agent = new AgentService({
    settings,
    toolRegistry: tools,
    marketplace,
    content,
    terminal,
    emit: (event) => {
      emitRaw('agent:event', event);
      for (const listener of activeAgentEvents) listener(event);
    },
    approvals,
    cwd: () => settings.public().workspaceRoot || path.join(os.homedir(), 'Neuro Workspace'),
    pluginAdapter: (providerId) => plugins?.adapterFor(providerId) ?? null,
  });

  const compositions = new CompositionService({
    agent,
    emit: (event) => emitRaw('composition:event', event),
  });

  let automation: AutomationService | null = null;

  const mail = new MailService({
    vault: settings.secretVault,
    onEvent: (event) => {
      emitRaw('mail:event', event);
      if (event.kind === 'message' && event.message?.direction === 'in') automation?.notifyMail(event.message);
    },
  });

  automation = new AutomationService({
    agent,
    tools,
    mail,
    compositions,
    settings,
    hooks: {
      toast: (toast) => emitRaw('toast', { ...toast, id: toast.id ?? newId('toast') }),
      navigate: (surface, params) => emitRaw('ui:navigate', { surface, params: params ?? {} }),
    },
    emit: (event) => emitRaw('automation:event', event),
  });

  late.mail = mail;
  late.automation = automation;

  plugins = new PluginService({
    registry: tools,
    hooks: {
      toast: (toast) => emitRaw('toast', { ...toast, id: toast.id ?? newId('toast') }),
      navigate: (surface, params) => emitRaw('ui:navigate', { surface, params: params ?? {} }),
      mailSend: (input) => mail.send(input),
      agentRun: async (prompt, agentId) => (await agent.runOnce({ prompt, agentId })).text,
      cwd: () => settings.public().workspaceRoot || path.join(os.homedir(), 'Neuro Workspace'),
    },
    onChange: () => {
      emitRaw('plugins:changed', plugins?.list() ?? []);
      emitRaw('tools:changed', tools.list());
    },
  });

  late.plugins = plugins;

  const kernel: Kernel = {
    settings,
    workspace,
    system,
    content,
    terminal,
    tools,
    marketplace,
    agent,
    mail,
    plugins,
    compositions,
    automation,
    approvals,
    emit,
    startedAt,
    status: (): KernelStatus => {
      const s = settings.public();
      return {
        ready: true,
        startedAt,
        services: [
          { name: 'kernel', status: 'online' },
          { name: 'provider-bus', status: s.providers.length ? 'online' : 'degraded', detail: `${s.providers.length} providers` },
          { name: 'tool-bus', status: 'online', detail: `${tools.list().length} tools` },
          { name: 'terminal', status: 'online', detail: terminal.list().length ? `${terminal.list().length} sessions` : 'ready' },
          { name: 'marketplace', status: 'online', detail: `${marketplace.installedList().length} installed` },
          { name: 'mail', status: mail.status().listening ? 'online' : 'degraded', detail: mail.status().identity ? mail.status().identity!.address : 'no identity' },
          { name: 'plugins', status: 'online', detail: `${plugins.list().length} installed` },
          { name: 'automation', status: 'online', detail: `${automation.list().length} workflows` },
          { name: 'workspace', status: s.workspaceRoot ? 'online' : 'degraded', detail: s.workspaceRoot },
        ],
        tools: tools.list().length,
        providers: s.providers.length,
        skills: s.marketplace.installed.filter((i) => i.kind === 'skill').length,
        plugins: s.marketplace.installed.filter((i) => i.kind === 'plugin').length + plugins.list().length,
      };
    },
    acpClient: (providerId) => {
      // Access through the agent's private map via the public helper.
      return (agent as unknown as { acpClients: Map<string, AcpClient> }).acpClients.get(providerId);
    },
    dispose: async () => {
      terminal.killAll();
      workspace.dispose();
      automation?.dispose();
      await mail.dispose();
      await agent.shutdown();
    },
  };

  void (async () => {
    await ensureProfileDirs();
    await agent.init();
    await marketplace.init();
    await mail.start();
    compositions.init();
    automation!.init();
    await plugins!.init();
    const s = settings.public();
    if (s.workspaceRoot) await workspace.ensureDemoWorkspace(s.workspaceRoot).catch(() => {});
    log.info('kernel', `ready · ${tools.list().length} tools · ${s.providers.length} providers`);
  })();

  return kernel;
}

export { Paths };
