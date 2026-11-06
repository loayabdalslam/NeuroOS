<p align="center">
  <img src="resources/brand/icon-256.png" width="112" alt="Neuro OS" />
</p>

<h1 align="center">Neuro OS</h1>

<p align="center">
  <strong>A desktop operating environment where the agent is the operating system.</strong>
  <br />
  Chat, files, terminal, browser, notebooks, mail, automation and a local memory graph — all
  driven by one agent loop, one tool bus and one set of on-disk JSON you can read.
</p>

<p align="center">
  <a href="#quick-start"><img alt="Quick start" src="https://img.shields.io/badge/quick_start-guide-4176E6?style=flat-square" /></a>
  <img alt="Electron" src="https://img.shields.io/badge/Electron-33.4-47848F?style=flat-square&logo=electron&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-18.3-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="ACP" src="https://img.shields.io/badge/Agent_Client_Protocol-v1-14B8A6?style=flat-square" />
  <img alt="No telemetry" src="https://img.shields.io/badge/telemetry-none-22C55E?style=flat-square" />
  <img alt="License" src="https://img.shields.io/badge/license-MIT-4176E6?style=flat-square" />
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#screenshots">Screenshots</a> ·
  <a href="#the-surfaces">Surfaces</a> ·
  <a href="#the-agent">Agent</a> ·
  <a href="#tools-reference">46 tools</a> ·
  <a href="#providers">Providers</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#troubleshooting">Troubleshooting</a> ·
  <a href="#documentation">Docs</a>
</p>

<p align="center">
  <img src="screenshots/02-desktop.png" alt="Neuro OS desktop with a chat window and a peer-to-peer mail window open" />
</p>

---

Neuro OS is not a chat window with a sidebar. It is a small operating environment: a simulated
desktop with real windows, fourteen applications that all run on the same kernel, and an agent that
can see and drive every one of them through a policy-gated tool bus.

Everything is local by default. State is readable JSON. Keys live in the OS keychain. There is no
account, no telemetry and no cloud memory — the only traffic is what you point the agent at.

```text
You:  "Check this machine, write the results into the workspace, then mail them to Ada."

Neuro:  system.info  →  fs.write  →  mail.send
        each call gated by policy · each result visible in the transcript
```

---

## Table of contents

| Getting started | Building with it | Operating & reference |
| --- | --- | --- |
| [Why Neuro OS](#why-neuro-os)<br>[What's inside](#whats-inside)<br>[Quick start](#quick-start)<br>[Your first ten minutes](#your-first-ten-minutes)<br>[Screenshots](#screenshots)<br>[Look & feel](#look--feel) | [The surfaces](#the-surfaces)<br>[The agent](#the-agent)<br>[Tools reference](#tools-reference)<br>[Permissions & approvals](#permissions--approvals)<br>[Providers](#providers)<br>[Automation](#automation)<br>[Plugins & the marketplace](#plugins--the-marketplace) | [Mail](#mail-without-a-server)<br>[Neuro Web](#neuro-web--decentralized-hosting)<br>[The Brain](#the-brain--local-memory)<br>[Data & storage](#data--storage)<br>[Architecture](#architecture)<br>[Security & privacy](#security--privacy)<br>[Troubleshooting](#troubleshooting) |
| [Keyboard shortcuts](#keyboard-shortcuts)<br>[Documentation](#documentation)<br>[Project layout](#project-layout) | [Testing & QA](#testing--qa)<br>[Performance notes](#performance-notes)<br>[FAQ](#faq) | [Limitations](#limitations)<br>[Roadmap](#roadmap)<br>[Contributing](#contributing)<br>[Credits](#credits)<br>[License](#license) |

---

## Why Neuro OS

Most AI tooling gives you a chat box next to your work. Neuro OS puts the agent *inside* the work,
with the same capabilities you have — and a visible, revocable grant for each one.

- **One agent, every surface.** The same `AgentService` loop powers chat, notebook cells,
  automation nodes, agent compositions, plugin calls and ACP agents. A tool written once is
  available everywhere.
- **A real desktop, not a mockup.** Draggable, resizable, snapping windows with z-order, a start
  menu, a lock screen, a taskbar and a dock. Every app runs both as a full-page surface and inside a
  window, from the same component.
- **The agent acts, you approve.** 46 built-in tools across eight categories, each with an explicit
  `auto` / `ask` / `deny` policy. Shell, delete and app launch ask by default. Changing a policy
  takes effect on the very next tool call.
- **Local-first and inspectable.** No database, no migrations framework. Settings, sessions, memory
  and even the peer-to-peer mesh are plain JSON files you can open, diff, back up and repair.
- **Three ways to extend it.** Write a tool in TypeScript, ship a plugin with no build step, or
  attach any ACP agent process over stdio — plus skills, themes and provider presets from a
  declarative catalogue.
- **Honest about its edges.** A published [red-team report](docs/REDTEAM.md), a documented list of
  limitations, and a QA harness that asserts the subsystems instead of trusting them.

### Who it is for

- **Builders** who want an agent that can actually touch the filesystem, the shell and the browser,
  with an approval trail they control.
- **Researchers** who want a workspace where sources, notes, notebooks, memory and drafts live in
  one place the agent can read.
- **People who dislike the cloud** and want mail, publishing and memory to work on their own
  machine, on their own network, with no account.

### When *not* to use it

- You need a hardened multi-user server. Neuro OS is a single-user desktop app; the P2P services
  bind to your network interface.
- You need zero-trust plugin execution. Plugins currently run in the main process — see
  [X-01 in the red-team report](docs/REDTEAM.md#x-01--plugin-vm-escape-critical).
- You need pixel-perfect native OS integration on macOS or Linux. This is Windows-first today.

### Where it fits

Different tools, different jobs. The last column is the honest one.

| If you want… | Strong there | What Neuro OS does differently | Where the other wins |
| --- | --- | --- | --- |
| Answering questions well | **ChatGPT, Claude desktop** | Gives the model hands (files, shell, apps) instead of a paste box | Best models, polish, mobile, zero setup |
| Editing code in place | **Cursor, Copilot** | The agent operates the whole desktop, not just the buffer | Deep IDE integration, inline completion, zero config |
| Connecting SaaS apps | **n8n, Zapier** | Workflows with agent nodes, running on your machine | Hundreds of maintained connectors, hosted uptime |
| Orchestrating agents in code | **LangChain, CrewAI** | Ships the UI, memory, policies and tools already | Production deployment, scale, language choice |
| Keeping notes and knowledge | **Obsidian, Notion** | Your notes are agent-readable context, not a silo | Editing polish, sync, collaboration |

The overlap is real: you can do some of each here, and none of it best-in-class. What you cannot do
elsewhere is hand one agent the same desktop you are looking at — with an approval card for every
consequential step, and every byte of state on your own disk.

---

## What's inside

Fourteen applications on one kernel. Every one of them is a real surface, not a screenshot.

| App | What it does |
| --- | --- |
| **Overview** | System health at a glance: CPU/RAM/uptime rings, kernel status, recent conversations, workspace summary, active agent. |
| **Chat** | Multi-provider streaming chat with a real agent loop: tool calls, inline approvals, reasoning blocks, attachments, usage, markdown export, session search. |
| **Files** | Workspace explorer, recursive content search, CodeMirror editor with save/dirty state, git branch and status, language breakdown. |
| **Spaces** | Long-lived contexts: a folder, a notebook and a set of conversations, named, tagged and pinned. |
| **Notebook** | Live kernel: JavaScript/TypeScript in a sandboxed VM, Python and shell as real processes, per-cell output. |
| **Browser** | A real Chromium surface (`webview`) with tabs, its own persistent partition, and a two-state switch between the central internet and Neuro Web. |
| **Sites** | Publish and host `.neuro` sites from this machine: signed manifests, content-addressed blobs, peer replication, live counters. |
| **Terminal** | A **real ConPTY** PowerShell session rendered with xterm.js, multiple sessions, plus a pipe fallback where PTY is unavailable. |
| **Mail** | Serverless, peer-to-peer, end-to-end encrypted mail with Ed25519 identities, LAN discovery and store-and-forward relay. |
| **Automation** | n8n-style workflow canvas: schedule/mail/file/manual triggers, agents, tools, HTTP, code, conditions, delays, mail. |
| **Composer** | Chain agents into pipelines where each step sees the original input and the previous step's output. |
| **Brain** | A local memory graph that records every click, turn, mail, site and tool call, indexes it, and feeds relevant memories back into the agent. |
| **Marketplace** | Skills, plugins (that add real tools), agents and themes — plus a plugin installer for folders, `.zip` files and URLs. |
| **Settings** | Themes, languages, providers, agents, per-tool permissions, Composio integrations, taskbar, Anchor, workspace and data. |

Plus the shell itself:

- **Desktop** — wallpaper, draggable icons, windows you can move/resize/snap/minimize/maximize, a
  start menu, a lock screen and a right-click context menu.
- **Command palette** (`Ctrl/⌘ K`) — navigation, actions, conversations and settings, keyboard-first.
- **Anchor** — pin conversations, notes, files, spaces, notebooks, links or terminals to a
  persistent rail with live stats and the active agent.
- **Customizable taskbar** — bottom/top/left/right, density, labels, clock, CPU/RAM meters,
  language, tray, pinned apps and running windows.
- **Theme engine** — four design languages (Neuro OS, Windows 11, Ubuntu, iOS) in dark and light,
  a pure **White** surface, five accents, sixteen wallpapers.
- **14 languages** with hand-drawn vector flags and full RTL layout for Arabic.

---

## Screenshots

| Desktop | Chat with a tool call |
| --- | --- |
| ![Desktop](screenshots/02-desktop.png) | ![Chat](screenshots/03-chat.png) |

| Files & editor | Notebook |
| --- | --- |
| ![Workspace](screenshots/04-workspace.png) | ![Notebook](screenshots/06-notebook.png) |

| Terminal (ConPTY) | Browser |
| --- | --- |
| ![Terminal](screenshots/08-terminal.png) | ![Browser](screenshots/07-browser.png) |

| Mail (no server) | Automation canvas |
| --- | --- |
| ![Mail](screenshots/17-mail.png) | ![Automation](screenshots/18-automation.png) |

| Neuro Web (publish + counters) | Brain (local memory) |
| --- | --- |
| ![Sites](screenshots/22-sites.png) | ![Brain](screenshots/25-brain.png) |

<details>
<summary><strong>All 30 screenshots</strong> — onboarding, every theme, Anchor, palette, start menu, integrations</summary>

<br />

| | |
| --- | --- |
| ![Cinematic intro](screenshots/00-story.png) | ![Onboarding](screenshots/01-onboarding.png) |
| ![Onboarding appearance](screenshots/01b-onboarding-appearance.png) | ![Onboarding Arabic](screenshots/01c-onboarding-arabic.png) |
| ![Desktop](screenshots/02-desktop.png) | ![Chat](screenshots/03-chat.png) |
| ![Workspace](screenshots/04-workspace.png) | ![Spaces](screenshots/05-space.png) |
| ![Notebook](screenshots/06-notebook.png) | ![Browser](screenshots/07-browser.png) |
| ![Terminal](screenshots/08-terminal.png) | ![Marketplace](screenshots/09-marketplace.png) |
| ![Extensions](screenshots/09b-extensions.png) | ![Settings](screenshots/10-settings.png) |
| ![Anchor rail](screenshots/11-anchor.png) | ![Command palette](screenshots/12-command-palette.png) |
| ![Windows 11 theme](screenshots/13-theme-windows.png) | ![Ubuntu theme](screenshots/14-theme-ubuntu.png) |
| ![iOS theme](screenshots/15-theme-ios.png) | ![White theme](screenshots/16-theme-white.png) |
| ![Mail](screenshots/17-mail.png) | ![Automation](screenshots/18-automation.png) |
| ![Composer](screenshots/19-composer.png) | ![Start menu](screenshots/20-start-menu.png) |
| ![Composio integrations](screenshots/21-integrations.png) | ![Sites](screenshots/22-sites.png) |
| ![Neuro Web mode](screenshots/23-neuroweb.png) | ![Sidebar](screenshots/24-sidebar.png) |
| ![Brain](screenshots/25-brain.png) | ![Wallpaper gallery](screenshots/26-wallpaper.png) |

Every image in this folder is captured by the QA harness from the packaged build — they are not
hand-made mockups. Regenerate them with `npm run selftest`.

</details>

---

## Quick start

**Requirements**

- **Node.js 20+** and npm 10+
- **Windows 10/11** for the native ConPTY terminal and window helpers (other platforms run with the
  pipe fallback)
- ~700 MB of disk for `node_modules` and the Electron runtime

**Run it**

```bash
git clone <this-repo> neuro-os
cd neuro-os

npm install
npm run dev        # development, Vite HMR for the renderer
```

**Build it**

```bash
npm run build      # type-check-free production bundle into out/
npm start          # launch the production build
npm run dist:win   # NSIS installer + portable .exe in release/
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Electron + Vite dev server with renderer HMR. |
| `npm run build` | Bundles main, preload and renderer into `out/`. |
| `npm start` | Previews the production bundle. |
| `npm run selftest` | Builds, then boots the app headlessly and runs the full QA harness — **it resets the profile it runs against** (see [Testing & QA](#testing--qa)). |
| `npm run typecheck` | `tsc --noEmit` over both the Node and web tsconfigs. |
| `npm run dist:win` | NSIS installer and portable executable. |
| `npm run pack:win` | Unpacked app directory, no icon embedding — the fallback when `dist:win` hits the symlink problem. |

> [!WARNING]
> **Unsigned builds.** Installers are not code-signed yet, so Windows SmartScreen warns on first
> launch. `dist:win` also needs electron-builder's `winCodeSign` cache, which is extracted with
> symlinks; without Developer Mode or admin rights that step fails. Use `npm run pack:win` to get an
> unpacked app instead — same code, no signing step.

### First run

The first launch plays a short cinematic intro (a code-drawn ASCII portrait, assembled from animated
glyphs) and then walks you through seven steps:

1. **Welcome** — what the OS is, and what each surface is for.
2. **Language** — 14 locales; picking Arabic flips the whole layout to RTL immediately.
3. **Profile** — your name and role, which personalise the agent and the desktop.
4. **Appearance** — pick a design language; the entire OS restyles live.
5. **Intelligence** — connect a provider now, or skip and add one later in Settings.
6. **Workspace** — choose a folder; a small demo project is generated for you if you skip.
7. **Ready** — the desktop opens with chat, files and terminal already on the dock.

You can replay the intro any time from **Settings → Advanced → Replay the intro**.

---

## Your first ten minutes

A concrete path from a fresh install to something genuinely useful.

**1. Add a model (2 min).**
**Settings → Providers → Add provider** → pick a preset (DeepSeek is marked *Recommended*) → paste
the key. The key is encrypted with the OS keychain and never rendered back into the UI. Press
**Test** to confirm the endpoint and list models.

Offline? Install [Ollama](https://ollama.com) and pick the **Ollama** preset — base URL is already
`http://127.0.0.1:11434/v1`, key not required.

**2. Ask something that needs a tool (1 min).**
Open **Chat** and type *"Check this machine and summarise it in one line."* The agent calls
`system.info`, shows the call card with status, duration and output, then answers. No approval was
needed — read-only tools default to `auto`.

**3. Try something that needs approval (1 min).**
Now ask *"Create a file called notes.md in my workspace with a summary."* The write tool defaults to
`ask`, so an approval card appears inline. Approve it, then open **Files** and read the file. Deny
the next one to see the agent recover gracefully instead of failing.

**4. Point it at your code (2 min).**
**Files → the folder + button** → choose a repository. Ask *"What does this project do, and what should I
read first?"* `workspace.info` and `fs.search` do the work. `Ctrl+S` saves edits from the agent or
from you.

**5. Make it remember (1 min).**
Say *"Remember that I prefer short answers without bullet points."* The agent calls
`brain.remember`. Open **Brain** and find the node. From now on, relevant memories are recalled and
injected into the system prompt automatically — no re-explaining.

**6. Schedule something (2 min).**
Open **Automation** → enable *Hourly system brief*, or build one: `trigger.schedule` →
`agent.run` → `notify.toast`. Runs stream node by node on the canvas with per-node output.

**7. Publish something (1 min, optional).**
Open **Sites** → drop an `index.html` folder in → publish as `my-site`. It is live at
`http://127.0.0.1:<port>/dweb/my-site/` and from any peer that accepted the signed manifest. Switch
the **Browser** to **Neuro Web** and open `my-site.neuro`.

---

## The surfaces

Each app below runs as a full-page tab **and** inside a desktop window, from the same component.
Open anything from the dock, the start menu, the command palette, or by asking the agent.

### Chat

The agent's home. A streaming conversation with a real tool loop behind it — not a text box with a
search plugin.

- **Sessions** — create, search, switch and delete conversations. `Ctrl/⌘ Shift N` starts a new one.
- **Agent picker** — switch between the built-in roles (see [The agent](#the-agent)) per
  conversation.
- **Model picker** — choose provider and model from the header; the selection is per conversation.
- **Inline approvals** — when a tool policy is `ask`, a card appears mid-transcript with the tool
  name, its arguments and Approve / Deny. The agent waits; nothing else blocks.
- **Tool call cards** — status, duration, collapsed output, expandable payload. The full result is
  always in the transcript so the model can reason about failures.
- **Reasoning blocks** — models that emit thinking (DeepSeek R1, Claude, o-series, Gemini) show a
  collapsible *Thinking…* section that does not pollute the answer.
- **Attachments** — the paperclip opens a native file picker; the chosen files are listed on the
  message and stored with the transcript. Their **contents are not yet sent to the model** — point the
  agent at the path instead (`fs.read`), which is what it will do anyway once it has the path.
- **Regenerate** — drop the last assistant turn and replay the user message.
- **Usage** — prompt and completion token counts per turn.
- **Stop** — cancels the HTTP stream and resolves pending approvals as denied.
- **Export** — write the conversation to Markdown.

### Files (workspace)

Your folder, as a real filesystem view.

- **Explorer** — tree with file sizes and modification times.
- **Content search** — recursive plain-text search with file, line and preview; skips
  `node_modules` and build output. 150 results per query.
- **Editor** — CodeMirror 6 with syntax highlighting for JS/TS, JSON, HTML, CSS, Markdown and
  Python, dirty-state tracking, `Ctrl/⌘ S` to save and `Ctrl/⌘ F` to find.
- **Git** — current branch, working-tree change count and the latest commit.
- **Summary** — file count, total size and a language breakdown, same data the agent sees through
  `workspace.info`.

The workspace root is set in **Settings → Workspace** and is the default root for the agent's
filesystem tools. Paths outside it are still reachable by absolute path — the agent is not sandboxed
to the workspace, which is why writes and deletes ask by default.

### Terminal

A **real ConPTY** PowerShell session rendered by xterm.js — not a fake log. Interactive programs,
colour, resize and cursor addressing all work.

- Multiple sessions with independent scrollback; the buffer survives switching tabs.
- Resize is propagated to the PTY, so full-screen TUIs behave.
- Where ConPTY is unavailable, the service falls back to a pipe-backed shell and the app says so in
  **Settings → About → Terminal**.
- Running commands are visible to the agent through `shell.session`; `shell.exec` runs one-shot
  commands and returns stdout, stderr and the exit code.

`` Ctrl/⌘ ` `` jumps straight to a terminal from anywhere.

### Notebook

Live code, real kernels, per-cell output.

| Kernel | Execution | Use for |
| --- | --- | --- |
| **JavaScript / TypeScript** | In-process sandboxed `vm` context | Quick data shaping, prototypes, checks |
| **Python** | A real `python` process per session | Analysis, plotting, scripts |
| **Shell** | A real shell process | Anything the terminal can do |

`Ctrl+Enter` runs a cell. Output is captured per cell and kept with the notebook, so a notebook is a
document you can reopen. The agent can run code through `notebook.run` and read the result.

### Browser

A Chromium surface with its own persistent partition (`persist:neuro-browser`).

- Tabs, back/forward/reload, address bar.
- A two-state switch: **Web** (the normal internet) and **Neuro Web** (the decentralized mesh —
  `.neuro` resolution through the local gateway, with live counters).
- The agent can drive it: `browser.open` puts a URL on screen for you, `browser.read` fetches and
  returns the readable text for the model.

External links from anywhere in the app open in your system browser instead, so the in-app surface
stays yours.

### Sites — publishing to Neuro Web

Drag a folder in, pick a domain, publish. Your machine becomes the host.

- Drop zone for folders or individual files, or a native folder picker that reads in the main
  process.
- Validation: domain `a-z0-9-` 2–40 chars, `index.html` at the root unless an entry is set, ≤300
  files, ≤12 MB.
- Peers list with online state, live counters for sites, peers, visits served and hosted bytes.
- Unpublishing removes the claim on this node and garbage-collects its blobs.

Full protocol, gateway endpoints and the security model: [docs/WEB.md](docs/WEB.md) and
[Neuro Web](#neuro-web--decentralized-hosting) below.

### Mail

Serverless, account-free, end-to-end encrypted mail. Each installation *is* a mail node.

- Compose, inbox, sent, a reader pane showing the thread id, unread and queued counters.
- Delivery badges on every message: `received`, `encrypted`, `verified`.
- Peer list with live online state; **+ Add peer** for a manual `host:port`.
- **LAN discovery** toggle; the node's listening port is shown in the sidebar.

Protocol, crypto and the two-node demo: [Mail](#mail-without-a-server) and [docs/MAIL.md](docs/MAIL.md).

### Automation canvas

A canvas of nodes and edges. A trigger starts it; each node transforms an item `{ text, json }` that
flows along the edges.

- Drag nodes on the canvas, pan the background, `Ctrl/⌘` + wheel to zoom.
- Click a node to inspect and edit its config; click an edge to delete it.
- **Run** executes immediately and lights up nodes as they complete; **history** keeps the last 100
  runs with per-node status, duration and output.
- Workflows must be **enabled** to run from triggers.

Node catalogue, templating and limits: [Automation](#automation).

### Composer

Chain agents into a pipeline. Each step runs an agent whose prompt can see the original `{{input}}`
and the previous step's `{{previous}}` output.

```text
Research  →  Draft  →  Review
```

Run it interactively from Composer, from inside a workflow (`composition.run`), or let the workflow
pass data in and take the final text out. This is the seam between *reasoning* (several agents with
different roles) and *automation* (a graph that runs on a schedule).

### Spaces

A Space is context that outlives a conversation: it binds a folder, a notebook and a list of
conversations into one named, tagged project. Open a Space and the agent knows which project you are
in without being told twice.

### Brain

The local memory graph. Every click, navigation, agent turn, mail, published site, workflow run and
tool call becomes a node; relations become edges.

- **Graph** — force layout, colour-coded by kind, drag to pan, wheel to zoom, click for the
  inspector.
- **Timeline** — the raw event stream, newest first.
- **Ask** — natural-language recall with the hits, scores and reasons behind them.
- **Profile** — top apps, actions, topics, collaborators, sites and an activity histogram.
- **Forget / Wipe** — remove a node with its edges, or the whole graph.
- **Recording toggle** — pause capture entirely; nothing is stored while paused.

Details: [The Brain](#the-brain--local-memory) and [docs/BRAIN.md](docs/BRAIN.md).

### Marketplace

A declarative catalogue with four kinds of item, plus a real plugin installer.

| Kind | Install effect |
| --- | --- |
| **Skill** | Writes `skills/<id>/SKILL.md`; the skill index is appended to every system prompt and the agent reads the full procedure with `skills.read`. |
| **Plugin** | Writes `plugins/<id>/`; its tools are registered in the tool bus and namespaced `plugin.tool`. |
| **Agent** | Adds an `AgentConfig` with its own system prompt, tool allowlist, temperature and step limit. |
| **Theme** | Applies an accent/design preset through the same token system as the built-in gallery. |

Ships with 21 items: 10 skills, 4 plugins, 4 agents, 3 themes. Install from the catalogue, or use
**Extensions → From folder / From .zip / From URL** for anything you built yourself.

### Settings

Thirteen sections, all live — changing a value applies immediately, no restart.

| Section | What you change |
| --- | --- |
| **Appearance** | Design language, dark/light/system, White surface, accents, wallpapers, density, interface scale, motion level. |
| **Language** | 14 locales, live switching, RTL for Arabic. |
| **Profile** | Name, role, avatar hue. |
| **Providers** | Add/edit/remove providers, test connections, list models, set the default. |
| **Agents** | Create agents, edit system prompts, tool allowlists, temperature, `maxSteps`, pick the active agent. |
| **Tools** | Per-tool `auto` / `ask` / `deny`, plus the default policy for everything else. |
| **Integrations** | Composio key, catalogue sync, toolkit connections, enabled actions. |
| **Taskbar** | Position, size, labels, clock format, metrics, pinned apps, behaviour. |
| **Anchor** | What is pinned, rail behaviour. |
| **Workspace** | Active folder, recent folders, reveal in OS. |
| **Shortcuts** | The reference list of every global and editor shortcut. |
| **Advanced** | Developer mode, telemetry toggle (off), replay intro, open data folder, export/import settings, reset. |
| **About** | Version, Electron/Chromium/Node/V8 versions, terminal mode, design credits. |

---

## The agent

One agent loop, provider-agnostic, cancellable, with every action visible.

### The loop

```text
send()
 ├─ build system prompt   (agent prompt + environment + skills + recalled memory)
 ├─ for step in 1..maxSteps:
 │    ├─ adapter.stream(request, signal)        ← SSE from the provider
 │    │    ├─ text / reasoning deltas  → agent:text_delta, agent:reasoning_delta
 │    │    └─ tool_call deltas         → accumulated per index
 │    ├─ no tool calls? → finish
 │    └─ for each call:
 │         ├─ policy = toolPolicies[name] ?? default ?? 'ask'
 │         ├─ ask  → emit tool_call(pending) → await approval → denied if refused
 │         ├─ deny → status 'denied'
 │         └─ auto → invoke tool → emit tool_result
 │         └─ append the tool message → next model step
 └─ persist transcript, emit turn_end(reason)
```

Properties that matter in practice:

- **Tool results are messages.** The model sees exactly what happened — including errors — and can
  recover on the next step instead of starting over.
- **Policies are read per call.** Flip `fs.write` from `ask` to `auto` and the very next call obeys.
- **Cancellation is an `AbortController` per session.** It aborts the HTTP stream and resolves
  pending approvals as denied.
- **Step limits are enforced** (`maxSteps` per agent, 24 for Neuro by default) so a loop cannot run
  away.

### Built-in roles

| Agent | Temperature | Max steps | System prompt bias |
| --- | --- | --- | --- |
| **Neuro** (default) | 0.3 | 24 | Resident intelligence of the OS: concise, tool-first, explains tradeoffs in one line. |
| **Engineer** | 0.2 | 40 | Pair-programming in a real repository: match the surrounding style, run the project's own checks, prefer targeted edits. |
| **Researcher** | 0.4 | 30 | Primary sources first, quote precisely, cite URLs inline, separate observation from inference, end with the three biggest unknowns. |
| **Architect** | 0.5 | 20 | Boundaries, contracts, failure modes, operability; diagrams in ASCII or mermaid; every recommendation needs a cost. |

Create your own in **Settings → Agents**: name, system prompt, tool allowlist (`all` or a list),
temperature and step limit. Installed marketplace agents appear in the same list.

### What the model can see

`AgentService` assembles the system prompt from five pieces:

1. **The agent's own prompt** (its role and rules), or a per-session override.
2. **The environment** — OS and architecture, workspace root, current date, model and shell.
3. **Environment rules** — absolute paths, prefer `shell.exec` over describing commands, prefer
   reading files over assuming, answer in the user's language.
4. **Remembered context and long-term memory** — notes and facts from the content store, plus up to
   six salience-ranked memories from the Brain, injected as `## Remembered context` and
   `## Long-term memory` blocks.
5. **Installed skills** — a one-line index; the agent opens a skill with `skills.read` when it needs
   the full procedure.

### Providers

Fourteen presets, one adapter interface. Any OpenAI-compatible endpoint works without code.

| Preset | Kind | Base URL | Local? |
| --- | --- | --- | --- |
| **DeepSeek** | `openai` | `https://api.deepseek.com/v1` | |
| **OpenAI** | `openai` | `https://api.openai.com/v1` | |
| **Anthropic** | `anthropic` | `https://api.anthropic.com/v1` | |
| **Google Gemini** | `gemini` | `https://generativelanguage.googleapis.com/v1beta` | |
| **Ollama** | `ollama` | `http://127.0.0.1:11434/v1` | ✓ |
| **LM Studio** | `openai` | `http://127.0.0.1:1234/v1` | ✓ |
| **OpenRouter** | `openai` | `https://openrouter.ai/api/v1` | |
| **xAI Grok** | `openai` | `https://api.x.ai/v1` | |
| **Groq** | `openai` | `https://api.groq.com/openai/v1` | |
| **Mistral** | `openai` | `https://api.mistral.ai/v1` | |
| **Alibaba Qwen** | `openai` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` | |
| **Together AI** | `openai` | `https://api.together.xyz/v1` | |
| **ACP Agent** | `acp` | any stdio process | ✓ |
| **Custom endpoint** | `custom` | anything `/v1/chat/completions` | |

How the three wire protocols are normalised:

- **OpenAI-compatible** covers OpenAI, DeepSeek, Groq, OpenRouter, xAI, Mistral, Together, Qwen,
  LM Studio and Ollama. It also reads DeepSeek's `reasoning_content` and surfaces it as reasoning.
- **Anthropic Messages** converts messages to content blocks, merges consecutive same-role turns
  (the API requires alternation), streams `text_delta` / `thinking_delta` / `input_json_delta`, and
  assembles tool inputs from partial JSON.
- **Gemini** maps to `contents` + `systemInstruction` + `functionDeclarations` and reads
  `functionCall` parts. Identifiers are sanitised where the API requires it.

All three normalise tool calls into `{ id, name, args }`, so the loop never knows which provider it
is talking to.

**Keys never leave the machine.** They are encrypted with Electron's `safeStorage` (DPAPI on
Windows) and stored in `%APPDATA%/Neuro OS/state/vault.json`, never in `settings.json`. The field is
always empty when you reopen Settings.

**Adding a provider:** if the endpoint is OpenAI-compatible, add it in the UI — no code. For a new
protocol, implement `ProviderAdapter` (`stream`, `listModels`, `probe`) and register it in
`createAdapter()`. See [docs/EXTENDING.md](docs/EXTENDING.md#2-add-a-provider). Plugins can also ship
a streaming adapter without touching core code.

### ACP — attach any agent

Neuro OS implements the **client** half of [Agent Client Protocol](https://agentclientprotocol.com)
v1, so any ACP-speaking agent process becomes a first-class provider with the same UI, the same tool
bus and the same approval flow.

Supported: `initialize` with `fs`, `terminal` and session capabilities; `session/new`, `session/load`,
`session/prompt`, `session/cancel`, `session/set_mode`; streaming `session/update` notifications
(message chunks, thoughts, tool calls, plans, usage); client-side `fs/read_text_file` and
`fs/write_text_file`; `terminal/create|output|wait_for_exit|kill|release`; and
`session/request_permission`, mediated through Neuro's policy layer.

```text
Settings → Providers → Add provider → ACP Agent
  command:           npx
  arguments:         -y <package> --acp
  working directory: <your workspace>
```

Neuro spawns the process, negotiates the protocol, bridges filesystem and terminal capabilities and
streams the agent's output into the normal chat UI. Use this instead of a plugin when you want the
extension to run in its own process rather than in the main process.

### Integrations — Composio

One key connects 100+ real services (Gmail, Google Drive/Sheets/Calendar, GitHub, Slack, Notion,
Linear, Jira, Trello, Asana, HubSpot, Stripe, Discord, Telegram, LinkedIn…).

1. Get an API key at [composio.dev](https://composio.dev) and paste it in **Settings → Integrations**.
   It goes into the OS keychain, not into `settings.json`.
2. Press **Save & sync** to fetch the action catalogue and toolkits.
3. In **Toolkits**, press **Connect** on a service; the OAuth flow runs in your system browser and
   Composio holds the tokens. Neuro OS only ever holds your locally generated `user_id`.

Two ways the tools reach the agent:

| Layer | Tools | Use for |
| --- | --- | --- |
| **Enabled actions** | `composio.<slug>` — e.g. `composio.github_create_issue` | The handful of actions you use daily, with first-class schemas and their own policies. |
| **Meta tools** | `composio.search`, `composio.execute` | The long tail, without putting hundreds of definitions in the prompt. |

```text
composio.search  { query: "create a github issue" }
  → composio.execute { slug: "GITHUB_CREATE_ISSUE", arguments: { owner, repo, title } }
```

Any action also works as an automation step, so a scheduled digest can read a real inbox and post to
a real Slack channel. Without a key, everything else in the OS works normally.

Details and a troubleshooting table: [docs/COMPOSIO.md](docs/COMPOSIO.md).

---

## Tools reference

**46 built-in tools** across eight categories, plus every tool contributed by installed plugins and
every enabled Composio action. The tables below are the real catalogue from `src/main/services/tools.ts`.

### `filesystem` — 9 tools

| Tool | What it does | Danger |
| --- | --- | --- |
| `fs.list` | List a directory: name, kind, size, mtime. Use before reading. | low |
| `fs.read` | Read a UTF-8 file, optionally a line range. | low |
| `fs.write` | Create or overwrite a text file; parents created automatically. | medium |
| `fs.edit` | Replace an exact snippet; fails if missing or ambiguous. | medium |
| `fs.mkdir` | Create a directory recursively. | low |
| `fs.rename` | Rename or move a file or directory. | medium |
| `fs.delete` | Permanently delete files or directories. | **high** |
| `fs.search` | Recursive plain-text search with file, line and preview. | low |
| `workspace.info` | File count, total size, language breakdown and git status. | low |

### `shell` — 3 tools

| Tool | What it does | Danger |
| --- | --- | --- |
| `shell.exec` | Run a real command through PowerShell; returns stdout, stderr, exit code. | **high** |
| `shell.session` | Run a command inside a persistent visible terminal session. | **high** |
| `git.status` | Branch, working-tree changes and latest commit. | low |

### `network` — 6 tools

| Tool | What it does | Danger |
| --- | --- | --- |
| `http.fetch` | Any HTTP request; HTML is reduced to readable text. | medium |
| `web.search` | Search the public web for ranked title/url/snippet results. | low |
| `browser.read` | Fetch a page and return its readable text plus title. | low |
| `mail.status` | This node's identity, address and known peers. | low |
| `mail.inbox` | Recent messages in the local mailbox. | low |
| `mail.send` | Send a signed, encrypted message to a known peer. | medium |

### `ui` — 5 tools

| Tool | What it does | Danger |
| --- | --- | --- |
| `ui.navigate` | Switch the interface to another surface, with parameters. | low |
| `ui.toast` | Show a short in-app notification. | low |
| `ui.pin` | Pin a chat, note, file, space, notebook, link or terminal to the Anchor. | low |
| `browser.open` | Open a URL in the Neuro OS browser so you can see it. | low |
| `desktop.open` | Open an app window on the desktop by id. | low |

### `system` — 9 tools

| Tool | What it does | Danger |
| --- | --- | --- |
| `system.info` | OS, CPU, memory, GPU and runtime versions. | low |
| `system.stats` | Live CPU load, memory, uptime and process count. | low |
| `system.screenshot` | Capture the desktop as a PNG, returned as a path and a data URL. | medium |
| `system.windows` | List visible application windows with process ids. | low |
| `system.focusWindow` | Bring a window to the foreground by (partial) title. | medium |
| `system.clipboard.read` | Read the system clipboard text. | low |
| `system.clipboard.write` | Write text to the system clipboard. | medium |
| `system.notify` | Send a native OS notification. | low |
| `desktop.launch` | Launch an application or URL with the OS default handler. | **high** |

### `knowledge` — 2 tools

| Tool | What it does | Danger |
| --- | --- | --- |
| `notes.create` | Create a note; notes appear in Spaces and can be pinned. | low |
| `notebook.run` | Execute a snippet in the live notebook kernel and return output. | medium |

### `marketplace` — 5 tools

| Tool | What it does | Danger |
| --- | --- | --- |
| `marketplace.search` | Search the catalogue for skills, plugins, agents and themes. | low |
| `marketplace.install` | Install an item by id. | medium |
| `skills.list` | List installed skills. | low |
| `skills.read` | Read a `SKILL.md` in full so the agent can follow it. | low |
| `plugins.list` | List installed plugins, versions and load status. | low |

### `agent` — 7 tools

| Tool | What it does | Danger |
| --- | --- | --- |
| `brain.recall` | Search the memory graph and return matches with why they matched. | low |
| `brain.remember` | Store a durable fact or preference. | low |
| `brain.stats` | Node, edge and event counts. | low |
| `memory.remember` | Persist a fact, preference or decision for later conversations. | low |
| `memory.recall` | Search durable memory for facts relevant to a query. | low |
| `automation.list` | List saved workflows and whether they are enabled. | low |
| `automation.run` | Run a workflow by id or name, with an optional payload. | medium |

> **Design rules for new tools** (see [docs/EXTENDING.md](docs/EXTENDING.md#1-add-a-tool)): write the
> description for a model — say *when* to use it; validate arguments and throw readable errors, because
> the model reads them; return a concise `output` plus structured `data`; and pick `danger` honestly.

---

## Permissions & approvals

Every tool has a policy. Nothing runs silently that could hurt you.

| Policy | Behaviour |
| --- | --- |
| `auto` | Runs immediately. |
| `ask` | Pauses the turn and shows an approval card; the agent waits for your decision. |
| `deny` | Never runs; the model is told it was denied. |

Resolution order: `settings.toolPolicies[name]` → `settings.toolPolicies.default` → `ask`.

**Defaults.** Everything is `ask` except the read-only tools:
`fs.read`, `fs.list`, `fs.search`, `workspace.info`, `system.info`, `http.fetch`, `browser.read`,
`web.search`, `notes.create`, `notebook.run`.

**What that means in practice.** Reading and searching files, checking the machine, fetching a URL
and searching the web just happen. Writing a file, editing, renaming, installing something, sending
mail or running code asks once, with the exact arguments on the card. Deleting, running a shell
command and launching an application are `high` danger and ask by default too.

**Background runs are stricter.** In automation triggers there is nobody watching, so `ask`-policy
tools are **skipped** rather than blocking forever. Only `auto` tools run headlessly. If a workflow
depends on a write, set that tool to `auto` deliberately — and keep the workflow itself narrow.

**Per agent.** Each `AgentConfig` also carries a tool allowlist (`all` or an explicit list). An agent
that cannot see a tool cannot call it, whatever the policy says. Use this to build a read-only
researcher or a write-capable engineer.

---

## Automation

A small n8n-style workflow engine with an agent in it.

### Concepts

- **Item** — the payload moving through the graph: `{ text, json }`.
- **Node** — a typed step with config, dragged on a canvas.
- **Edge** — a connection from an output port (`main`, `true`, `false`) to a node's input.
- **Run** — one execution, persisted with per-node status, duration and output.
- **Trigger** — the node(s) with no incoming edge; they receive the initial item.

Runs stream progress as events, so the canvas lights up node by node instead of freezing until the
end.

### Node catalogue

| Node | Category | Output |
| --- | --- | --- |
| `trigger.manual` | trigger | Passes the run input. |
| `trigger.schedule` | trigger | Every N minutes, or daily at `HH:MM`. |
| `trigger.mail` | trigger | Fires when the node receives mail (optional from/subject filters). |
| `trigger.fs` | trigger | Fires on workspace file changes (optional path filter). |
| `agent.run` | agent | Runs an agent headlessly and returns its text. |
| `composition.run` | agent | Runs an agent composition and returns the final text. |
| `tool.call` | action | Invokes any tool with JSON arguments. |
| `http.request` | action | Any HTTP method, with templated URL, headers and body. |
| `transform.code` | action | JavaScript with `input` and `json` in scope. |
| `condition.if` | logic | A JS expression; activates the `true` or `false` port. |
| `delay.wait` | logic | Sleeps (max 60 s). |
| `mail.send` | action | Sends decentralized mail to a peer. |
| `notify.toast` | action | Shows an in-app notification. |

### Templating

Any config string can reference the incoming item:

```text
{{input}}        the item text
{{json.status}}  a field from item.json
{{now}}          ISO timestamp
{{workflow}}     workflow name
```

```text
Summarise this email for a busy engineer. Reply in 3 bullets.

{{input}}
```

`tool.call` arguments are parsed as JSON *after* templating, so `{ "path": "{{json.file}}" }` works.

### Branching

`condition.if` evaluates a JavaScript expression with `input`, `text` and `json` in scope and
activates one port. Only the matching branch runs; the other nodes stay untouched.

```js
json.text.toLowerCase().startsWith('urgent')
```

### Execution model

1. Start nodes are the triggers (or nodes with no incoming edge).
2. Shift a node off the queue, record a step, execute it.
3. Follow the edges from the port it emitted (`main` by default).
4. Stop when the queue is empty.
5. Persist the run and emit the final event.

Guards: 200 node executions per run (cycle protection), per-executor timeouts, cancellation through
`automation.cancel`, and one run per workflow at a time — a second attempt is rejected until the
first finishes. Errors stop the run and mark the failing step; completed steps keep their output so
you can see where it broke.

### Seeded examples

Two workflows ship disabled:

1. **Hourly system brief** — schedule → agent → notification.
2. **Mail triage** — mail trigger → agent classifies → `condition.if` urgent → alert, else a
   transform note.

Enable them from the list, or start from the empty canvas.

---

## Mail without a server

There is no mail server, no account and no signup. Every running Neuro OS instance is its own node:
it holds its own identity, stores its own messages, accepts direct deliveries from peers and relays
messages for peers that are temporarily offline.

### Identity

An identity is generated locally the first time you open Mail.

| Part | Algorithm | Purpose |
| --- | --- | --- |
| Signing key | Ed25519 | Authenticates the sender of every envelope |
| Encryption key | X25519 | Receives end-to-end encrypted payloads |

The node id is `sha256(publicKey)` truncated to 16 hex characters, and the address is derived from
it:

```text
name@<nodeId>.neuro        e.g.  youssef@4f7c9a1b22e0d3a8.neuro
```

Private keys are encrypted with the OS keychain in `state/vault.json`. The public halves travel in
the envelope. The address is stable across restarts.

### Envelope

Every message is one signed JSON envelope:

```jsonc
{
  "v": 1,
  "id": "mail_…", "threadId": "thread_…",
  "from": { "address": "…", "name": "…", "nodeId": "…", "publicKey": "PEM", "encPublicKey": "PEM" },
  "to":   { "address": "…", "nodeId": "…" },
  "ts": "2026-…",
  "encrypted": true,
  "payload": "base64(ciphertext)",
  "epk": "PEM (ephemeral X25519 public key)",
  "nonce": "base64(12 bytes)", "tag": "base64",
  "ttl": 3, "hops": ["nodeId…"],
  "sig": "base64(ed25519 signature over the canonical envelope)"
}
```

- **Signature** covers a stable, sorted-key serialisation of every field except `sig`, so any
  tampering is detected. The receiver also checks that `sha256(publicKey)` equals `from.nodeId`, which
  makes sender spoofing fail.
- **Encryption** is X25519 ECDH between a fresh ephemeral key and the recipient's long-term key,
  through HKDF-SHA256, then AES-256-GCM. A new ephemeral key per message gives per-message forward
  secrecy for the payload key.
- **Subject and body are encrypted together.** Only routing metadata — from/to node ids, timestamp,
  size — is visible on the wire.
- When the recipient's public key is unknown, the message is signed but **not** encrypted, and the
  UI says so.

### Transport

Each node listens on an HTTP server (random port by default, shown in the Mail sidebar).

| Endpoint | Purpose |
| --- | --- |
| `GET /mail/hello` | Identity handshake: node id, address, name, public keys, port |
| `POST /mail/deliver` | Accept or relay an envelope (rate-limited to 40 req/min per IP) |
| `GET /mail/peers` | Share the peer list for mesh discovery |

Delivery states: `queued` (stored locally, retried every 12 s), `delivered` (recipient accepted),
`relayed` (an intermediate node accepted it), `received` (inbound, stored here), `failed`.

When no direct route exists, the node forwards the envelope to its other peers with `ttl - 1` and
appends its node id to `hops` so loops are impossible.

### Discovery

- **LAN** — a UDP beacon on port `47811` (broadcast plus multicast `239.255.42.99`) every 6 seconds
  advertises `{ nodeId, address, name, port, publicKeys }`. Peers appear within seconds and stay
  online for 25 s after the last beacon.
- **Manual** — add `host:port` in the sidebar; the client performs the `/mail/hello` handshake and
  stores the keys.
- **Gossip** — an arriving message adds its sender to the peer list, so a mesh learns routes even
  with discovery blocked.

There is deliberately **no global directory**. Two nodes can talk once they know each other's host
or share a LAN. A team can run a well-known relay node and add it as a peer to bridge networks.

### Try two nodes on one machine

```powershell
npm run build

# terminal 1 — first node
npx electron . --user-data-dir="$env:TEMP\neuro-a"

# terminal 2 — second node (separate profile, so a separate identity)
npx electron . --user-data-dir="$env:TEMP\neuro-b"
```

In each window: **Mail → create identity**, then **+ Add peer** with `127.0.0.1` and the port shown
in the other window's sidebar. Send a message: it arrives instantly, marked `encrypted` and
`verified`. On a LAN the two usually find each other with no input at all — the QA harness asserts
exactly this exchange on every run.

### Storage & privacy

```text
state/mail.json     identity (public), peers, messages (bounded to 2,000)
state/vault.json    encrypted signing and encryption private keys
```

- Messages are plaintext **at rest on the receiving device**, by design: it is your machine,
  protected by your OS account. Encrypting at rest would only move the key next to the data.
- Nothing is uploaded anywhere. No analytics, no relay operated by anyone else, no account.
- Deleting a message deletes the local copy; peers may still hold their own.

### Agent integration

| Tool | Purpose |
| --- | --- |
| `mail.status` | Identity, address, peer count, unread/queued |
| `mail.inbox` | Read recent messages |
| `mail.send` | Send to a peer address (policy-gated) |

Combined with automation you get serverless email workflows:

```text
trigger.mail → agent.run (classify) → condition.if (urgent) → notify.toast / mail.send
```

### Mail limits

- No global name system: addresses are key-derived, not human-registered.
- No multi-device sync out of the box — one identity lives on one node.
- Attachments are not implemented; the envelope is text-only.
- Networks that block UDP or peer-to-peer HTTP need a relay reachable by both sides.
- A peer that never returns means undelivered mail stays queued locally; there is no bounce protocol.

Full protocol notes: [docs/MAIL.md](docs/MAIL.md).

---

## Neuro Web — decentralized hosting

Neuro Web turns the app into a host *and* a resolver for a peer-to-peer web. There is no registry, no
DNS authority and no hosting provider: a site lives on the machine that publishes it, and peers
replicate it so it survives the publisher going offline.

### Publish

Two real paths:

1. **Drag & drop** a folder or files onto the drop zone. The renderer walks the directory, packages
   the files and sends them to the local node.
2. **Publish a local folder** — a native folder picker read in the main process.

Pick a domain (`my-site`), optionally a title and description, then **Publish to the mesh**. The node:

1. validates the name (`a-z0-9-`, 2–40 chars) and the file set (`index.html` at the root unless an
   entry is set, ≤300 files, ≤12 MB);
2. stores content-addressed blobs in `state/web-blobs/<sha256>`;
3. signs a manifest with this node's Ed25519 key;
4. records the domain claim locally;
5. announces the manifest and blobs to every known peer.

The site is immediately reachable at `http://127.0.0.1:<port>/dweb/my-site/` and from any peer that
accepted it.

### Gateway API

```text
GET  /web/hello            node identity and stats
GET  /web/resolve?domain=  signed manifest, or 404
GET  /web/blob/<sha256>    content (requires ?domain= and a manifest that references it)
POST /web/announce         manifest + blobs (replication)
GET  /dweb/<domain>/<p>    gateway: resolve, verify, serve with the right MIME type
```

The browser never speaks the mesh protocol. It loads the local gateway, which resolves locally, then
through peers (3.5 s timeout each), verifies the manifest signature and every content hash, caches
the blobs and serves them. That keeps `.neuro` sites inside the ordinary Chromium surface — no
custom protocol handler, no CORS surprises.

### Switching internets

The Browser toolbar has a two-state switch:

- **Web** — the normal internet.
- **Neuro Web** — the decentralized start page, `.neuro` resolution and live counters. Typing
  `my-site.neuro` (or just `my-site`) rewrites to the gateway.

The choice is remembered across sessions.

### Peers & counters

- **LAN** — a UDP beacon on `47813` advertises `{ nodeId, port, name }` every 7 seconds; peers appear
  with source `lan`. Manual peers (`host:port`) are added in the Sites sidebar.
- A peer counts as online if it was seen in the last 45 s.
- **Counters** — sites, peers online, visits served and hosted bytes, fed live by `web:event`.
  Visits count gateway responses on this node; hosted bytes count the local blob store.

### How domain claims work

There is deliberately no global consensus. A domain is bound to the key that first published it:

- The first signed manifest for `name.neuro` claims it for that public key.
- Later manifests from a different key are rejected (`domain already claimed`).
- The claim replicates with the manifest, so peers independently reach the same conclusion.
- This is **first-claim**, not an auction or a blockchain. Two partitioned nodes publishing the same
  name conflict when they meet; the existing local claim wins and the UI reports the rejection.

If you need collision-resistant names, use a unique prefix — your node id, for example.

### Security model

- Manifests are Ed25519-signed with the public key embedded; the derived node id must match `id`.
- Every file is SHA-256 content-addressed; blobs fetched from peers are verified before being stored
  or served.
- Paths are normalised (`..` and absolute paths removed) and the gateway only serves files declared
  in the manifest.
- Served HTML gets `Content-Security-Policy: sandbox allow-scripts …` plus `nosniff`, so one site
  cannot call `/web/announce` or read another site's data.
- Sites run in the ordinary Chromium webview partition: no Node access, no IPC.
- The gateway listens on all interfaces so peers can fetch content. **Publish only what you are
  comfortable serving to your network.**

### Neuro Web limits

- No global discovery or DHT: peers are LAN or manual.
- First-claim domains, no revocation authority; unpublishing removes the claim on this node only.
- Text-oriented: files with null bytes are skipped by the folder publisher, and there is no range
  request or streaming (no large video hosting).
- Replication is best-effort and happens on publish/announce; there is no background repair loop.
- The gateway is HTTP, not HTTPS. Use it on trusted networks or in front of a reverse proxy.

Full notes and the red-team fixes behind this design: [docs/WEB.md](docs/WEB.md) and
[docs/REDTEAM.md](docs/REDTEAM.md).

---

## The Brain — local memory

The Brain is the app's long-term memory. It records what you do and turns that stream into a small,
queryable graph the agent can use as context.

### What is recorded

| Source | Example node |
| --- | --- |
| UI clicks | `action: Publish to the mesh` |
| Navigation | `page: Settings page` |
| Apps | `app: chat`, `app: mail` |
| Agent turns | `action: Asked Neuro: summarise my mail` |
| Mail | `person: ada@…` + relation `sent_to` |
| Sites | `site: selftest.neuro` + relation `published` |
| Automation | `workflow: Selftest pipeline` + relation `ran` |
| Tools | `tool: shell.exec` + relation `ran` |
| Explicit memories | `memory: Prefers concise answers` |

Each capture goes to a **raw event log** (capped at 6,000 entries, newest kept) and is aggregated
into **nodes** (unique entities weighted by use) and **edges** (typed relations: `used`, `visited`,
`interacted`, `sent_to`, `published`, `ran`, `related`). Labels are truncated and never include
passwords — click labels carry the visible text, not field values.

Recording can be paused from the Brain header at any time. Nothing is stored while paused.

### Storage & retrieval

- State: `state/brain.json` — nodes, edges and events. Plain JSON, readable, deletable, exportable.
- Search: **Orama** (`@orama/orama`, MIT, ~2 MB, zero infrastructure) indexes
  `label + detail + kind + surface + tags` with BM25 and typo tolerance.
- Recall = Orama hits + **one-hop graph expansion** + salience:
  `salience = 0.2 + log1p(weight) × 0.28 + recency × 0.22`.
- Profile aggregates top apps, actions, topics, collaborators, sites and an hour-of-day histogram.
- Retention: above 4,000 nodes the lowest-salience 10% is pruned with its edges; the event log keeps
  the latest 6,000 entries.

The memory engine has to ship inside the binary and work with no accounts, no daemons and no Docker.
That rules out the server-backed memory systems (Mem0 needs a model plus a vector DB, Graphiti/Zep
need Neo4j, Hindsight needs Docker and Postgres, Cognee needs a Python pipeline). Orama is pure
in-process JavaScript, so the Brain pairs it with a native temporal graph layer instead of a server
product. The comparison table is in [docs/BRAIN.md](docs/BRAIN.md).

### How the agent uses it

- **Automatic context** — before every turn, up to six relevant memories are appended to the system
  prompt as a `## Long-term memory` block (max 1,400 chars).
- **Deliberate use** — `brain.recall`, `brain.remember` and `brain.stats` let the agent search or
  write memory on purpose.
- Context is only added when recording is on, and is scoped to this device.

### Privacy

- Nothing is uploaded. No telemetry, no cloud memory.
- `state/brain.json` lives in your profile folder; **Settings → Advanced → Open data folder** reveals it.
- Wipe removes nodes, edges and events immediately; the file is overwritten on the next write.

### Brain limits

- Recall is lexical plus graph-based — there are no embeddings yet, so synonyms sharing no tokens can
  miss (graph expansion usually catches them).
- No cross-device sync: each installation has its own brain.
- Bounded by design: 6,000 events, 4,000 nodes — a single-user desktop, not a multi-tenant server.

---

## Plugins & the marketplace

A plugin is a folder with a manifest and an optional JavaScript module. It can add **tools** the
agent can call, **themes**, **provider presets**, **streaming adapters** and **commands**. No build
step, no SDK to install.

### Install

Three sources, all in **Marketplace → Extensions**:

| Source | What it does |
| --- | --- |
| **From folder** | Copies a directory containing `neuro.plugin.json` into your profile. Best for development. |
| **From .zip** | Extracts a package (zip or `.neuro`) and installs the folder inside. |
| **From URL** | Downloads a `.zip` over HTTPS, extracts and installs it. |

```text
plugins/
  hello-neuro/
    neuro.plugin.json   ← the contract
    main.js             ← optional handlers
    README.md
```

Install is idempotent per id. Uninstall removes the folder, its tools and its themes. Disabling
unloads it but keeps the files.

### Manifest

```jsonc
{
  "id": "hello-neuro",            // 2–49 chars: a-z 0-9 - _ .
  "name": "Hello Neuro",
  "version": "1.0.0",
  "description": "Reference plugin.",
  "author": "You",
  "homepage": "https://…",
  "main": "main.js",
  "permissions": ["fs", "ui"],
  "contributes": {
    "tools": [ /* JSON Schema + handler name */ ],
    "themes": [ /* design, mode, accent, colours */ ],
    "providers": [ /* pre-filled provider form */ ],
    "adapters": [ /* streaming adapters */ ],
    "commands": [ { "id": "say_hello", "title": "Say hello" } ]
  }
}
```

The manifest is validated **before** anything runs. Unknown permissions, missing tool schemas and
malformed themes are rejected at install time with a readable error.

A contributed tool appears as `hello-neuro.project_stats` in **Settings → Tools**, gets its own
policy, and is advertised to every provider exactly like a built-in tool.

### Runtime API

`main.js` is executed as `(function (module, exports, neuro) { … })`. Export handlers from
`module.exports`. The `neuro` object is the only host surface; anything not listed is unavailable.

| API | Permission | Notes |
| --- | --- | --- |
| `neuro.log(...)` | — | Writes to the plugin log, visible in the plugin card. |
| `neuro.storage.get/set/delete/all()` | — | JSON storage scoped to the plugin. |
| `neuro.fs.readFile/writeFile/list/exists/stat` | `fs` | Absolute paths. |
| `neuro.shell.exec(command)` | `shell` | PowerShell/bash; returns `{ stdout, stderr }`. |
| `neuro.net.fetch(url, init)` | `net` | Returns `{ status, ok, text }`. |
| `neuro.ui.toast(title, message)` | `ui` | In-app notification. |
| `neuro.ui.navigate(surface, params)` | `ui` | Switch surfaces. |
| `neuro.mail.send({ to, subject, body })` | `mail` | Uses the decentralized mail node. |
| `neuro.agents.run(prompt, agentId?)` | `agents` | Runs the agent loop headlessly and returns text. |

Tool handlers receive `(args, ctx)` with `ctx = { pluginId, workspaceRoot, log }` and may return a
string or `{ ok, output, data }`.

### Streaming adapters

For a new wire protocol, export an async generator — the same interface the built-in adapters
implement, in plain JavaScript:

```js
module.exports = {
  adapters: {
    async *echo(request) {
      for (const word of String(request.messages.at(-1).content).split(' ')) {
        yield { type: 'text', delta: word + ' ' };
      }
      yield { type: 'usage', usage: { input: 10, output: 10 } };
      yield { type: 'done' };
    },
  },
};
```

Event types the host understands: `text` (`{ delta }`), `reasoning` (`{ delta }`),
`tool_call` (`{ call: { id, name, args } }`), `usage` (`{ usage }`), `done`. The adapter shows up in
**Settings → Providers → Add provider** and is routed by `plugin:<pluginId>:<adapterId>` — tool
calling, streaming, history and automation all work exactly as with a built-in provider.

### Lifecycle

```text
install   → validate manifest → copy → load (vm + register contributions)
toggle off→ unregister tools, remove themes/adapters, keep files
toggle on → load again
reload    → unload → load          (hot update while developing)
uninstall → unload → delete folder
```

Errors are captured per plugin: the record shows the error, its tools are not registered, and the
log panel explains why.

### Security — read this before installing anything

> [!CAUTION]
> A plugin is **native code in the main process**. The Node `vm` context removes ambient capabilities
> and the `neuro` object gates the host API, but `vm` is explicitly not a security boundary. The
> project's own red-team suite proves this: finding **X-01** escapes the context and obtains the host
> `process` object. That finding is open and documented. Install only plugins you have reviewed.

Practical rules:

1. Treat every plugin as trusted code — like a VS Code extension or a Chrome extension.
2. Request the smallest permission set (`[]` is valid and common).
3. Never log secrets; keep handlers deterministic.
4. Pin versions and review diffs before updating.
5. For untrusted third-party code, prefer an **ACP agent** in its own process over a plugin.
6. Keep marketplace auto-install off on shared machines.

### Examples in this repository

| Folder | Demonstrates |
| --- | --- |
| [`examples/plugins/hello-neuro`](examples/plugins/hello-neuro) | Two tools (filesystem + text), one command, `fs`/`ui` permissions |
| [`examples/plugins/aurora-theme`](examples/plugins/aurora-theme) | A theme-only plugin with dark and light presets |
| [`examples/plugins/local-echo`](examples/plugins/local-echo) | A streaming provider adapter with zero dependencies |

Install any of them with **Marketplace → Extensions → From folder**.

### Packaging & publishing

```text
my-plugin.zip
└── my-plugin/
    ├── neuro.plugin.json
    ├── main.js
    └── README.md
```

Zip the parent folder (the installer also handles archives with one nested folder), host the zip
anywhere HTTPS-reachable, and use **From URL**. To list in the built-in catalogue, add a `plugin`
entry to `resources/catalog/catalog.json`.

- `apiVersion` is `1`; additive API changes do not bump it.
- Contributions follow the same shapes as the core types in `src/shared/types.ts`.
- If a manifest references an unsupported `design`, the theme is rejected but the rest of the plugin
  still loads.

### Debugging checklist

| Symptom | Check |
| --- | --- |
| Plugin shows `error` | Open **Logs** on the plugin card. |
| Tools missing | The manifest `handler` must match a key in `module.exports.tools`; check **Settings → Tools** for the namespaced name. |
| Provider not visible | It appears in **Settings → Providers → Add provider** under the plugin section. |
| Changes not applied | Press **Reload** on the plugin card. |
| Agent cannot call the tool | Check the tool policy **and** the agent's allowlist in **Settings → Agents**. |

Full reference: [docs/PLUGINS.md](docs/PLUGINS.md).

---

## Look & feel

The interface is a token system, not a pile of overrides: `tokens.css` defines the palette, a
semantic layer (`--n-*`), then each design language as an attribute selector. Switching a preset
flips attributes on `<html>`; CSS variables cascade to every component with no re-render cost beyond
one React pass.

```html
<html data-theme="dark" data-design="windows" data-surface="standard"
      data-accent="deepseek" data-wallpaper="mica" data-density="comfortable">
```

| Design language | Chrome character |
| --- | --- |
| **Neuro OS** | Neutral-bluish surfaces, DeepSeek blue, generous radii, soft elevation. |
| **Windows 11** | Mica materials, square-ish window controls, tighter type. |
| **Ubuntu (Yaru)** | Aubergine headerbar, adwaita surfaces, sharper corners. |
| **iOS** | Pill controls, translucent layers, large title rhythm. |

Plus a pure **White** surface treatment that drops tinting entirely — for daylight and projectors.

- **Eight presets** — Neuro Dark, Neuro White, Windows 11 (dark/light), Ubuntu (dark/light), iOS
  (light/dark). Each preset can also move the taskbar and pick its wallpaper.
- **Five accents** — Neuro, DeepSeek, Violet, Teal, Amber.
- **Sixteen wallpapers** — ten procedural design wallpapers (Nebula, Void, Grid, Paper, Mica, Mica
  light, Aubergine, Yaru light, Aurora, Midnight) and six public-domain NASA photographs bundled
  offline (Blue Marble, Earthrise, Pale Blue Dot, Pillars of Creation, Milky Way, aurora from orbit —
  credits in `resources/wallpapers/CREDITS.md`).
- **Density and motion** — comfortable or compact, and a reduced-motion setting that respects
  `prefers-reduced-motion`.
- **Custom iconography** — a hand-built duotone glyph set for every app, tool category and surface,
  plus original brand marks from simple-icons (CC0) for providers, operating systems and
  integrations, with automatic luminance correction so dark logos stay visible on dark surfaces.
- **Real RTL** — Arabic flips the layout logically rather than mirroring CSS. Flags are hand-drawn
  SVG components because Windows does not render emoji flags.

| Language | | Language | | Language | |
| --- | --- | --- | --- | --- | --- |
| English | `en` | Arabic (RTL) | `ar` | French | `fr` |
| Spanish | `es` | German | `de` | Chinese | `zh` |
| Japanese | `ja` | Russian | `ru` | Portuguese | `pt` |
| Italian | `it` | Turkish | `tr` | Hindi | `hi` |
| Korean | `ko` | Dutch | `nl` | | |

Missing translation keys fall back to English, so partial packs are legal.

---

## Keyboard shortcuts

**Global**

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ K` | Command palette |
| `Ctrl/⌘ J` | Toggle the Anchor rail |
| `Ctrl/⌘ B` | Toggle the dock |
| `` Ctrl/⌘ ` `` | Jump to the terminal |
| `Ctrl/⌘ ,` | Settings |
| `Ctrl/⌘ Shift N` | New conversation |
| `Ctrl/⌘ 1–9` | Switch to tab 1–9 |

**Editor & notebook**

| Shortcut | Action |
| --- | --- |
| `Ctrl/⌘ S` | Save file |
| `Ctrl/⌘ F` | Find in file |
| `Ctrl/⌘ Z` | Undo |
| `Ctrl/↵` | Run notebook cell |

**Canvas (Automation)**

| Gesture | Action |
| --- | --- |
| Drag background | Pan |
| `Ctrl/⌘` + wheel | Zoom |
| Drag node | Move |
| Click node | Inspect config |
| Click edge | Delete connection |

The same list is available in-app at **Settings → Shortcuts**.

---

## Data & storage

Everything durable is JSON on disk under the profile directory — no database, no migrations
framework, no binary state you cannot read.

**Windows:** `%APPDATA%\Neuro OS` · reveal it with **Settings → Advanced → Open data folder**.

```text
state/
  settings.json      user configuration (no secrets)
  content.json       spaces, notebooks, notes, memory
  vault.json         encrypted provider / mail / Composio keys (DPAPI blob, base64)
  brain.json         memory graph: nodes, edges, events
  mail.json          identity (public), peers, messages (bounded 2,000)
  automation.json    workflows and the last 100 runs
  compositions.json  agent pipelines and their runs
  web.json           domain claims, manifests, peers, counters
  web-blobs/         content-addressed site files (sha256)
  composio.json      user id and the trimmed action catalog
sessions/
  index.json         metadata for the session list
  <id>.json          full transcript per conversation
skills/<id>/SKILL.md
plugins/<id>/neuro.plugin.json + main.js
logs/neuro.log
```

| Want to… | Do this |
| --- | --- |
| Read or edit your state | Open the JSON in any editor. Writes are atomic (write-temp + rename), so a crash cannot truncate a file. |
| Back everything up | Copy the profile folder while the app is closed. |
| Move to another machine | Copy the folder. `vault.json` is bound to the OS account that encrypted it — re-enter keys after a move. |
| Export settings only | **Settings → Advanced → Export settings**; import it back the same way. |
| Start over without losing files | **Settings → Advanced → Reset** returns providers, agents, pins and layout to defaults; your workspace files are untouched. |
| Delete everything | Quit the app and delete the profile folder. Uninstalling leaves it behind on purpose. |

**What is encrypted:** provider API keys, the Composio key, and the mail signing/encryption private
keys — all through `safeStorage`. Everything else is plaintext by design, protected by your OS
account. Mail bodies are plaintext at rest on the receiving device (see [Mail](#mail-without-a-server)).

---

## Architecture

A desktop environment small enough to reason about in one sitting, with seams that stay clean as it
grows: a new surface, tool, provider or theme never requires touching the core.

```text
┌──────────────────────────── renderer (React 18) ─────────────────────────────┐
│  Shell      titlebar · tabs · dock · taskbar · anchor · palette · toasts     │
│  Surfaces   desktop chat workspace spaces notebook browser sites brain       │
│             terminal mail automation composer marketplace settings           │
│  Zustand stores · typed bridge `window.neuro` · no Node, no fs, no child proc │
└──────────────────────────────────┬───────────────────────────────────────────┘
                typed IPC (150+ channels)          event streams (21)
┌──────────────────────────────────▼───────────────────────────────────────────┐
│  kernel (main process, Node 20)                                              │
│   SettingsService  WorkspaceService  TerminalService  ContentService         │
│   ToolRegistry     ApprovalRegistry  AgentService     MarketplaceService     │
│   MailService      PluginService     AutomationService CompositionService    │
│   WebService       ComposioService   SystemService    BrainService           │
│   provider adapters (OpenAI / Anthropic / Gemini) · ACP client               │
│   JsonStore (atomic writes) · SecretVault (DPAPI) · append-only sessions      │
└──────────────────────────────────────────────────────────────────────────────┘
```

Only three kinds of edge cross the boundary: a typed request/response channel, an allowlisted event
channel, and a `webview` surface. Nothing else.

**Hard rules, enforced by the type system:**

1. The renderer has **no** `require`, no `fs`, no `child_process`. Everything is IPC.
2. Main never imports from `renderer/`. Shared code lives in `src/shared/`.
3. Wire types live in `src/shared/ipc.ts`; nothing else defines channel names.

### Kernel services

| Service | Responsibility | Owns |
| --- | --- | --- |
| `SettingsService` | Settings document, provider key extraction, onboarding | `state/settings.json` + vault |
| `WorkspaceService` | FS read/write/list/search/stat, demo seeding, watch | nothing (stateless) |
| `TerminalService` | ConPTY sessions, resize, buffer, fallback shell | live processes |
| `ContentService` | Spaces, notebooks + kernel, notes, agent memory | `state/content.json` |
| `ToolRegistry` | Tool definitions, policies, external (plugin) tools | in-memory catalog |
| `ApprovalRegistry` | In-flight approval promises keyed by call id | in-memory |
| `AgentService` | Sessions, streaming turns, tool loop, approvals, ACP | `sessions/*.json` |
| `MarketplaceService` | Catalog, install/uninstall, plugin activation, skills | `skills/`, `plugins/` |
| `PluginService` | Manifest validation, install sources, vm host, contributions | `plugins/` |
| `AutomationService` | Workflow graph, execution, triggers, run history | `state/automation.json` |
| `CompositionService` | Agent pipelines and their runs | `state/compositions.json` |
| `MailService` | P2P identities, envelopes, HTTP delivery, UDP discovery, relay | `state/mail.json` + vault |
| `WebService` | Domains, signed manifests, blob store, replication, gateway | `state/web.json` + `web-blobs` |
| `ComposioService` | Catalog sync, connected accounts, action execution | `state/composio.json` + vault |
| `BrainService` | Capture, graph, index, recall, profile | `state/brain.json` |
| `SystemService` | OS info, screenshots, windows, volume, clipboard | nothing |

There is no global singleton and no service locator: `createKernel(emit)` constructs the services
with explicit dependencies and returns a `Kernel`. The startup order is intentional and readable in
`src/main/kernel.ts`:

```text
settings.init() → terminal → tools(registry) → marketplace → agent → mail
→ compositions → automation → plugins → ensureProfileDirs()
```

The kernel exposes `status()`, which is the same data Settings and the desktop render — health is
observable rather than guessed.

### Why this shape

| Decision | Reason |
| --- | --- |
| One typed contract | Adding a capability is a single-file change and cannot drift. The compiler checks every payload and return type. |
| One event bus | Agent deltas, terminal bytes, fs changes, stats, toasts, mail, plugin and web events all use the same allowlisted channels. |
| One tool bus | Chat, plugins, Composio and automation all call the same registry, so policies and transcripts are never bypassed. |
| JSON with atomic writes | Users can read, diff, back up and repair their own OS state with a text editor. Write-temp + rename means a crash cannot truncate state. |
| Failure isolation | Every surface renders inside a `SurfaceBoundary`: a crash in one surface shows a retry card and leaves the shell and your other work alive. |
| No API cache library | The event stream already is the cache. |

Full detail, including the desktop window manager, theming pipeline and plugin host internals:
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Security & privacy

The model in one paragraph: the renderer is untrusted and can only speak IPC; the main process owns
capabilities; the agent can only use capabilities that exist as tools; every tool has a policy; and
every secret is encrypted with the OS keychain.

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` (needed for the typed bridge).
  The renderer only ever sees `window.neuro.invoke` and `window.neuro.on`.
- Provider keys, the Composio key and mail private keys are encrypted at rest with `safeStorage`
  (DPAPI on Windows) in `vault.json` — never in `settings.json`, never rendered back into the UI.
- Tool policies gate every agent action; `high` danger defaults to **ask**.
- External links open in the system browser; webviews use their own persistent partition and get no
  Node access or IPC.
- The `.neuro` gateway serves HTML under `Content-Security-Policy: sandbox allow-scripts` so one
  published site cannot read another or call gateway APIs.
- No telemetry, no analytics, no remote code loading. The telemetry toggle exists and is off; there
  is no endpoint behind it.

> [!WARNING]
> **The mesh binds to your network interface.** Mail and Neuro Web listen on `0.0.0.0` and discover
> peers over UDP broadcast, and the APIs are unauthenticated by design. On an untrusted network,
> keep the firewall up or leave those services idle. See
> [Residual risks](#residual-risks-by-design).

### Red team

The repository ships an adversarial audit, not just a promise. `src/main/redteam.ts` boots real
`MailService` and `WebService` instances on ephemeral ports with isolated stores and attacks them
over HTTP the way a hostile peer would.

| | |
| --- | --- |
| Checks executed | **24** |
| Passed | **23** |
| Open | **1 critical** — [plugin VM escape (X-01)](docs/REDTEAM.md#x-01--plugin-vm-escape-critical) |
| Fixed during the audit | **10** |

The ten fixes are the interesting part — they are the class of bug a demo would never find: a
completely broken mail relay (signature invalidated by the relay re-signing), no inbound rate limit,
free domain squatting without content, `nodeId` not bound to the signing key, blob enumeration
across sites, a missing CSP on the gateway, a junction/symlink leak in folder publishing, missing
blob garbage collection, remote-claim poisoning on resolve, and a `neuro://` path traversal.

### Residual risks, by design

- **LAN APIs are unauthenticated HTTP.** Mail and Web bind `0.0.0.0`; discovery is UDP broadcast. Any
  host on the LAN can publish, announce, query peers and flood (now rate-limited). This is the P2P
  trust model — do not expose the mesh to an untrusted network without a firewall.
- **First-claim domain ownership, no consensus.** Whoever claims a name first owns it.
- **Peer-controlled hosts are fetched** (resolve, blob fetch, relay), which is an SSRF surface toward
  the local network. Hosts only come from beacons and handshakes; there is no allowlist.
- **Plugins are trusted code.** See [Plugins → Security](#security--read-this-before-installing-anything).

If your threat model includes hostile plugins or a hostile LAN, run Neuro OS on a trusted network
and treat third-party extensions as you would a native installer.

---

## Performance notes

- Terminal output is forwarded as raw chunks; xterm.js renders outside the React tree.
- System stats poll every 2.5 s and the UI reads them from the store.
- Writes are coalesced (60 ms) and atomic; session saves are debounced to turn boundaries.
- Message lists are **not virtualized yet** — fine for typical sessions, and a known growth item.
- Cold start is a single Electron window; there is no background daemon and no preload of the mesh.

---

## Testing & QA

Three checks, all runnable locally, all deterministic.

```powershell
npm run typecheck    # tsc --noEmit over the node and web tsconfigs
npm run selftest     # build + boot headlessly + assert every subsystem + screenshots
npm run build; npx electron . --redteam --user-data-dir="$env:TEMP\neuro-redteam"
```

> [!CAUTION]
> **The QA harness resets the profile it runs against.** `--selftest` calls `settings.reset()` and
> deletes every session before it starts, so it wipes your conversations and settings if you run it
> on your normal profile. Run it against a throwaway directory instead:
>
> ```powershell
> npm run build
> npx electron . --selftest --user-data-dir="$env:TEMP\neuro-selftest"
> ```

### What `npm run selftest` actually asserts

It boots the app, resets the profile, walks onboarding and then:

- the agent loop streams text, calls `system.info`, receives the tool result and finishes the turn
- filesystem write → read → search → delete round-trip
- notebook kernel execution
- `shell.exec` through the real tool registry
- **two mail nodes exchange an encrypted, signed message** — no server
- **a plugin installs from a folder, contributes a callable tool, then uninstalls**
- **a workflow runs trigger → transform → notify with per-node results**
- **an agent composition runs end to end**
- **a second node publishes, resolves and serves a `.neuro` site end to end**
- **Composio syncs a catalogue and executes an action** against a local stand-in of the REST API
- **the Brain captures a real DOM click**, then answers `brain.recall` and `brain.ask`
- real webview navigation (`example.com`, Wikipedia)
- a screenshot of every surface, every theme, the Anchor, the command palette and the start menu

Screenshots land in `screenshots/` — the images in this README come from that run, not from a design
tool.

### What `--redteam` asserts

24 adversarial checks across mail, domains, the asset protocol and the plugin host, written to
`redteam-report.md` and `redteam-report.json`. It runs real service instances, not mocks. See
[docs/REDTEAM.md](docs/REDTEAM.md).

---

## Troubleshooting

### Install & launch

| Symptom | Fix |
| --- | --- |
| Blank window on `npm run dev` | Delete `out/`, then re-run. The renderer is loaded from `out/renderer` in production. |
| `dist:win` fails extracting `winCodeSign` (symlink error) | Enable Windows Developer Mode or run as admin, **or** use `npm run pack:win` to get an unpacked app without icon embedding. |
| SmartScreen blocks the installer | Expected: builds are unsigned. Use *More info → Run anyway*, or run from source. |
| `npm install` fails on `node-pty` | Prebuilt binaries cover common platforms; otherwise install the Windows build tools (`npm i -g windows-build-tools` equivalent) and reinstall. |
| App starts but nothing responds | Open **Settings → About** to read kernel status; check `logs/neuro.log` in the profile folder. |

### Models & agent

| Symptom | Fix |
| --- | --- |
| Provider test fails | Check the base URL ends in `/v1` for OpenAI-compatible endpoints, and that the key is valid. Behind a proxy, use **Custom endpoint**. |
| No models listed | Some self-hosted servers need a model name typed manually. Add it in the provider form. |
| Agent answers but never calls tools | The model may not support tool calling, or its tool schema is being rejected. Try a preset model known to support tools (DeepSeek, GPT-4.1, Claude, Gemini, Qwen-Coder). |
| Approval card never appears | The tool is `auto` in **Settings → Tools**, or the run is a background automation run, where `ask` tools are skipped. |
| Agent loops or stops early | Raise `maxSteps` in **Settings → Agents**. Neuro defaults to 24. |
| Streaming stalls | Check the connection and the provider's rate limits; press **Stop** and retry. |

### Terminal, files, editor

| Symptom | Fix |
| --- | --- |
| **About → Terminal** says *pipe fallback* | The native PTY binary did not load for this platform. Reinstall dependencies; on Windows the prebuilt covers x64. |
| Terminal shows no colour or garbled output | The shell is a pipe, not a PTY — see above. |
| Editor will not save | The file is outside the workspace root and the OS denied the write, or it is read-only. Check the path and permissions. |
| Search finds nothing | Search is plain-text and skips `node_modules` and build output. Try a shorter query. |

### Mail & Neuro Web

| Symptom | Fix |
| --- | --- |
| Peer never appears | UDP 47811 is blocked, or you are on different subnets. Add the peer manually as `host:port`. |
| Message stuck as `queued` | The peer is offline; the retry loop runs every 12 s. Check the peer's port and firewall. |
| Message arrives unencrypted | The recipient's public key was unknown, so it was signed only. Add the peer first. |
| Site resolves locally but not from a peer | The peer must have accepted the announce, which requires every referenced blob to be present. Re-publish. |
| `domain already claimed` | Another key claimed that name first. Use a unique prefix. |
| Gateway unreachable from another machine | The gateway listens on all interfaces; check Windows Firewall for the app. |

### Extensions & integrations

| Symptom | Fix |
| --- | --- |
| Plugin install rejected | The manifest failed validation — the error names the field. Check `id` characters, tool `parameters` and `permissions`. |
| Plugin tools do not appear | The manifest `handler` must match a key in `module.exports.tools`; then **Reload** the plugin. |
| Composio `HTTP 401` | The API key is invalid or rotated. Enter the new key and sync. |
| Composio sync returns 0 tools | The key belongs to an empty project, or the base URL is wrong. |
| **Connect** says *No auth config* | Create an auth config for that toolkit in the Composio dashboard — a Composio project setting, not a Neuro OS limit. |
| Connected account stays `pending` | Authorization was not completed in the browser. Press **Connect** again. |

### Data

| Symptom | Fix |
| --- | --- |
| Settings look corrupt | `state/settings.json` is plain JSON — fix it by hand, or import a previous export, or reset from **Settings → Advanced**. |
| Brain has no memories | Recording is paused, or nothing has happened yet. Toggle recording and interact with the UI. |
| Moved machines and keys are gone | `vault.json` is bound to the OS account that encrypted it. Re-enter keys. |
| Automation did not fire | The workflow must be **enabled**, and the app must be running — missed runs are not replayed. |
| My sessions and settings vanished | You ran the QA harness against your normal profile. It resets state by design; re-run it with `--user-data-dir` pointing at a throwaway folder. |

Logs live in `logs/neuro.log` under the profile folder; **Settings → Advanced → Open data folder**
takes you there.

---

## FAQ

<details>
<summary><b>Is it free? Do I need an account?</b></summary>

Yes, free and MIT-licensed. No account, no signup, no license key, no paid tier, no seat count. The
only thing you may pay for is the model provider you choose — and if you run Ollama or LM Studio,
that is free too.

</details>

<details>
<summary><b>Do I need an API key to use it?</b></summary>

No. Install [Ollama](https://ollama.com), pull a model, and pick the Ollama preset — a key is not
required for local providers. Cloud presets (DeepSeek, OpenAI, Anthropic, Gemini…) need a key from
that provider, which is encrypted in your OS keychain.

</details>

<details>
<summary><b>Does my data leave the machine?</b></summary>

Only what you deliberately send. Prompts and the context the agent gathers go to the model provider
you configured. If you enable Composio, its API calls go to Composio. There is no telemetry, no
analytics and no cloud sync. Sessions, memory, mail, notes and published sites live in your profile
folder.

</details>

<details>
<summary><b>Does it work offline?</b></summary>

Yes with a local model. What stops working offline is what needs the network: `web.search`,
`http.fetch`, browsing, cloud providers, Composio, and mail/Neuro Web beyond your LAN.

</details>

<details>
<summary><b>Which models work best?</b></summary>

Tool calling matters more than raw intelligence here — the agent is only as good as its tool calls.
Every model in the presets supports it: DeepSeek V3/R1, GPT-4.1 and 4o, Claude Sonnet/Opus/Haiku,
Gemini 2.5, Qwen3 Coder, Llama 3.3. Reasoning models (R1, Claude with thinking, o-series) show a
collapsible thinking block. Small local models work but lose tool-call precision.

</details>

<details>
<summary><b>Can the agent do things without asking me?</b></summary>

Only what you have allowed. Read-only tools default to `auto`; writes, deletes, shell commands and
app launches default to `ask`, which pauses the turn for a card you approve. In background automation
runs nobody is watching, so `ask` tools are skipped rather than executed silently. Every action is
recorded in the transcript.

</details>

<details>
<summary><b>Can I point it at my own repository?</b></summary>

Yes — **Settings → Workspace** sets the root, and the agent's filesystem tools default to it. It can
still reach absolute paths outside the workspace, which is exactly why `fs.write` and `fs.delete` ask
by default. Give an agent an explicit tool allowlist if you want it read-only.

</details>

<details>
<summary><b>Is there a prebuilt download?</b></summary>

Not published yet — this version is built from source. `npm run dist:win` produces an NSIS installer
and a portable executable in `release/`; `npm run pack:win` produces an unpacked app directory if the
signing step fails.

</details>

<details>
<summary><b>Is it Windows-only?</b></summary>

Windows is the primary, tested target: native ConPTY terminal, window helpers and the packaging
config. On Linux and macOS the app falls back to a pipe-backed shell and standard OS commands — it
runs, but that path is not covered by the QA harness.

</details>

<details>
<summary><b>Is it safe to install plugins from the internet?</b></summary>

Not without reading them. Plugins execute in the main process and the `vm` context is not a security
boundary — the project's own red-team found a working escape (X-01). Treat plugins like native
installers. For untrusted third-party agents, attach them as an ACP process instead.

</details>

<details>
<summary><b>How do I uninstall it cleanly?</b></summary>

Quit the app, remove the application, then delete `%APPDATA%\Neuro OS`. The uninstaller deliberately
leaves your profile folder behind so an accidental uninstall does not destroy your conversations,
memory or workspace settings.

</details>

<details>
<summary><b>Where do I report a bug or propose a change?</b></summary>

Open an issue with the failing command and the relevant section of `logs/neuro.log`. For a pull
request, run `npm run typecheck` and `npm run selftest` first, and add one assertion for any new
tool, provider or surface. Security issues: the red-team report shows the level of detail expected.

</details>

---

## Limitations

The honest list. Every item is a known constraint, not a bug report.

- **Windows-first.** ConPTY and the native window helpers are Windows paths; Linux and macOS fall
  back to pipe mode and standard shell commands.
- **Unsigned builds.** SmartScreen warns on first launch.
- **The in-app browser is Chromium-in-a-webview** — DRM video and some cross-origin flows are
  limited.
- **Plugins are not sandboxed** beyond a `vm` context (finding X-01). Process isolation is the
  planned fix.
- **ACP is verified against the protocol spec** and handled defensively, but not against every agent
  implementation.
- **Mail has no global directory, no attachments and no multi-device key sync.** Peers are LAN or
  manual.
- **Neuro Web is first-claim** with no revocation authority, no DHT and no background repair.
- **The automation scheduler is a 20-second tick** inside the app; runs missed while the app is
  closed are not replayed, and there is no per-node retry policy.
- **The Brain recall is lexical plus graph expansion** — no embeddings yet.
- **Transcripts are not virtualized**, so very large sessions get heavy.
- **Chat attachments are recorded, not ingested** — the model sees the file name, not its contents.
- **The workflow canvas has no undo stack** — edits autosave.
- **Composio is a hosted service**; without a key, integrations are unavailable (everything else
  works).
- **Installers are Windows-only in this repository's build config.** `electron-builder` can target
  other platforms, but they are not tested here.

---

## Roadmap

Ordered by what unblocks the most, not by what is easiest.

1. **Plugin process isolation** — move plugins to an Electron `utilityProcess` (or `isolated-vm`) with
   a message-passing allowlist. This closes X-01 and is the top security item.
2. **Multi-agent rooms** — several agents sharing a tool bus with explicit hand-off events.
3. **Remote workspaces** — `WorkspaceService` behind an SSH/FS provider interface.
4. **Virtualized transcripts** — windowing for 10k-message sessions.
5. **Embedding-backed recall** — hybrid lexical + vector memory that still works offline.
6. **Signed builds and auto-update** — `electron-updater` with a release channel.
7. **Mail attachments and multi-device keys** — envelope v2 with content-addressed blobs.
8. **Background replication repair** for Neuro Web.

None of these require changing the IPC contract or the agent loop. That is the point of the seams.

---

## Contributing

```bash
npm install
npm run dev
npm run typecheck     # must pass
npm run selftest      # must pass, and regenerates screenshots
```

**Conventions that will get a change merged:**

- **A capability is one IPC channel.** Add the channel to `IpcMap` and `IPC_CHANNELS`, implement it
  in `buildHandlers`, call it from the renderer. Never reach across the boundary another way.
- **A tool lives in `src/main/services/tools.ts`.** Write its description for a model, validate
  arguments, return `{ ok, output, data }` and pick `danger` honestly.
- **No new state format without a reason.** JSON + atomic write is the default; if you truly need
  something else, document the migration.
- **Match the design language.** New surfaces use the `--n-*` tokens and the existing components
  rather than hard-coded colours.
- **Add an assertion.** A new tool, provider or surface gets one line in the selftest so it cannot
  silently rot.
- **Document the user-facing behaviour** in the README or `docs/`, not in code comments only.

The full extension recipes — tool, provider, surface, language, IPC channel, theme, marketplace item,
ACP agent, keyboard shortcut, plugin, automation node — are in
[docs/EXTENDING.md](docs/EXTENDING.md).

---

## Project layout

```text
src/
  main/                    # Electron main process — the kernel
    core/                  # store, IPC router, logging, utilities
    services/              # settings, workspace, terminal, content, tools, marketplace,
                           # agent, providers/*, mail, plugins, automation, composition,
                           # brain, web, composio, net, system
    selftest/              # deterministic sandbox provider and mock Composio for the harness
    kernel.ts              # construction and startup order
    ipcHandlers.ts         # every request handler, typed
    redteam.ts             # adversarial harness
  preload/                 # contextBridge and typed event plumbing
  renderer/                # React application
    src/components/        # design system, shell chrome, window manager, start menu, icons
    src/surfaces/          # the application surfaces
    src/onboarding/        # cinematic intro and first-run flow
    src/styles/            # tokens (DSH palette), base, shell, surfaces, OS chrome
    src/state/             # zustand stores (app, chat, windows)
  shared/                  # types, IPC contract, i18n, themes, provider presets, app registry
resources/                 # catalogue, fonts, brand icons, wallpapers
examples/                  # reference plugins (tools, theme, streaming adapter)
docs/                      # architecture, plugins, mail, automation, brain, web, composio, red team
scripts/                   # icon generation and maintenance scripts
screenshots/               # generated by the QA harness
```

**89 TypeScript files, ~27,000 lines**, plus the design system's CSS. No meta-framework, no
micro-services, no build server.

---

## Documentation

| Document | What is in it |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Process model, typed contract, kernel services, persistence, agent loop, window manager, theming, i18n |
| [docs/EXTENDING.md](docs/EXTENDING.md) | Twelve recipes: tools, providers, surfaces, languages, IPC, themes, marketplace items, ACP, shortcuts, plugins, automation nodes |
| [docs/PLUGINS.md](docs/PLUGINS.md) | Manifest schema, runtime API, streaming adapters, isolation, lifecycle, packaging |
| [docs/MAIL.md](docs/MAIL.md) | Identity, envelope format, transport, discovery, relay, privacy |
| [docs/WEB.md](docs/WEB.md) | Publishing, gateway API, replication, domain claims, counters |
| [docs/BRAIN.md](docs/BRAIN.md) | Capture, graph, Orama indexing, salience, retention, agent integration |
| [docs/AUTOMATION.md](docs/AUTOMATION.md) | Nodes, items, templating, branching, triggers, execution model, debugging |
| [docs/COMPOSIO.md](docs/COMPOSIO.md) | Setup, OAuth flow, tool registration, API surface, troubleshooting |
| [docs/REDTEAM.md](docs/REDTEAM.md) | Every adversarial check, every fix, the open finding, residual risks |
| [docs/README-PLAYBOOK.md](docs/README-PLAYBOOK.md) | Why this README is shaped the way it is: an audit of 15 top AI repos, and the rule each section follows |

---

## Credits

Inspired by, and built on:

- **DeepSeek Harness** — the design language this interface is built on: neutral-bluish surfaces,
  DeepSeek blue, Montserrat wordmark, and the token discipline that keeps fourteen surfaces
  coherent.
- **[Agent Client Protocol](https://agentclientprotocol.com)** — the stdio agent protocol implemented
  here on the client side.
- **Electron + React + TypeScript** — runtime and view layer.
- **CodeMirror 6** — the editor engine. **xterm.js + node-pty** — the terminal.
- **[Orama](https://orama.ai)** (MIT) — the in-process search index behind the Brain.
- **[Lucide](https://lucide.dev)** — icon set. **[simple-icons](https://simpleicons.org)** (CC0) —
  brand marks for providers and integrations.
- **[Montserrat](resources/fonts)** — SIL Open Font License.
- **NASA** — the six public-domain photographs in the wallpaper gallery (Blue Marble, Earthrise,
  Pale Blue Dot, Pillars of Creation, Milky Way, aurora from orbit). Credits:
  [resources/wallpapers/CREDITS.md](resources/wallpapers/CREDITS.md).

---

## License

**MIT** — see [LICENSE](LICENSE). Copyright © 2026 Neuro OS.

Montserrat is licensed under the SIL Open Font License (see
`resources/fonts/Montserrat-OFL.txt`), brand marks come from simple-icons (CC0), and the NASA
photographs in the wallpaper gallery are public domain.

---

<p align="center">
  <sub>
    <strong>Neuro OS</strong> · v1.0.0 · build 2026.11 ·
    <a href="#table-of-contents">back to top</a>
    <br /><br />
    Local-first. No telemetry. No account. Built to be read.
  </sub>
</p>
