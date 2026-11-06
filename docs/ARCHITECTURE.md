# Architecture

> Design goal: a desktop environment small enough to reason about in one sitting, with seams that
> stay clean as it grows â€” new surface, new tool, new provider, new theme, without touching the core.

## 1. Process model

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ main process (Node 20)                                             â”‚
â”‚  Â· owns the filesystem, shell, network, windows, secrets           â”‚
â”‚  Â· runs the agent loop and the tool bus                            â”‚
â”‚  Â· single source of truth for settings and sessions                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–²â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                â”‚ ipcMain.handle (request)      â”‚ webContents.send (events)
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ preload (contextBridge, sandbox: false, contextIsolation: true)    â”‚
â”‚  Â· window.neuro.invoke(channel, params) â†’ Promise<result>          â”‚
â”‚  Â· window.neuro.on(channel, listener) â†’ unsubscribe                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–²â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                â”‚ window.neuro                  â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ renderer (React 18, no Node)                                       â”‚
â”‚  Â· nine surfaces, shell chrome, zustand stores                     â”‚
â”‚  Â· never touches disk, network or child processes directly         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

Hard rules:

1. The renderer has **no** `require`, no `fs`, no `child_process`. Everything is IPC.
2. Main never imports from `renderer/`. Shared code lives in `src/shared/`.
3. Wire types live in `src/shared/ipc.ts`; nothing else defines channel names.

## 2. The typed contract

```ts
export interface IpcMap {
  'chat.send': { params: { sessionId: ID; text: string }; result: { ok: boolean; messageId: ID } };
  'fs.read':   { params: { path: string }; result: { content: string; stat: FileStat } };
  // â€¦
}

export interface EventMap {
  'agent:event': AgentEvent;
  'terminal:data': { id: ID; data: string };
  // â€¦
}
```

- `IpcRouter.register(map)` accepts a partial map of handlers; the compiler enforces the payload and
  return type of every channel.
- `attach()` wraps each handler in a try/catch that logs and rethrows a clean message.
- Events are broadcast through one method (`router.emit`) with an allowlisted channel name.
- Adding a capability = add the channel, add a handler, call it. No registry to update.

Failure isolation: every surface renders inside a `SurfaceBoundary`. A crash in one surface shows a
retry card and leaves the shell (and your other work) alive â€” verified by the webview incident that
motivated it.

## 3. Kernel services

`createKernel(emit)` constructs the services and returns a `Kernel` object. There is no global
singleton and no service locator; dependencies are passed explicitly.

| Service | Responsibility | Owns |
| --- | --- | --- |
| `SettingsService` | Settings document, provider key extraction, onboarding | `state/settings.json` + vault |
| `WorkspaceService` | FS read/write/list/search/stat, demo seeding, watch | none (stateless) |
| `TerminalService` | ConPTY sessions, resize, buffer, fallback shell | live processes |
| `ContentService` | Spaces, notebooks + kernel, notes, agent memory | `state/content.json` |
| `ToolRegistry` | Tool definitions, policies, external (plugin) tools | in-memory catalog |
| `MarketplaceService` | Catalog, install/uninstall, plugin activation, skills | `skills/`, `plugins/` |
| `AgentService` | Sessions, streaming turns, tool loop, approvals, ACP | `sessions/*.json` |
| `ApprovalRegistry` | In-flight approval promises keyed by call id | in-memory |
| `SystemService` | OS info, screenshots, windows, volume, clipboard | none |
| `MailService` | P2P identities, envelopes, HTTP delivery, UDP discovery, relay | `state/mail.json` + vault |
| `PluginService` | Manifest validation, install sources, vm host, contributions | `plugins/` |
| `AutomationService` | Workflow graph, execution, triggers, run history | `state/automation.json` |
| `CompositionService` | Agent pipelines and their runs | `state/compositions.json` |
| `WebService` | Decentralized domains, signed site manifests, blob store, peer replication, gateway | `state/web.json` + `state/web-blobs` |
| `ComposioService` | Catalog sync, connected accounts, action execution, tool registration | `state/composio.json` + vault |

Startup order matters and is explicit in `kernel.ts`:

```
settings.init() â†’ terminal â†’ tools(registry) â†’ marketplace â†’ agent â†’ mail â†’ compositions
â†’ automation â†’ plugins â†’ ensureProfileDirs()
```

The kernel exposes `status()` â€” the same data the Settings/Desktop surfaces render â€” so health is
observable rather than guessed.

## 4. Persistence

Deliberately boring and inspectable. Everything is JSON on disk under the profile directory
(`%APPDATA%/Neuro OS` on Windows).

```
state/
  settings.json      # user configuration (no secrets)
  content.json       # spaces, notebooks, notes, memory
  vault.json         # encrypted provider keys (base64 of DPAPI blob)
sessions/
  index.json         # metadata for the session list
  <id>.json          # full transcript
skills/<id>/SKILL.md
plugins/<id>/plugin.json
logs/neuro.log
```

- `JsonStore` keeps a memory copy, coalesces writes (60 ms), and persists with **write-temp + rename**
  so a crash can never truncate state.
- Sessions are append-oriented documents: the index stays small, transcripts grow independently.
- No database, no migrations framework: `settings.version` plus `deepMerge` defaults handles upgrades.

Why: users can read, diff, back up and repair their own OS state with a text editor.

## 5. The agent loop

`AgentService.send()` appends the user message and an assistant placeholder, then runs a turn:

```
send()
 â”œâ”€ build system prompt (agent prompt + environment + skills + recalled memory)
 â”œâ”€ for step in 1..maxSteps:
 â”‚    â”œâ”€ adapter.stream(request, signal)          â† SSE from the provider
 â”‚    â”‚    â”œâ”€ text / reasoning deltas  â†’ AgentEvent.text_delta / reasoning_delta
 â”‚    â”‚    â””â”€ tool_call deltas         â†’ accumulated per index
 â”‚    â”œâ”€ no tool calls? â†’ finish
 â”‚    â””â”€ for each call:
 â”‚         â”œâ”€ policy = registry.policyFor(name)
 â”‚         â”œâ”€ ask  â†’ emit tool_call(pending) â†’ await ApprovalRegistry â†’ denied if refused
 â”‚         â”œâ”€ deny â†’ status 'denied'
 â”‚         â””â”€ auto â†’ registry.invoke(name, args) â†’ emit tool_result
 â”‚         â””â”€ append tool message â†’ next model step
 â””â”€ persist transcript, emit turn_end(reason)
```

Key properties:

- **Cancellation** is an `AbortController` per session; it aborts the HTTP stream and resolves pending
  approvals as denied.
- **Tool results are messages**, so the model sees exactly what happened and can recover.
- **Policies are read per call**, so changing a policy in Settings affects the next call immediately.
- **ACP providers bypass the HTTP adapter**: `runAcpTurn` translates `session/update` notifications
  into the same `AgentEvent` stream, so the UI is identical for local and protocol agents.

## 6. Provider adapters

One interface, three implementations:

```ts
interface ProviderAdapter {
  stream(req: LlmRequest, signal: AbortSignal): AsyncGenerator<LlmStreamEvent>;
  listModels(): Promise<ModelInfo[]>;
  probe(): Promise<ConnectionProbe>;
}
```

- `OpenAiCompatibleAdapter` covers OpenAI, DeepSeek, Groq, OpenRouter, xAI, Mistral, Together, Qwen,
  LM Studio and Ollama. It also reads `reasoning_content` (DeepSeek) and emits `reasoning` deltas.
- `AnthropicAdapter` converts messages to content blocks, merges consecutive same-role turns (the API
  requires alternation), streams `text_delta` / `thinking_delta` / `input_json_delta`, and assembles
  tool inputs from partial JSON.
- `GeminiAdapter` maps to `contents` + `systemInstruction` + `functionDeclarations` and reads
  `functionCall` parts.

All three normalize tool calls into `{ id, name, args }`, so the loop is provider-agnostic.

## 7. Tools and permissions

```ts
interface ToolDef {
  name: string; title: string; description: string;
  category: 'filesystem' | 'shell' | 'network' | 'ui' | 'system' | 'agent' | 'knowledge' | 'marketplace';
  danger: 'low' | 'medium' | 'high';
  parameters: JSONSchema;
}
```

- Definitions are JSON Schema, passed verbatim to providers (Gemini identifiers are sanitized).
- `ToolRegistry.invoke()` normalizes results into a `ToolInvocation` with status, timing and output.
- Plugins register tools through `registerExternal(descriptors, handlers, sourceId)`; disabling a
  plugin removes its tools from the catalog atomically.
- Permission resolution: `settings.toolPolicies[name] ?? settings.toolPolicies.default ?? 'ask'`.

## 8. Marketplace

The catalog is declarative JSON (`resources/catalog/catalog.json`) with four kinds:

| Kind | Install effect |
| --- | --- |
| `skill` | writes `skills/<id>/SKILL.md` + manifest; the skill index is appended to every system prompt, and the agent can read the full procedure with `skills.read`. |
| `plugin` | writes `plugins/<id>/plugin.json`; its tools are registered with command handlers that run through PowerShell with `NEURO_TOOL` / `NEURO_ARGS` environment variables. |
| `agent` | writes a manifest **and** adds an `AgentConfig` with its own system prompt and tool allowlist. |
| `theme` | applies an accent/design preset. |

Installing is idempotent, uninstalling deletes the directory and deactivates tools, toggling rebuilds
the tool catalog.

## 9. Renderer

### Shell

```
TitleBar          brand Â· page tabs Â· command button Â· window controls
 â”œ Dock           primary rail (9 surfaces + anchor + avatar + collapse)
 â”œ main           active surface, keyed by page id â†’ fresh state per tab
 â”œ AnchorRail     pins, active agent, live stats, notes
 â”” Taskbar        pinned apps, running pages, CPU/RAM, language, clock, tray
CommandPalette Â· ToastHost Â· modals
```

Pages (`PageInstance`) are persisted in settings. Navigating to a surface activates an existing page
unless `forceNew` is set (used for chat sessions and browser URLs), which gives real tab semantics
with per-page component state.

### State

- `useAppStore` â€” settings, stats, kernel status, tools, pages, toasts, window state.
- `useChatStore` â€” sessions, active transcript, streaming flags, approvals; consumes `agent:event`.
- Surfaces keep local state for drafts/UI, and write through IPC for anything durable.

No Redux, no API cache library: the event stream already is the cache.

### Theming

`tokens.css` defines the DSH palette (`--dsw-*`), a semantic layer (`--n-*`), then four design
languages and a pure-white surface, all as attribute selectors on `:root`:

```html
<html data-theme="dark" data-design="windows" data-surface="standard"
      data-accent="deepseek" data-wallpaper="mica" data-density="comfortable">
```

Switching a preset flips attributes; CSS variables cascade to every component with no re-render
cost beyond one React pass. Chrome details (square window buttons for Windows, aubergine headerbar
for Ubuntu, pill controls for iOS) are scoped in `shell.css` under `[data-design=â€¦]`.

### Internationalization

- Flat dictionaries keyed by dotted names, 14 locales, English fallback.
- `lang` and `dir` are set on `<html>`; RTL is achieved with logical layout, not mirrored CSS.
- Flags are hand-drawn SVG components (Windows does not render emoji flags).

## 10. Desktop shell & window manager

The shell has two navigation modes that share one page model:

1. **Full-page surfaces** â€” the titlebar tabs (`PageInstance` in settings). Dock clicks open a tab.
2. **Desktop windows** â€” the Desktop page renders a simulated OS: icons, windows, start menu.

`useWindowStore` (renderer-only) owns `windows`, `focusedId`, `zTop`, `startOpen`, `locked`. Each
`OsWindow` records app id, bounds, z-order, minimized/maximized and a restore rectangle.
`WindowFrame` implements pointer-based drag and 8-way resize, edge snapping, double-click maximize,
focus-on-click and the chrome buttons. `AppContent` maps an `appId` to the same surface component
used by the full-page route, so every app works in both modes with no duplicated code.

The taskbar reads the window store (running apps, focus, minimize) and the Start menu opens windows
by id. `os:open` events let the agent open apps (`desktop.open` tool, automations, plugins).
Window layout is deliberately ephemeral: it is UI state, not durable OS state, so it never crosses
IPC.

## 11. Decentralized mail

There is no mail server. Each `MailService` is a node:

- **Identity**: Ed25519 signing key + X25519 encryption key, generated locally; address is
  `slug(name)@<sha256(publicKey)[0..16]>.neuro`.
- **Envelope**: stable-serialised JSON, signed over everything except the signature; payload is
  JSON `{subject, body}` encrypted with X25519 ECDH (ephemeral per message) â†’ HKDF-SHA256 â†’
  AES-256-GCM.
- **Transport**: an HTTP server with `/mail/hello`, `/mail/deliver`, `/mail/peers`; peers POST
  envelopes directly.
- **Discovery**: UDP beacons on `47811` (broadcast + multicast) plus manual `host:port` peers and
  gossip-learned senders.
- **Reliability**: deliveries are queued and retried every 12 s; intermediate nodes forward with
  `ttl - 1` and a hop list to prevent loops.
- **Events**: `mail:event` streams new messages/peer/status changes to the renderer; the same hook
  feeds the automation `trigger.mail`.

Full protocol notes: [MAIL.md](MAIL.md).

## 12. Plugin host

`PluginService` is a package manager and a runtime:

1. **Install** from folder, `.zip` (PowerShell `Expand-Archive`/`unzip`) or URL; the manifest is
   validated before anything is copied.
2. **Load** by reading `manifest.main` and executing it inside a `vm` context with only `module`,
   `exports`, a permissioned `neuro` object and safe globals. No `require`, `process` or ambient
   `fetch`.
3. **Register** contributions: tools go into `ToolRegistry.setSource('plugin:<id>', â€¦)`, themes and
   provider presets into the service, streaming adapters into an in-memory map consumed by
   `AgentService` through the `pluginAdapter` hook.
4. **Unload** removes the tool source and the contributions atomically; reload re-runs the entry.

Every plugin records status, errors, contribution counts and an in-memory log ring. Docs:
[PLUGINS.md](PLUGINS.md).

## 13. Automation & composition

Automation is a graph interpreter over an `Item = { text, json }`:

- start nodes are the triggers; each executor returns `{ item, port }`;
- edges from that port are enqueued; `condition.if` selects `true`/`false`;
- runs are persisted with per-node status/duration/output and streamed as `automation:event`.

Node executors are plain functions in `AutomationService`, so adding a node type is a local change
(plus its `NodeTypeSpec` for the inspector UI). `agent.run` and `composition.run` call
`AgentService.runOnce`, which runs the real model/tool loop headlessly and only executes tools with
`auto` policy.

Compositions are sequential agent pipelines with `{{input}}` and `{{previous}}` templating, run
either interactively (`composition.run` + events) or inline (`runInline`) from a workflow step.

## 14. Composio & iconography

**Composio** is an optional bridge service:

1. `ComposioService` stores the API key in the shared `SecretVault` and a stable local
   `user_id` in `state/composio.json`.
2. `sync()` pages through `GET /tools` (v3.1), normalises each action (slug, name,
   description, toolkit, input JSON Schema) and persists a trimmed catalog.
3. `registerTools()` publishes the two meta tools plus one tool per enabled action into
   `ToolRegistry.setSource('composio', â€¦)`, so policies, approvals, transcripts and
   automation `tool.call` all treat them like built-ins.
4. Connect uses `GET /auth_configs?toolkit_slug=â€¦` then `POST /connected_accounts/link`,
   opening the returned URL in the system browser; accounts are cached per user.
5. Execution posts `{ user_id, arguments }` to `/tools/execute/{slug}` and returns the
   response payload as text plus data.

All calls are time-boxed and errors are normalised into readable messages. The QA harness
runs a local stand-in server implementing the same endpoints, so the integration is tested
without a real key.

**Iconography** is a single renderer module, not an asset pipeline:

- `SystemIcon.tsx` holds a glyph registry. Feature glyphs are duotone filled shapes with
  their own palette (`dashboard`, `message`, `terminal`, `mail`, `automation`â€¦); utility
  glyphs are custom strokes (`chevron-*`, `x`, `check`, `search`â€¦). Names resolve through
  an alias table so the rest of the codebase keeps using semantic names.
- `Icon.tsx` is the only entry point and forwards to `SystemIcon`, with `mono` for contexts
  that need a neutral tint.
- `BrandIcon.tsx` renders official brand paths from the simple-icons dataset (CC0) plus a
  few hand-drawn marks, with automatic luminance correction so dark logos stay visible on
  dark surfaces. It powers provider cards, theme gallery OS badges and Composio toolkits.
- Coloured icons are identity markers (apps, providers, integrations); neutral strokes are
  controls. That separation keeps the desktop lively without turning the chrome into noise.

## 15. Neuro Web

`WebService` turns every installation into a host and resolver:

1. **Identity** — an Ed25519 key in the vault derives the node id (`sha256(pubkey)[0..16]`).
2. **Publish** — files are hashed (SHA-256), stored content-addressed under `state/web-blobs`, and described by a signed manifest (domain, files, entry, timestamps).
3. **Claims** — the first valid manifest for a domain binds it to that key; conflicting keys are rejected and surfaced in the UI.
4. **Transport** — a dedicated HTTP server exposes `/web/{hello,resolve,blob,announce}` plus a `/dweb/<domain>/` gateway.
5. **Discovery** — a UDP beacon on `47813` finds LAN peers; peers can also be added manually.
6. **Replication** — announce verifies every manifest signature and blob hash before storing; bounded by a store cap.
7. **Browser** — the renderer never speaks the mesh protocol; it loads the local gateway and switches modes in the toolbar.

The harness publishes on one node, resolves on a second node and fetches the page through its gateway.

## 16. Performance notes

- Terminal output is forwarded as raw chunks; xterm.js handles rendering off the React tree.
- Stats poll at 2.5 s; the UI reads them from the store.
- Writes are coalesced and atomic; session saves are debounced by the turn boundary.
- Message lists are not virtualized yet â€” fine for typical sessions, a known growth item.

## 17. Scaling roadmap

1. **Multi-agent rooms** â€” several agents sharing a tool bus with explicit hand-off events.
2. **Remote workspaces** â€” `WorkspaceService` behind an SSH/FS provider interface.
3. **Virtualized transcripts** â€” windowing for 10k-message sessions.
4. **Plugin sandbox** â€” move command plugins behind a permissioned worker with a manifest capability
   model.
5. **signed builds + auto-update** â€” `electron-updater` with a release channel.

None of these require changing the IPC contract or the agent loop; that is the point of the seams.

