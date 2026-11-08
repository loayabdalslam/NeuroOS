/**
 * The typed IPC contract. Both the kernel and the renderer compile against this
 * map, so adding a capability is a single-file change and cannot drift.
 */
import type {
  AgentConfig,
  AgentEvent,
  AppInfo,
  BrainAnswer,
  BrainCaptureInput,
  BrainGraph,
  BrainHit,
  BrainNode,
  BrainProfile,
  BrainStats,
  CatalogItem,
  ChatSession,
  ChatSessionFull,
  Composition,
  CompositionRun,
  ComposioAccountInfo,
  ComposioStatus,
  ComposioTool,
  ComposioToolkitInfo,
  ConnectionProbe,
  FileStat,
  FsEntry,
  ID,
  InstalledItem,
  InstalledTheme,
  KernelStatus,
  LaunchedApp,
  MailMessage,
  MailPeer,
  MailStatus,
  ModelInfo,
  NodeTypeSpec,
  Notebook,
  NotebookCell,
  Note,
  PageInstance,
  PluginRecord,
  PluginProviderEntry,
  ProviderConfig,
  SearchHit,
  SiteManifest,
  Settings,
  Space,
  SystemStats,
  TerminalInfo,
  ToastPayload,
  ToolDescriptor,
  ToolInvocation,
  WebPeer,
  WebPublishFile,
  WebPublishResult,
  WebStats,
  WindowInfo,
  Workflow,
  WorkflowRun,
  WorkspaceInfo,
} from './types';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K];
};

export interface IpcMap {
  /* kernel & system */
  'system.info': { params: void; result: AppInfo };
  'system.stats': { params: void; result: SystemStats };
  'system.kernel': { params: void; result: KernelStatus };
  'system.openExternal': { params: { url: string }; result: { ok: boolean } };
  'system.showItemInFolder': { params: { path: string }; result: void };
  'system.pickDirectory': { params: { title?: string } | void; result: { path: string | null } };
  'system.pickFiles': { params: { multiple?: boolean } | void; result: { paths: string[] } };
  'system.readDataUrl': {
    params: { path: string };
    result: { dataUrl: string; mime: string; name: string; size: number };
  };
  'system.clipboardRead': { params: void; result: { text: string } };
  'system.clipboardWrite': { params: { text: string }; result: void };
  'system.screenshot': { params: { mode?: 'screen' | 'window' } | void; result: { path: string; dataUrl: string } };
  'system.launchApp': { params: { command: string; args?: string[] }; result: LaunchedApp };
  'system.windows': { params: void; result: WindowInfo[] };
  'system.focusWindow': { params: { title: string }; result: { ok: boolean } };
  'system.killProcess': { params: { pid: number }; result: { ok: boolean } };
  'system.volume': { params: { delta: number }; result: { ok: boolean; level?: number } };
  'system.env': { params: void; result: { shell: string; home: string; cwd: string; path: string } };
  'system.notify': { params: { title: string; body: string }; result: void };

  /* settings */
  'settings.get': { params: void; result: Settings };
  'settings.patch': { params: DeepPartial<Settings>; result: Settings };
  'settings.reset': { params: void; result: Settings };
  'settings.export': { params: void; result: { path: string | null } };
  'settings.import': { params: void; result: Settings | null };

  /* providers */
  'providers.list': { params: void; result: ProviderConfig[] };
  'providers.save': { params: ProviderConfig; result: ProviderConfig[] };
  'providers.remove': { params: { id: ID }; result: ProviderConfig[] };
  'providers.probe': { params: { id: ID }; result: ConnectionProbe };
  'providers.probeDraft': { params: ProviderConfig; result: ConnectionProbe };
  'providers.discoverModels': { params: { kind: string; baseUrl: string; apiKey: string }; result: ModelInfo[] };

  /* agents */
  'agents.list': { params: void; result: AgentConfig[] };
  'agents.save': { params: AgentConfig; result: AgentConfig[] };
  'agents.remove': { params: { id: ID }; result: AgentConfig[] };

  /* chat */
  'chat.sessions': { params: void; result: ChatSession[] };
  'chat.session': { params: { id: ID }; result: ChatSessionFull };
  'chat.create': {
    params: { title?: string; providerId?: ID; model?: string; spaceId?: ID; agentId?: ID; systemPrompt?: string };
    result: ChatSessionFull;
  };
  'chat.send': {
    params: { sessionId: ID; text: string; attachments?: unknown[] };
    result: { ok: boolean; messageId: ID };
  };
  'chat.cancel': { params: { sessionId: ID }; result: { ok: boolean } };
  'chat.regenerate': { params: { sessionId: ID }; result: { ok: boolean } };
  'chat.patch': { params: { id: ID } & Partial<ChatSession>; result: ChatSession };
  'chat.delete': { params: { id: ID }; result: { ok: boolean } };
  'chat.approve': { params: { callId: string; approve: boolean; always?: boolean }; result: { ok: boolean } };
  'chat.export': { params: { sessionId: ID; format: 'md' | 'json' }; result: { path: string | null } };

  /* tools */
  'tools.list': { params: void; result: ToolDescriptor[] };
  'tools.run': { params: { name: string; args: Record<string, unknown> }; result: ToolInvocation };
  'tools.policies': { params: void; result: Record<string, string> };

  /* terminal */
  'terminal.list': { params: void; result: TerminalInfo[] };
  'terminal.create': {
    params: { cwd?: string; shell?: string; cols?: number; rows?: number; title?: string };
    result: TerminalInfo;
  };
  'terminal.write': { params: { id: ID; data: string }; result: { ok: boolean } };
  'terminal.resize': { params: { id: ID; cols: number; rows: number }; result: { ok: boolean } };
  'terminal.kill': { params: { id: ID }; result: { ok: boolean } };
  'terminal.buffer': { params: { id: ID }; result: { data: string } };
  'terminal.shells': { params: void; result: { shells: { name: string; path: string }[]; default: string; pty: boolean } };

  /* workspace */
  'fs.list': { params: { path: string; showHidden?: boolean }; result: FsEntry[] };
  'fs.read': { params: { path: string }; result: { content: string; stat: FileStat } };
  'fs.write': { params: { path: string; content: string }; result: { ok: boolean; stat: FileStat } };
  'fs.mkdir': { params: { path: string }; result: { ok: boolean } };
  'fs.rename': { params: { from: string; to: string }; result: { ok: boolean } };
  'fs.delete': { params: { paths: string[] }; result: { ok: boolean; deleted: number } };
  'fs.stat': { params: { path: string }; result: FileStat };
  'fs.search': { params: { root: string; query: string; maxResults?: number }; result: SearchHit[] };
  'fs.workspace': { params: { root: string }; result: WorkspaceInfo };
  'fs.reveal': { params: { path: string }; result: void };
  'fs.watch': { params: { root: string | null }; result: { ok: boolean } };

  /* spaces / notebooks / notes */
  'spaces.list': { params: void; result: Space[] };
  'spaces.save': { params: Space; result: Space[] };
  'spaces.remove': { params: { id: ID }; result: Space[] };
  'spaces.create': { params: { name: string; description?: string; emoji?: string; path?: string }; result: Space };
  'notebooks.list': { params: void; result: Notebook[] };
  'notebooks.get': { params: { id: ID }; result: Notebook };
  'notebooks.save': { params: Notebook; result: Notebook[] };
  'notebooks.remove': { params: { id: ID }; result: Notebook[] };
  'notebooks.runCell': { params: { notebookId: ID; cellId: ID }; result: NotebookCell };
  'notes.list': { params: void; result: Note[] };
  'notes.save': { params: Note; result: Note[] };
  'notes.remove': { params: { id: ID }; result: Note[] };

  /* marketplace */
  'marketplace.catalog': { params: { query?: string; kind?: string } | void; result: CatalogItem[] };
  'marketplace.installed': { params: void; result: InstalledItem[] };
  'marketplace.install': { params: { id: string }; result: InstalledItem[] };
  'marketplace.uninstall': { params: { id: string }; result: InstalledItem[] };
  'marketplace.toggle': { params: { id: string; enabled: boolean }; result: InstalledItem[] };

  /* ACP */
  'acp.connect': { params: { providerId: ID }; result: { ok: boolean; agentInfo?: unknown; message?: string } };
  'acp.disconnect': { params: { providerId: ID }; result: { ok: boolean } };
  'acp.prompt': { params: { providerId: ID; sessionId?: string; text: string }; result: { ok: boolean; message?: string } };
  'acp.cancel': { params: { providerId: ID }; result: { ok: boolean } };

  /* window & app */
  'window.minimize': { params: void; result: void };
  'window.maximize': { params: void; result: { maximized: boolean } };
  'window.close': { params: void; result: void };
  'window.devtools': { params: void; result: void };
  'app.quit': { params: void; result: void };
  'app.openDataFolder': { params: void; result: void };

  /* onboarding */
  'onboarding.complete': {
    params: {
      locale: string;
      name: string;
      role: string;
      theme: 'dark' | 'light' | 'system';
      accent: string;
      design?: string;
      surface?: string;
      workspaceRoot: string | null;
      provider?: ProviderConfig | null;
      pages?: PageInstance[];
    };
    result: Settings;
  };
  'onboarding.state': { params: void; result: { complete: boolean } };

  /* decentralized mail */
  'mail.status': { params: void; result: MailStatus };
  'mail.identityCreate': { params: { name: string }; result: MailStatus };
  'mail.messages': { params: { folder?: 'inbox' | 'sent'; limit?: number } | void; result: MailMessage[] };
  'mail.send': {
    params: { to: string; subject: string; body: string; encrypt?: boolean; replyTo?: ID };
    result: { ok: boolean; id: ID; message: string };
  };
  'mail.read': { params: { id: ID }; result: { ok: boolean } };
  'mail.delete': { params: { id: ID }; result: { ok: boolean } };
  'mail.peers': { params: void; result: MailPeer[] };
  'mail.peerAdd': { params: { host: string; port: number }; result: MailPeer[] };
  'mail.peerRemove': { params: { nodeId: string }; result: MailPeer[] };
  'mail.discovery': { params: { enabled: boolean }; result: MailStatus };
  'mail.sync': { params: void; result: { ok: boolean } };

  /* plugins */
  'plugins.list': { params: void; result: PluginRecord[] };
  'plugins.themes': { params: void; result: InstalledTheme[] };
  'plugins.providers': { params: void; result: PluginProviderEntry[] };
  'plugins.installFolder': { params: void; result: { installed: PluginRecord | null; message: string } };
  'plugins.installArchive': { params: void; result: { installed: PluginRecord | null; message: string } };
  'plugins.installUrl': { params: { url: string }; result: { installed: PluginRecord | null; message: string } };
  'plugins.installPath': { params: { path: string }; result: { installed: PluginRecord | null; message: string } };
  'plugins.uninstall': { params: { id: string }; result: PluginRecord[] };
  'plugins.toggle': { params: { id: string; enabled: boolean }; result: PluginRecord[] };
  'plugins.reload': { params: { id: string }; result: PluginRecord[] };
  'plugins.openFolder': { params: { id: string }; result: void };
  'plugins.logs': { params: { id: string }; result: string[] };
  'plugins.runCommand': { params: { pluginId: string; commandId: string }; result: { ok: boolean; output: string } };

  /* automation */
  'automation.nodeTypes': { params: void; result: NodeTypeSpec[] };
  'automation.list': { params: void; result: Workflow[] };
  'automation.get': { params: { id: ID }; result: Workflow };
  'automation.save': { params: Workflow; result: Workflow[] };
  'automation.remove': { params: { id: ID }; result: Workflow[] };
  'automation.run': { params: { id: ID; input?: string }; result: { runId: ID } };
  'automation.cancel': { params: { runId: ID }; result: { ok: boolean } };
  'automation.runs': { params: { workflowId?: ID } | void; result: WorkflowRun[] };

  /* agent composition */
  'composition.list': { params: void; result: Composition[] };
  'composition.save': { params: Composition; result: Composition[] };
  'composition.remove': { params: { id: ID }; result: Composition[] };
  'composition.run': { params: { id: ID; input: string }; result: { runId: ID } };
  'composition.runs': { params: { compositionId?: ID } | void; result: CompositionRun[] };
  'composition.cancel': { params: { runId: ID }; result: { ok: boolean } };

  /* composio integrations */
  'composio.status': { params: void; result: ComposioStatus };
  'composio.configure': { params: { apiKey?: string; baseUrl?: string; userId?: string }; result: ComposioStatus };
  'composio.sync': { params: void; result: ComposioStatus };
  'composio.tools': { params: { query?: string; toolkit?: string } | void; result: ComposioTool[] };
  'composio.search': { params: { query: string; limit?: number }; result: ComposioTool[] };
  'composio.toolkits': { params: void; result: ComposioToolkitInfo[] };
  'composio.accounts': { params: void; result: ComposioAccountInfo[] };
  'composio.connect': { params: { toolkit: string }; result: { redirectUrl: string; accountId: string } };
  'composio.toggle': { params: { slug: string; enabled: boolean }; result: ComposioStatus };
  'composio.execute': { params: { slug: string; args: Record<string, unknown> }; result: { ok: boolean; output: string; data?: unknown } };

  /* neuro web (decentralized domains + hosting) */
  'web.status': { params: void; result: WebStats };
  'web.list': { params: void; result: SiteManifest[] };
  'web.resolved': { params: void; result: SiteManifest[] };
  'web.publish': { params: { domain: string; title?: string; description?: string; files: WebPublishFile[] }; result: WebPublishResult };
  'web.publishFolder': { params: { domain: string; title?: string }; result: WebPublishResult };
  'web.unpublish': { params: { domain: string }; result: SiteManifest[] };
  'web.resolve': { params: { domain: string }; result: { manifest: SiteManifest; host: string; port: number } | null };
  'web.peers': { params: void; result: WebPeer[] };
  'web.peerAdd': { params: { host: string; port: number }; result: WebPeer[] };
  'web.peerRemove': { params: { nodeId: string }; result: WebPeer[] };
  'web.gateway': { params: void; result: { gateway: string; port: number } };

  /* brain (memory graph) */
  'brain.stats': { params: void; result: BrainStats };
  'brain.capture': { params: { items: BrainCaptureInput[] }; result: { recorded: number } };
  'brain.graph': { params: { limit?: number } | void; result: BrainGraph };
  'brain.recall': { params: { query: string; limit?: number }; result: BrainHit[] };
  'brain.ask': { params: { query: string }; result: BrainAnswer };
  'brain.timeline': { params: { limit?: number } | void; result: import('./types').BrainEventRecord[] };
  'brain.profile': { params: void; result: BrainProfile };
  'brain.forget': { params: { id: string }; result: BrainStats };
  'brain.wipe': { params: void; result: BrainStats };
  'brain.recording': { params: { enabled: boolean }; result: BrainStats };
  'brain.remember': { params: { text: string; tags?: string[] }; result: BrainNode };
}

export type IpcChannel = keyof IpcMap;
export type IpcParams<C extends IpcChannel> = IpcMap[C]['params'];
export type IpcResult<C extends IpcChannel> = IpcMap[C]['result'];

export interface EventMap {
  'agent:event': AgentEvent;
  'terminal:data': { id: ID; data: string };
  'terminal:exit': { id: ID; code: number };
  'terminal:list': TerminalInfo[];
  'fs:changed': { root: string; path: string; kind: string };
  'system:stats': SystemStats;
  'window:state': { maximized: boolean; focused: boolean; fullscreen: boolean };
  'toast': ToastPayload;
  'settings:changed': Settings;
  'marketplace:changed': InstalledItem[];
  'kernel:status': KernelStatus;
  'acp:event': { providerId: ID; sessionId?: string; event: AgentEvent };
  'tools:changed': ToolDescriptor[];
  'ui:navigate': { surface: string; params: Record<string, string> };
  'os:open': { appId: string; params?: Record<string, string> };
  'mail:event': {
    kind: 'message' | 'peer' | 'status' | 'delivery';
    message?: MailMessage;
    peer?: MailPeer;
    status?: MailStatus;
  };
  'plugins:changed': PluginRecord[];
  'web:event': { kind: string; stats?: WebStats };
  'brain:event': { kind: string; stats?: BrainStats; node?: BrainNode };
  'automation:event': {
    runId: ID;
    workflowId: ID;
    status: 'queued' | 'running' | 'ok' | 'error' | 'cancelled';
    nodeId?: ID;
    nodeStatus?: 'queued' | 'running' | 'ok' | 'error' | 'cancelled';
    message?: string;
  };
  'composition:event': {
    runId: ID;
    compositionId: ID;
    status: 'queued' | 'running' | 'ok' | 'error' | 'cancelled';
    stepId?: ID;
    output?: string;
  };
}

export type EventChannel = keyof EventMap;

export const IPC_CHANNELS = [
  'system.info',
  'system.stats',
  'system.kernel',
  'system.openExternal',
  'system.showItemInFolder',
  'system.pickDirectory',
  'system.pickFiles',
  'system.clipboardRead',
  'system.clipboardWrite',
  'system.screenshot',
  'system.launchApp',
  'system.windows',
  'system.focusWindow',
  'system.killProcess',
  'system.volume',
  'system.env',
  'system.notify',
  'settings.get',
  'settings.patch',
  'settings.reset',
  'settings.export',
  'settings.import',
  'providers.list',
  'providers.save',
  'providers.remove',
  'providers.probe',
  'providers.probeDraft',
  'providers.discoverModels',
  'agents.list',
  'agents.save',
  'agents.remove',
  'chat.sessions',
  'chat.session',
  'chat.create',
  'chat.send',
  'chat.cancel',
  'chat.regenerate',
  'chat.patch',
  'chat.delete',
  'chat.approve',
  'chat.export',
  'tools.list',
  'tools.run',
  'tools.policies',
  'terminal.list',
  'terminal.create',
  'terminal.write',
  'terminal.resize',
  'terminal.kill',
  'terminal.buffer',
  'terminal.shells',
  'fs.list',
  'fs.read',
  'fs.write',
  'fs.mkdir',
  'fs.rename',
  'fs.delete',
  'fs.stat',
  'fs.search',
  'fs.workspace',
  'fs.reveal',
  'fs.watch',
  'spaces.list',
  'spaces.save',
  'spaces.remove',
  'spaces.create',
  'notebooks.list',
  'notebooks.get',
  'notebooks.save',
  'notebooks.remove',
  'notebooks.runCell',
  'notes.list',
  'notes.save',
  'notes.remove',
  'marketplace.catalog',
  'marketplace.installed',
  'marketplace.install',
  'marketplace.uninstall',
  'marketplace.toggle',
  'acp.connect',
  'acp.disconnect',
  'acp.prompt',
  'acp.cancel',
  'window.minimize',
  'window.maximize',
  'window.close',
  'window.devtools',
  'app.quit',
  'app.openDataFolder',
  'onboarding.complete',
  'onboarding.state',
  'mail.status',
  'mail.identityCreate',
  'mail.messages',
  'mail.send',
  'mail.read',
  'mail.delete',
  'mail.peers',
  'mail.peerAdd',
  'mail.peerRemove',
  'mail.discovery',
  'mail.sync',
  'plugins.list',
  'plugins.themes',
  'plugins.providers',
  'plugins.installFolder',
  'plugins.installArchive',
  'plugins.installUrl',
  'plugins.installPath',
  'plugins.uninstall',
  'plugins.toggle',
  'plugins.reload',
  'plugins.openFolder',
  'plugins.logs',
  'plugins.runCommand',
  'automation.nodeTypes',
  'automation.list',
  'automation.get',
  'automation.save',
  'automation.remove',
  'automation.run',
  'automation.cancel',
  'automation.runs',
  'composition.list',
  'composition.save',
  'composition.remove',
  'composition.run',
  'composition.runs',
  'composition.cancel',
  'composio.status',
  'composio.configure',
  'composio.sync',
  'composio.tools',
  'composio.toolkits',
  'composio.accounts',
  'composio.connect',
  'composio.toggle',
  'composio.execute',
  'web.status',
  'web.list',
  'web.publish',
  'web.publishFolder',
  'web.unpublish',
  'web.resolve',
  'web.peers',
  'web.peerAdd',
  'web.peerRemove',
  'web.gateway',
  'brain.stats',
  'brain.capture',
  'brain.graph',
  'brain.recall',
  'brain.ask',
  'brain.timeline',
  'brain.profile',
  'brain.forget',
  'brain.wipe',
  'brain.recording',
  'brain.remember',
] as const satisfies readonly IpcChannel[];

export const EVENT_CHANNELS = [
  'agent:event',
  'terminal:data',
  'terminal:exit',
  'terminal:list',
  'fs:changed',
  'system:stats',
  'window:state',
  'toast',
  'settings:changed',
  'marketplace:changed',
  'kernel:status',
  'acp:event',
  'tools:changed',
  'ui:navigate',
  'os:open',
  'mail:event',
  'plugins:changed',
  'web:event',
  'brain:event',
  'automation:event',
  'composition:event',
] as const satisfies readonly EventChannel[];

export interface RendererBridge {
  invoke<C extends IpcChannel>(channel: C, params: IpcParams<C>): Promise<IpcResult<C>>;
  on<E extends EventChannel>(channel: E, listener: (payload: EventMap[E]) => void): () => void;
  once<E extends EventChannel>(channel: E, listener: (payload: EventMap[E]) => void): void;
  platform: NodeJS.Platform;
  versions: { electron: string; chrome: string; node: string };
}
