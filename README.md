<p align="center">
  <img src="resources/brand/icon-256.png" width="120" alt="Neuro OS" />
</p>

<h1 align="center">Neuro OS</h1>

<p align="center">
  An AI-native desktop environment where every surface — chat, files, terminal, browser, notebooks,
  spaces, the taskbar, the Anchor — is driven by the same agent and the same tool bus.
  <br />
  Built on the DeepSeek Harness design language.
</p>

<p align="center">
  <img alt="Electron 33" src="https://img.shields.io/badge/Electron-33.4-47848F?logo=electron&logoColor=white" />
  <img alt="React 18" src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" />
  <img alt="ACP v1" src="https://img.shields.io/badge/Agent_Client_Protocol-v1-14B8A6" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-4176E6" />
</p>

---

## What it is

Neuro OS is not a chat window with a sidebar. It is a small operating environment:

| Surface | What it does |
| --- | --- |
| **Desktop** | Live widgets: system monitor, conversations, workspace snapshot, agents, tool bus, marketplace picks, launcher. |
| **Chat** | Multi-provider streaming chat with a real agent loop: tool calls, approvals, reasoning, usage, exports. |
| **Workspace** | File explorer, content search, CodeMirror editor with save, git status, language breakdown. |
| **Spaces** | Long-lived contexts that bind a folder, notes, notebooks and conversations together. |
| **Notebook** | Live kernel: JavaScript/TypeScript in a sandboxed VM, Python and shell as processes. |
| **Browser** | A real Chromium surface (`webview`) with tabs, history, its own partition, and agent control. |
| **Terminal** | A **real ConPTY** PowerShell session rendered with xterm.js, plus a pipe fallback. |
| **Marketplace** | Skills, plugins (that add real tools), agents and themes — install, toggle, uninstall. |
| **Settings** | Themes, languages, providers, agents, per-tool permissions, taskbar, Anchor, workspace, data. |

Cross-cutting:

- **Theme gallery** — Neuro OS, Windows 11, Ubuntu (Yaru) and iOS design languages, each in dark and light, plus a pure **White** theme. Presets also move the taskbar and change wallpapers, typography, radii and elevation.
- **14 languages with hand-drawn vector flags** and full RTL layout for Arabic.
- **Anchor** — pin conversations, notes, files, spaces, notebooks, links or terminals to a persistent rail.
- **Command palette** (`Ctrl/⌘ K`) — navigation, actions, conversations, all keyboard-first.
- **Customizable taskbar** — bottom/top/left/right, size, labels, clock, metrics, language, pinned apps.

## Screenshots

| Onboarding | Desktop |
| --- | --- |
| ![Onboarding](screenshots/01-onboarding.png) | ![Desktop](screenshots/02-desktop.png) |

| Chat with a tool call | Workspace |
| --- | --- |
| ![Chat](screenshots/03-chat.png) | ![Workspace](screenshots/04-workspace.png) |

| Terminal (ConPTY) | Theme gallery |
| --- | --- |
| ![Terminal](screenshots/08-terminal.png) | ![Settings](screenshots/10-settings.png) |

| Windows 11 | Ubuntu |
| --- | --- |
| ![Windows](screenshots/13-theme-windows.png) | ![Ubuntu](screenshots/14-theme-ubuntu.png) |

| iOS | White |
| --- | --- |
| ![iOS](screenshots/15-theme-ios.png) | ![White](screenshots/16-theme-white.png) |

## Quick start

```bash
# Node 20+ and npm 10+
npm install

# development (Vite HMR for the renderer)
npm run dev

# production build + launch
npm run build
npm start

# package installers (Windows: NSIS + portable)
npm run dist:win
```

> The renderer is loaded from `out/renderer` in production. `npm run selftest` builds the app and
> runs the QA harness below.

### First run

1. Pick a language (the layout flips for Arabic).
2. Set your name and role.
3. Choose a theme — the whole OS restyles live.
4. Connect a provider (or skip and add one later).
5. Pick a workspace (a demo project is generated for you).

## Providers

Any of these work out of the box — no SDKs, just typed HTTP adapters:

- **OpenAI-compatible**: OpenAI, DeepSeek, Groq, OpenRouter, xAI, Mistral, Together, Qwen/DashScope, LM Studio, any self-hosted endpoint (`/v1/chat/completions`).
- **Anthropic** Messages API (streaming, tool use, thinking blocks).
- **Google Gemini** `streamGenerateContent` with function declarations.
- **Ollama** via its OpenAI-compatible endpoint.
- **ACP agents** — any Agent Client Protocol v1 process over stdio.

Keys are encrypted with the OS keychain (`safeStorage` → DPAPI on Windows) and stored in
`%APPDATA%/Neuro OS/state/vault.json`. They never leave the machine.

## ACP (Agent Client Protocol)

Neuro OS implements the **client** half of ACP v1:

- `initialize` with `fs`, `terminal` and session capabilities
- `session/new`, `session/load`, `session/prompt`, `session/cancel`, `session/set_mode`
- streaming `session/update` notifications (message chunks, thoughts, tool calls, plans, usage)
- client-side `fs/read_text_file`, `fs/write_text_file`
- `terminal/create|output|wait_for_exit|kill|release`
- `session/request_permission` mediated through Neuro's policy layer

Add an ACP provider in **Settings → Providers → ACP Agent** and give it a command such as
`npx -y <agent> --acp`.

## Tool calling, with real control

36 built-in tools across `filesystem`, `shell`, `network`, `ui`, `system`, `knowledge`, `agent`
and `marketplace` — plus every tool contributed by installed plugins.

Every tool has an explicit policy: **auto**, **ask** or **deny**. High-risk tools (shell, delete,
launch app) ask by default; the chat UI renders an approval card inline and the agent waits for
your decision. Settings → Tools lets you override any tool individually.

## Architecture in one page

```
┌──────────────────────────── renderer (React) ────────────────────────────┐
│  Shell (titlebar · tabs · dock · taskbar · anchor · palette · toasts)    │
│  Surfaces: Desktop Chat Workspace Spaces Notebook Browser Terminal …     │
│  Zustand stores · typed bridge (window.neuro) · zero Node access          │
└───────────────────────────────────▲──────────────────────────────────────┘
                                    │ typed IPC (request/response + events)
┌───────────────────────────────────▼──────────────────────────────────────┐
│                                 kernel                                    │
│  SettingsService  WorkspaceService  TerminalService  ContentService       │
│  ToolRegistry  MarketplaceService  AgentService  ApprovalRegistry         │
│  Provider adapters (OpenAI / Anthropic / Gemini)  ·  ACP client           │
│  JsonStore (atomic writes) · SecretVault (DPAPI) · append-only sessions   │
└──────────────────────────────────────────────────────────────────────────┘
```

- **One typed contract** (`src/shared/ipc.ts`) is the only way across the boundary; adding a
  capability is a single-file change and cannot drift.
- **One event bus** for streaming: agent deltas, terminal bytes, fs changes, stats, toasts.
- **One tool bus** shared by chat, plugins and the UI.
- **One persistence layer** — readable JSON, atomic rename writes, per-session documents.

Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Project layout

```
src/
  main/                  # Electron main process (the kernel)
    core/                # store, ipc router, logging, utils
    services/            # settings, workspace, terminal, content, tools, marketplace,
                         # agent, providers/*, net, system
    selftest/            # deterministic sandbox provider for the QA harness
  preload/               # contextBridge, typed event plumbing
  renderer/              # React application
    src/components/      # design system + shell chrome
    src/surfaces/        # the nine surfaces
    src/onboarding/      # cinematic first run
    src/styles/          # tokens (DSH palette), base, shell, surfaces
    src/state/           # zustand stores
  shared/                # types, IPC contract, i18n, themes, provider presets, catalog types
resources/               # catalog, fonts, brand icons
docs/                    # architecture + protocols
scripts/                 # icon generation, maintenance scripts
```

## QA harness

`npm run selftest` boots the app headlessly, resets the profile, walks the onboarding, and asserts:

- the agent loop streams text, calls `system.info`, receives the tool result and finishes the turn
- filesystem write → read → search → delete round-trip
- notebook kernel execution
- `shell.exec` through the real tool registry
- real webview navigation (`example.com`, Wikipedia)
- screenshots of every surface, every theme, the Anchor and the command palette

Screenshots land in `screenshots/`.

## Security model

- `contextIsolation: true`, `nodeIntegration: false`; the renderer only sees the typed bridge.
- Provider keys encrypted at rest with the OS keychain.
- Tool policies gate every agent action; high-risk defaults to **ask**.
- External links open in the system browser; webviews run with their own persistent partition.
- No telemetry, no analytics, no remote code loading.

## Limitations (honest list)

- Windows-first: the ConPTY terminal and native window helpers are Windows paths; Linux/macOS
  fall back to pipe mode and standard shell commands.
- The in-app browser is Chromium-in-a-webview: DRM video and some cross-origin flows are limited.
- Installers are unsigned; Windows SmartScreen will warn on first launch.
- `npm run dist:win` needs the `winCodeSign` tool cache, which electron-builder extracts with
  symlinks. Without Developer Mode/admin this fails; use `npm run pack:win` to produce an unpacked
  app without icon embedding, or enable symlink privileges and run `dist:win` normally.
- ACP is verified against the protocol spec and handled defensively; it is not tested against every
  agent implementation.

## License

MIT. Montserrat is licensed under the SIL Open Font License (see `resources/fonts`).
