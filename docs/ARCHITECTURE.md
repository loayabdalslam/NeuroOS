# Architecture

> Design goal: a desktop environment small enough to reason about in one sitting, with seams that
> stay clean as it grows — new surface, new tool, new provider, new theme, without touching the core.

## 1. Process model

```
┌────────────────────────────────────────────────────────────────────┐
│ main process (Node 20)                                             │
│  · owns the filesystem, shell, network, windows, secrets           │
│  · runs the agent loop and the tool bus                            │
│  · single source of truth for settings and sessions                │
└───────────────▲──────────────────────────────┬─────────────────────┘
                │ ipcMain.handle (request)      │ webContents.send (events)
┌───────────────┴──────────────────────────────▼─────────────────────┐
│ preload (contextBridge, sandbox: false, contextIsolation: true)    │
│  · window.neuro.invoke(channel, params) → Promise<result>          │
│  · window.neuro.on(channel, listener) → unsubscribe                │
└───────────────▲──────────────────────────────┬─────────────────────┘
                │ window.neuro                  │
┌───────────────┴──────────────────────────────▼─────────────────────┐
│ renderer (React 18, no Node)                                       │
│  · nine surfaces, shell chrome, zustand stores                     │
│  · never touches disk, network or child processes directly         │
└────────────────────────────────────────────────────────────────────┘
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
  // …
}

export interface EventMap {
  'agent:event': AgentEvent;
  'terminal:data': { id: ID; data: string };
  // …
}
```

- `IpcRouter.register(map)` accepts a partial map of handlers; the compiler enforces the payload and
  return type of every channel.
- `attach()` wraps each handler in a try/catch that logs and rethrows a clean message.
- Events are broadcast through one method (`router.emit`) with an allowlisted channel name.
- Adding a capability = add the channel, add a handler, call it. No registry to update.

Failure isolation: every surface renders inside a `SurfaceBoundary`. A crash in one surface shows a
retry card and leaves the shell (and your other work) alive — verified by the webview incident that
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

Startup order matters and is explicit in `kernel.ts`:

```
settings.init() → terminal → tools(registry) → marketplace(init with tools) → agent.init() → ensureProfileDirs()
```

The kernel exposes `status()` — the same data the Settings/Desktop surfaces render — so health is
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
 ├─ build system prompt (agent prompt + environment + skills + recalled memory)
 ├─ for step in 1..maxSteps:
 │    ├─ adapter.stream(request, signal)          ← SSE from the provider
 │    │    ├─ text / reasoning deltas  → AgentEvent.text_delta / reasoning_delta
 │    │    └─ tool_call deltas         → accumulated per index
 │    ├─ no tool calls? → finish
 │    └─ for each call:
 │         ├─ policy = registry.policyFor(name)
 │         ├─ ask  → emit tool_call(pending) → await ApprovalRegistry → denied if refused
 │         ├─ deny → status 'denied'
 │         └─ auto → registry.invoke(name, args) → emit tool_result
 │         └─ append tool message → next model step
 └─ persist transcript, emit turn_end(reason)
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
TitleBar          brand · page tabs · command button · window controls
 ├ Dock           primary rail (9 surfaces + anchor + avatar + collapse)
 ├ main           active surface, keyed by page id → fresh state per tab
 ├ AnchorRail     pins, active agent, live stats, notes
 └ Taskbar        pinned apps, running pages, CPU/RAM, language, clock, tray
CommandPalette · ToastHost · modals
```

Pages (`PageInstance`) are persisted in settings. Navigating to a surface activates an existing page
unless `forceNew` is set (used for chat sessions and browser URLs), which gives real tab semantics
with per-page component state.

### State

- `useAppStore` — settings, stats, kernel status, tools, pages, toasts, window state.
- `useChatStore` — sessions, active transcript, streaming flags, approvals; consumes `agent:event`.
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
for Ubuntu, pill controls for iOS) are scoped in `shell.css` under `[data-design=…]`.

### Internationalization

- Flat dictionaries keyed by dotted names, 14 locales, English fallback.
- `lang` and `dir` are set on `<html>`; RTL is achieved with logical layout, not mirrored CSS.
- Flags are hand-drawn SVG components (Windows does not render emoji flags).

## 10. Performance notes

- Terminal output is forwarded as raw chunks; xterm.js handles rendering off the React tree.
- Stats poll at 2.5 s; the UI reads them from the store.
- Writes are coalesced and atomic; session saves are debounced by the turn boundary.
- Message lists are not virtualized yet — fine for typical sessions, a known growth item.

## 11. Scaling roadmap

1. **Multi-agent rooms** — several agents sharing a tool bus with explicit hand-off events.
2. **Remote workspaces** — `WorkspaceService` behind an SSH/FS provider interface.
3. **Virtualized transcripts** — windowing for 10k-message sessions.
4. **Plugin sandbox** — move command plugins behind a permissioned worker with a manifest capability
   model.
5. **signed builds + auto-update** — `electron-updater` with a release channel.

None of these require changing the IPC contract or the agent loop; that is the point of the seams.
