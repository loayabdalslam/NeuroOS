/**
 * Neuro OS — shared domain model.
 *
 * This module is the single source of truth for every boundary that crosses the
 * main <-> renderer split. It is intentionally framework-free so the kernel can
 * be unit-tested and reused by CLI/headless hosts in the future.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

export type ID = string;
export type ISODate = string;

export type SurfaceKind =
  | 'desktop'
  | 'chat'
  | 'workspace'
  | 'space'
  | 'notebook'
  | 'browser'
  | 'sites'
  | 'brain'
  | 'terminal'
  | 'mail'
  | 'automation'
  | 'composer'
  | 'marketplace'
  | 'settings';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ThemeDesign = 'neuro' | 'windows' | 'ubuntu' | 'ios';
export type ThemeSurface = 'standard' | 'white';
export type Density = 'comfortable' | 'compact';
export type MotionLevel = 'full' | 'reduced';
export type TaskbarPosition = 'bottom' | 'top' | 'left' | 'right';
export type AnchorSide = 'right' | 'left';
export type PermissionPolicy = 'ask' | 'auto' | 'deny';
export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom' | 'acp';

/* ------------------------------------------------------------------ */
/* Providers & models                                                  */
/* ------------------------------------------------------------------ */

export interface ModelInfo {
  id: string;
  label: string;
  contextWindow?: number;
  maxOutput?: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
  supportsReasoning?: boolean;
}

export interface AcpConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  protocolVersion?: number;
}

export interface ProviderConfig {
  id: ID;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  models: ModelInfo[];
  defaultModel: string;
  headers?: Record<string, string>;
  /** For kind === 'acp' */
  acp?: AcpConfig;
  color?: string;
  createdAt: ISODate;
  lastCheck?: { ok: boolean; at: ISODate; message: string };
}

export interface ConnectionProbe {
  ok: boolean;
  latencyMs: number;
  message: string;
  models?: string[];
}

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

export type ToolCategory =
  | 'filesystem'
  | 'shell'
  | 'network'
  | 'ui'
  | 'system'
  | 'agent'
  | 'knowledge'
  | 'marketplace';

export type ToolDanger = 'low' | 'medium' | 'high';

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  category: ToolCategory;
  danger: ToolDanger;
  /** JSON Schema for the arguments object. */
  parameters: Record<string, unknown>;
  /** Hidden tools are available to the agent but not shown in the tool browser. */
  hidden?: boolean;
  /** Requires a concrete workspace root. */
  requiresWorkspace?: boolean;
}

export interface ToolInvocation {
  id: ID;
  name: string;
  args: Record<string, unknown>;
  status: 'pending' | 'running' | 'ok' | 'error' | 'denied';
  output?: string;
  data?: unknown;
  startedAt?: ISODate;
  endedAt?: ISODate;
  durationMs?: number;
}

export interface ToolDescriptor extends ToolDef {
  source: 'builtin' | 'plugin' | 'mcp' | 'skill' | 'composio';
  sourceId?: string;
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Attachment {
  id: ID;
  kind: 'file' | 'image' | 'url' | 'space' | 'note';
  label: string;
  path?: string;
  url?: string;
  ref?: string;
  mime?: string;
  size?: number;
}

export interface ChatMessage {
  id: ID;
  role: ChatRole;
  content: string;
  reasoning?: string;
  createdAt: ISODate;
  model?: string;
  providerId?: ID;
  toolCalls?: ToolInvocation[];
  toolCallId?: string;
  attachments?: Attachment[];
  usage?: { input?: number; output?: number; total?: number };
  error?: string;
  /** Parent assistant message for tool results. */
  parentId?: ID;
}

export interface ChatSession {
  id: ID;
  title: string;
  providerId: ID;
  model: string;
  spaceId?: ID;
  agentId?: ID;
  systemPrompt?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  messageCount: number;
  pinned?: boolean;
  archived?: boolean;
  meta?: Record<string, unknown>;
}

export interface ChatSessionFull extends ChatSession {
  messages: ChatMessage[];
}

export type AgentEvent =
  | { type: 'turn_start'; sessionId: ID; messageId: ID }
  | { type: 'text_delta'; sessionId: ID; messageId: ID; delta: string }
  | { type: 'reasoning_delta'; sessionId: ID; messageId: ID; delta: string }
  | { type: 'tool_call'; sessionId: ID; messageId: ID; call: ToolInvocation }
  | { type: 'tool_result'; sessionId: ID; messageId: ID; call: ToolInvocation }
  | { type: 'usage'; sessionId: ID; messageId: ID; usage: { input?: number; output?: number; total?: number } }
  | { type: 'turn_end'; sessionId: ID; messageId: ID; reason: 'done' | 'cancelled' | 'error' | 'max_steps' }
  | { type: 'error'; sessionId: ID; message: string }
  | { type: 'status'; sessionId: ID; status: string };

/* ------------------------------------------------------------------ */
/* Workspace                                                           */
/* ------------------------------------------------------------------ */

export interface FsEntry {
  name: string;
  path: string;
  kind: 'file' | 'directory' | 'symlink';
  size: number;
  modifiedAt: ISODate;
  extension?: string;
}

export interface SearchHit {
  path: string;
  line: number;
  column: number;
  preview: string;
  matchLength: number;
}

export interface WorkspaceInfo {
  root: string;
  name: string;
  fileCount: number;
  totalBytes: number;
  git?: { branch: string; dirty: number; ahead: number; behind: number } | null;
  languages: { id: string; files: number }[];
}

export interface FileStat {
  path: string;
  size: number;
  createdAt: ISODate;
  modifiedAt: ISODate;
  isDirectory: boolean;
  binary: boolean;
  language: string;
  lines: number;
}

/* ------------------------------------------------------------------ */
/* Space / Notebook / Notes                                            */
/* ------------------------------------------------------------------ */

export interface Space {
  id: ID;
  name: string;
  description: string;
  emoji: string;
  color: string;
  path?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  pinned: boolean;
  notebookId?: ID;
  sessionIds: ID[];
  tags: string[];
}

export type CellKind = 'code' | 'markdown' | 'shell';
export type CellLanguage = 'javascript' | 'typescript' | 'python' | 'bash';

export interface NotebookCell {
  id: ID;
  kind: CellKind;
  language: CellLanguage;
  source: string;
  output?: string;
  outputKind?: 'text' | 'json' | 'error' | 'html';
  status: 'idle' | 'running' | 'ok' | 'error';
  durationMs?: number;
  updatedAt: ISODate;
}

export interface Notebook {
  id: ID;
  title: string;
  description: string;
  spaceId?: ID;
  cells: NotebookCell[];
  createdAt: ISODate;
  updatedAt: ISODate;
  kernel: 'node' | 'python' | 'auto';
}

export interface Note {
  id: ID;
  title: string;
  body: string;
  color: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  spaceId?: ID;
  pinned?: boolean;
}

/* ------------------------------------------------------------------ */
/* Terminal                                                           */
/* ------------------------------------------------------------------ */

export type TerminalStatus = 'starting' | 'running' | 'exited' | 'error';

export interface TerminalInfo {
  id: ID;
  title: string;
  cwd: string;
  shell: string;
  cols: number;
  rows: number;
  status: TerminalStatus;
  createdAt: ISODate;
  exitCode?: number;
  usingPty: boolean;
  /** Set when the terminal is owned by an ACP agent session. */
  owner?: string;
}

/* ------------------------------------------------------------------ */
/* Browser                                                             */
/* ------------------------------------------------------------------ */

export interface BrowserTab {
  id: ID;
  url: string;
  title: string;
  favicon?: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  pinned?: boolean;
  createdAt: ISODate;
}

/* ------------------------------------------------------------------ */
/* Marketplace / skills / plugins                                      */
/* ------------------------------------------------------------------ */

export type CatalogItemKind = 'skill' | 'plugin' | 'agent' | 'theme';

export interface CatalogItem {
  id: string;
  kind: CatalogItemKind;
  name: string;
  tagline: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  installs: number;
  rating: number;
  verified: boolean;
  featured?: boolean;
  icon: string;
  accent: string;
  /** For skills: the SKILL.md body. For plugins: a manifest. */
  content: string;
  permissions?: string[];
  tools?: { name: string; description: string; parameters: Record<string, unknown> }[];
  /** Optional command a plugin executes through the shell bridge. */
  entry?: { type: 'command' | 'module'; value: string };
  homepage?: string;
}

export interface InstalledItem {
  id: string;
  kind: CatalogItemKind;
  name: string;
  version: string;
  installedAt: ISODate;
  enabled: boolean;
  path?: string;
  tools?: string[];
  permissions?: string[];
}

/* ------------------------------------------------------------------ */
/* Anchors, pages, taskbar                                             */
/* ------------------------------------------------------------------ */

export type AnchorPinKind = 'chat' | 'note' | 'file' | 'space' | 'notebook' | 'link' | 'widget' | 'terminal';

export interface AnchorPin {
  id: ID;
  kind: AnchorPinKind;
  ref: string;
  label: string;
  subtitle?: string;
  color?: string;
  order: number;
  collapsed?: boolean;
  meta?: Record<string, unknown>;
}

export interface PageInstance {
  id: ID;
  surface: SurfaceKind;
  title: string;
  params: Record<string, string>;
  pinned?: boolean;
  closable?: boolean;
}

export interface TaskbarConfig {
  position: TaskbarPosition;
  size: 'sm' | 'md' | 'lg';
  pinned: string[];
  showLabels: boolean;
  autoHide: boolean;
  clock24h: boolean;
  showSystemStats: boolean;
  showLanguage: boolean;
  blur: number;
}

export interface AnchorConfig {
  enabled: boolean;
  side: AnchorSide;
  width: number;
  autoHide: boolean;
  pins: AnchorPin[];
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export interface ThemeConfig {
  mode: ThemeMode;
  design: ThemeDesign;
  surface: ThemeSurface;
  accent: 'neuro' | 'deepseek' | 'violet' | 'teal' | 'amber';
  density: Density;
  transparency: boolean;
  radius: number;
  fontScale: number;
  wallpaper: string;
  motion: MotionLevel;
  glow: boolean;
}

export interface AgentConfig {
  id: ID;
  name: string;
  description: string;
  systemPrompt: string;
  providerId?: ID;
  model?: string;
  temperature: number;
  maxSteps: number;
  tools: string[] | 'all';
  color: string;
  icon: string;
  builtin?: boolean;
}

export interface Settings {
  version: number;
  onboardingComplete: boolean;
  profile: { name: string; role: string; hue: number };
  locale: string;
  theme: ThemeConfig;
  taskbar: TaskbarConfig;
  anchor: AnchorConfig;
  pages: PageInstance[];
  providers: ProviderConfig[];
  agents: AgentConfig[];
  activeAgentId: ID;
  toolPolicies: Record<string, PermissionPolicy>;
  workspaceRoot: string;
  recentWorkspaces: string[];
  marketplace: { installed: InstalledItem[]; autoUpdate: boolean };
  window: { width: number; height: number; x?: number; y?: number; maximized: boolean };
  telemetry: boolean;
  developerMode: boolean;
  createdAt: ISODate;
}

/* ------------------------------------------------------------------ */
/* System                                                              */
/* ------------------------------------------------------------------ */

export interface SystemStats {
  cpu: number;
  memoryUsed: number;
  memoryTotal: number;
  uptime: number;
  processes: number;
  battery?: number | null;
  network: 'online' | 'offline';
  timestamp: number;
}

export interface LaunchedApp {
  pid: number;
  name: string;
  path: string;
}

export interface WindowInfo {
  title: string;
  processId: number;
  processName: string;
  handle: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface ToastPayload {
  id?: ID;
  title: string;
  message?: string;
  kind?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  action?: { label: string; event: string };
}

export interface AppInfo {
  name: string;
  version: string;
  electron: string;
  chrome: string;
  node: string;
  v8: string;
  platform: string;
  arch: string;
  userData: string;
  home: string;
  cpus: number;
  memoryTotal: number;
  gpu: string;
  ptyAvailable: boolean;
  shell: string;
}

/* ------------------------------------------------------------------ */
/* Kernel status                                                       */
/* ------------------------------------------------------------------ */

export interface KernelStatus {
  ready: boolean;
  startedAt: ISODate;
  services: { name: string; status: 'online' | 'degraded' | 'offline'; detail?: string }[];
  tools: number;
  providers: number;
  skills: number;
  plugins: number;
}

/* ------------------------------------------------------------------ */
/* Decentralized mail                                                  */
/* ------------------------------------------------------------------ */

export interface MailIdentity {
  address: string;
  nodeId: string;
  name: string;
  publicKey: string;
  createdAt: ISODate;
}

export type MailDelivery = 'queued' | 'delivered' | 'relayed' | 'failed' | 'received';
export type MailFolder = 'inbox' | 'sent';

export interface MailPeer {
  nodeId: string;
  address: string;
  name: string;
  host: string;
  port: number;
  publicKey?: string;
  encPublicKey?: string;
  lastSeen: ISODate;
  source: 'lan' | 'manual' | 'gossip';
  online: boolean;
}

export interface MailContact {
  address: string;
  name: string;
  nodeId: string;
}

export interface MailMessage {
  id: ID;
  threadId: ID;
  from: MailContact;
  to: MailContact;
  subject: string;
  body: string;
  createdAt: ISODate;
  direction: 'in' | 'out';
  read: boolean;
  encrypted: boolean;
  signed: boolean;
  verified: boolean;
  delivery: MailDelivery;
  hops: number;
  error?: string;
  replyTo?: ID;
}

export interface MailStatus {
  identity: MailIdentity | null;
  peers: MailPeer[];
  port: number;
  listening: boolean;
  discovery: boolean;
  pending: number;
  unread: number;
}

/* ------------------------------------------------------------------ */
/* Plugins                                                             */
/* ------------------------------------------------------------------ */

export type PluginPermission = 'fs' | 'shell' | 'net' | 'ui' | 'mail' | 'automation' | 'agents';

export interface PluginToolContribution {
  name: string;
  title?: string;
  description: string;
  category?: ToolCategory;
  danger?: ToolDanger;
  parameters: Record<string, unknown>;
  handler: string;
}

export interface PluginThemeContribution {
  id: string;
  name: string;
  description?: string;
  design: ThemeDesign;
  mode: 'dark' | 'light';
  surface?: ThemeSurface;
  accent?: string;
  radius?: number;
  wallpaper?: string;
  colors?: { bg: string; surface: string; accent: string; text: string };
}

export interface PluginProviderContribution {
  id: string;
  name: string;
  description?: string;
  baseUrl?: string;
  models?: string[];
  kind?: ProviderKind;
}

export interface PluginCommand {
  id: string;
  title: string;
  description?: string;
}

export interface PluginAdapterContribution {
  id: string;
  name: string;
  description?: string;
  models: string[];
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  main?: string;
  permissions?: PluginPermission[];
  contributes?: {
    tools?: PluginToolContribution[];
    themes?: PluginThemeContribution[];
    providers?: PluginProviderContribution[];
    adapters?: PluginAdapterContribution[];
    commands?: PluginCommand[];
  };
}

export interface InstalledTheme {
  id: string;
  name: string;
  description?: string;
  pluginId: string;
  design: ThemeDesign;
  mode: 'dark' | 'light';
  surface?: ThemeSurface;
  accent?: string;
  radius?: number;
  wallpaper?: string;
  colors?: { bg: string; surface: string; accent: string; text: string };
}

export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  path: string;
  enabled: boolean;
  installedAt: ISODate;
  permissionList: PluginPermission[];
  contributions: { tools: number; themes: number; providers: number; commands: number; adapters: number };
  status: 'loaded' | 'error' | 'disabled';
  error?: string;
}

export interface PluginProviderEntry {
  id: string;
  pluginId: string;
  pluginName: string;
  name: string;
  description?: string;
  baseUrl?: string;
  models: string[];
  kind: 'preset' | 'adapter';
}

/* ------------------------------------------------------------------ */
/* Automation (workflow engine)                                        */
/* ------------------------------------------------------------------ */

export type WorkflowNodeType =
  | 'trigger.manual'
  | 'trigger.schedule'
  | 'trigger.mail'
  | 'trigger.fs'
  | 'agent.run'
  | 'tool.call'
  | 'http.request'
  | 'transform.code'
  | 'condition.if'
  | 'delay.wait'
  | 'mail.send'
  | 'notify.toast'
  | 'composition.run';

export type PortName = 'main' | 'true' | 'false';

export interface WorkflowNode {
  id: ID;
  type: WorkflowNodeType;
  name: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: ID;
  from: ID;
  fromPort: PortName;
  to: ID;
}

export interface Workflow {
  id: ID;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  enabled: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type RunStatus = 'queued' | 'running' | 'ok' | 'error' | 'cancelled';

export interface RunStep {
  nodeId: ID;
  name: string;
  type: WorkflowNodeType;
  status: RunStatus;
  startedAt: ISODate;
  durationMs?: number;
  output?: string;
  error?: string;
}

export interface WorkflowRun {
  id: ID;
  workflowId: ID;
  workflowName: string;
  status: RunStatus;
  startedAt: ISODate;
  endedAt?: ISODate;
  trigger: string;
  steps: RunStep[];
  error?: string;
}

export interface NodeField {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'number' | 'select' | 'code' | 'checkbox';
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  default?: string | number | boolean;
}

export interface NodeTypeSpec {
  type: WorkflowNodeType;
  label: string;
  category: 'trigger' | 'agent' | 'action' | 'logic';
  icon: string;
  description: string;
  fields: NodeField[];
  outputs: PortName[];
}

/* ------------------------------------------------------------------ */
/* Agent composition                                                   */
/* ------------------------------------------------------------------ */

export interface CompositionStep {
  id: ID;
  name: string;
  agentId: string;
  prompt: string;
  usePrevious: boolean;
}

export interface Composition {
  id: ID;
  name: string;
  description: string;
  steps: CompositionStep[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface CompositionRun {
  id: ID;
  compositionId: ID;
  compositionName: string;
  status: RunStatus;
  startedAt: ISODate;
  endedAt?: ISODate;
  steps: { stepId: ID; name: string; status: RunStatus; output: string; error?: string }[];
}

/* ------------------------------------------------------------------ */
/* Window manager (renderer-side OS simulation)                        */
/* ------------------------------------------------------------------ */

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OsWindow {
  id: ID;
  appId: string;
  title: string;
  icon: string;
  accent: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
  restore?: WindowBounds;
  resizable: boolean;
  createdAt: ISODate;
}

export interface ComposioToolkitInfo {
  slug: string;
  name: string;
  description?: string;
  logo?: string;
  tools: number;
  connected: boolean;
}

export interface ComposioTool {
  slug: string;
  name: string;
  description: string;
  toolkit: string;
  toolkitName: string;
  parameters: Record<string, unknown>;
  enabled: boolean;
}

export interface ComposioAccountInfo {
  id: string;
  toolkit: string;
  status: string;
  alias?: string;
}

export interface ComposioStatus {
  configured: boolean;
  apiKeySet: boolean;
  userId: string;
  baseUrl: string;
  tools: number;
  toolkits: number;
  connected: number;
  enabled: number;
  lastSync?: ISODate;
  error?: string;
}

export interface SiteFileInfo {
  path: string;
  hash: string;
  size: number;
  type: string;
}

export interface SiteManifest {
  version: 1;
  id: string;
  domain: string;
  title: string;
  description: string;
  nodeId: string;
  publicKey: string;
  publishedAt: string;
  updatedAt: string;
  entry: string;
  files: SiteFileInfo[];
  signature: string;
}

export interface WebPeer {
  nodeId: string;
  host: string;
  port: number;
  name: string;
  lastSeen: string;
  source: 'lan' | 'manual' | 'gossip';
}

export interface WebStats {
  sites: number;
  peers: number;
  online: number;
  hits: number;
  bytes: number;
  port: number;
  nodeId: string;
  gateway: string;
  publicKey: string;
}

export interface WebPublishFile {
  path: string;
  data: string;
}

export interface WebPublishResult {
  ok: boolean;
  manifest?: SiteManifest;
  error?: string;
}

export type BrainNodeKind =
  | 'app'
  | 'page'
  | 'action'
  | 'person'
  | 'site'
  | 'tool'
  | 'workflow'
  | 'topic'
  | 'memory';

export interface BrainNode {
  id: string;
  kind: BrainNodeKind;
  label: string;
  detail?: string;
  surface?: string;
  tags: string[];
  weight: number;
  salience: number;
  at: string;
  lastAt: string;
}

export interface BrainEdge {
  id: string;
  from: string;
  to: string;
  relation: 'used' | 'visited' | 'interacted' | 'mentioned' | 'sent_to' | 'published' | 'ran' | 'related';
  weight: number;
  at: string;
  lastAt: string;
}

export interface BrainEventRecord {
  id: string;
  kind: string;
  label: string;
  surface?: string;
  app?: string;
  detail?: string;
  at: string;
  nodeId?: string;
}

export interface BrainHit {
  node: BrainNode;
  score: number;
  why: string;
  related: { label: string; relation: string }[];
}

export interface BrainProfile {
  topApps: { label: string; count: number }[];
  topActions: { label: string; count: number }[];
  topTopics: { label: string; count: number }[];
  collaborators: { label: string; count: number }[];
  sites: { label: string; count: number }[];
  hours: number[];
  totalEvents: number;
  firstAt?: string;
}

export interface BrainStats {
  nodes: number;
  edges: number;
  events: number;
  today: number;
  recording: boolean;
  indexed: number;
  storageBytes: number;
  firstAt?: string;
}

export interface BrainCaptureInput {
  kind: string;
  label: string;
  surface?: string;
  app?: string;
  detail?: string;
  tags?: string[];
  meta?: Record<string, string | number | boolean>;
}

export interface BrainAnswer {
  text: string;
  hits: BrainHit[];
}

export interface BrainGraph {
  nodes: BrainNode[];
  edges: BrainEdge[];
}
