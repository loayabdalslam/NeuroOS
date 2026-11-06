/**
 * The typed IPC contract. Both the kernel and the renderer compile against this
 * map, so adding a capability is a single-file change and cannot drift.
 */
import type {
  AgentConfig,
  AgentEvent,
  AppInfo,
  CatalogItem,
  ChatSession,
  ChatSessionFull,
  ConnectionProbe,
  FileStat,
  FsEntry,
  ID,
  InstalledItem,
  KernelStatus,
  LaunchedApp,
  ModelInfo,
  Notebook,
  NotebookCell,
  Note,
  PageInstance,
  ProviderConfig,
  SearchHit,
  Settings,
  Space,
  SystemStats,
  TerminalInfo,
  ToastPayload,
  ToolDescriptor,
  ToolInvocation,
  WindowInfo,
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
] as const satisfies readonly EventChannel[];

export interface RendererBridge {
  invoke<C extends IpcChannel>(channel: C, params: IpcParams<C>): Promise<IpcResult<C>>;
  on<E extends EventChannel>(channel: E, listener: (payload: EventMap[E]) => void): () => void;
  once<E extends EventChannel>(channel: E, listener: (payload: EventMap[E]) => void): void;
  platform: NodeJS.Platform;
  versions: { electron: string; chrome: string; node: string };
}
