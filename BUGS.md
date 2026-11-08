# Neuro OS â€” QA & bug log

**Run date:** 2026-11-06
**Build:** Electron 33 Â· Neuro OS 1.0.0 (dev build)
**Scope:** full surface sweep, tool/task smoke tests, red-team pass on mail + domains, ACP agents (OpenCode / Codex / DeepSeek Harness / Antigravity), Composio live API.

How the system was exercised:

| Suite | What it does | Result |
| --- | --- | --- |
| `npm run selftest` (`--selftest`) | boots the real kernel + window, completes onboarding, then tasks: chat turn, fs round-trip, notebook execution, PTY shell, mail handshake/send, plugin install/run, automation run, agent composition, Composio (mock), web publish/resolve/serve, brain capture/recall, themes, sidebar, settings; 30 screenshots | complete, all subsystem probes returned `status=ok` |
| `--redteam` | boots real `MailService`/`WebService` nodes and attacks them as a hostile peer (24 checks) | **24/24 PASS** (plugin escape blocked) |
| `--qa` | ACP handshake/session/stream with a mock agent + real OpenCode, Composio live sync/search/execute | ACP pass, Composio sync + gmail search pass (CMP-03 warns: no GitHub action in the account) |

Screenshots: `screenshots/00-story.png` â€¦ `26-wallpaper.png`. Red-team report: [`redteam-report.md`](redteam-report.md).

---

## Bugs found (open + fixed during the run)

| ID | Sev | Area | Bug | Evidence |
| --- | --- | --- | --- | --- |
| **BUG-001** (fixed) | **Critical** | Plugins | Plugin `vm` is not a security boundary: a plugin reaches the host `process` and runs arbitrary code in the main process. | `globalThis.constructor.constructor('return process')()` â†’ `pid:57064`. See X-01 in the red-team report. |
| **BUG-002** (fixed) | High | ACP | ACP launch fails when the command or a path argument contains a space (`shell: true` + unescaped args). | Mock agent at `â€¦\AGI\Neuro Os\scripts\â€¦` died with `Cannot find module 'C:\Work\Research\AGI\Neuro'`. Fixed in `AcpClient` (spawn resolution + quoting), retested PASS. |
| **BUG-003** (fixed) | High | Sessions | Session persistence can crash the turn on Windows: atomic rename hits `EPERM` while an ACP stream writes the session index rapidly. | `EPERM â€¦ sessions/index.json.tmp -> sessions/index.json` aborted ACP-01. Fixed with retry/backoff in `writeJsonAtomic`; retested PASS. |
| **BUG-004** (fixed) | High | Composio | Catalog is truncated: the API ignores `page` (cursor-only), and sync caps at 10 cursor pages. Gmail/GitHub actions are missing, so search returns 0. | API: `total_items=46560`, 466 pages; `GMAIL_*` first appears on page 37. App: `tools=1000 toolkits=26`, `gmail hits=0` (CMP-02 FAIL). |
| **BUG-005** (fixed) | Medium | Composio | Connected accounts showed 0 because the app filters by its stored Composio user id, while the key's accounts belong to other users. | API: 13 accounts unfiltered, 1 for `user_ids=default`; app showed 0. Fixed with an unfiltered fallback â†’ 13. |
| **BUG-006** (fixed) | High | ACP / OpenCode | `opencode acp` initializes and creates a session, but `session/prompt` never finishes in this environment (0 credentials; `opencode run` also hung >180 s). The client waits its full 120 s timeout with no auth/model guidance. | `opencode providers list` â†’ 0 credentials; ACP prompt timed out; `opencode run --model â€¦free` hung. |
| **BUG-007** (partially fixed) | Medium | ACP coverage | 3 of the 4 requested agents cannot be attached via ACP today: Codex CLI 0.166 has no `acp` command (only `app-server`/`exec-server`), DeepSeek Harness has no ACP mode and its headless CLI fails without `DEEPSEEK_API_KEY`, Antigravity ships an IDE only. | `codex --help` subcommands; `dsh headless` â†’ `MISSING_CREDENTIAL: llm-deepseek`; Antigravity has `Antigravity.exe` only. |
| **BUG-008** (fixed) | Medium | Neuro Web UI | Sites resolved from a peer no longer appear under â€œMy sitesâ€ (cache-only after the claim-poisoning fix), and there is no â€œfrom the meshâ€ section, so a successful resolve looks like nothing happened. | selftest: `web p2p â€¦ resolved=true â€¦ peerSites=0`. |
| **BUG-009** (closed) | Low | Browser | External webview logs `ERR_ABORTED (-3)` for `https://example.com/` even though the page later loads. | selftest warning at `webview https://example.com`. |
| **BUG-010** (fixed) | Low | QA harness | The QA report printed a partial Composio key (`ak_bâ€¦UFF`) in evidence. | Fixed: evidence now only says `key=set`. |
| **BUG-011** (fixed) | Medium | ACP UX | ACP providers have no model picker in the provider UI; the configured `model` is not sent to the agent, so behaviour depends entirely on the agent's default. | `AcpClient.prompt` sends only `sessionId` + prompt. |
| **BUG-012** (accepted) | Low | Mail UX | An envelope addressed to a different node with `ttl > 0` is relayed silently (correct store-and-forward) but the sender gets `202 relayed` with no delivery receipt. | M-08 response `202`, target inbox later 1. |
| **BUG-013** (fixed) | High | Navigation | Navigating to an app id that is not a surface key (`spaces`, `files`, `overview`) crashed the renderer: `SURFACES[surface].labelKey` on `undefined`. | Deep run D-19: error page on `spaces`, body `CANNOT READ PROPERTIES OF UNDEFINED (READING 'LABELKEY')`. Fixed with alias normalization + `surfaceMeta()` fallbacks. |
| **BUG-014** (accepted) | Medium | Files | `fs.read` has no workspace confinement: reading `C:\Windows\win.ini` succeeds from the Workspace API. | Deep D-05 WARN: 92 bytes read outside the workspace root. Decide whether the file API is OS-wide (like Finder) or workspace-scoped. |
| **BUG-015** (fixed) | Low | Chat | `chat.send` without a provider resolves instead of rejecting; the failure is only surfaced as an async agent event. | Deep D-22 WARN: send did not throw, transcript stayed empty. |
| **BUG-016** (invalid) | Low | Automation | `transform.code` step output is not stored on the run step; run evidence is blank even when the workflow succeeds. | Deep D-11: 2 steps, status ok, output "". |
| **BUG-017** (fixed) | Info | Brain API | `brain.capture` silently ignores items without a `label` (the test initially sent `title`/`body`); a fallback to `title` would make the API less error-prone. | Deep D-24 first attempt: recorded 0 with title/body; 2 with label/detail. |

## Fix pass (this round)

| Bug | Fix |
| --- | --- |
| BUG-001 | Plugins now run in a **separate process** (`resources/plugin-host.cjs`) with Node's permission model: plugin dir read-only, no writes, no child processes, env stripped, main app unreachable. Red-team X-01 now reports `{electron:blocked, fs:ERR_ACCESS_DENIED, env:stripped}`. Plugin *adapters* are disabled in the sandbox (tools/commands/storage/api still work). |
| BUG-004 | `composio.searchRemote()` fetches a toolkit's tools with cursor pagination and merges them into the catalog; the Composio panel auto-searches remotely when local search is empty; the `composio.search` agent tool falls back to it. Gmail search: 0 → 20 hits. |
| BUG-006 | ACP now records `authMethods`; a prompt timeout tells the user to sign in with the agent CLI. |
| BUG-011 | ACP providers call `session/set_model` with the configured model before prompting. |
| BUG-008 | Sites gains a **From the mesh** section listing manifests resolved from peers (open/copy), while the local claim list stays clean. |
| BUG-015 | `chat.send` throws immediately when no provider is connected or it is disabled. |
| BUG-017 | `brain.capture` falls back to `title` when `label` is missing. |
| BUG-016 | Invalid: the check read the trigger step's output; the transform step carries the value. |
| BUG-009 | Closed as benign: Chromium aborts the first example.com load and the retry succeeds; the handler already ignores `ERR_ABORTED`. |
| BUG-012 | Accepted limitation: store-and-forward has no end-to-end delivery receipt (the sender sees `relayed`, not `delivered`). |
| BUG-014 | Accepted design: the Files API is OS-wide (like Finder); the Workspace surface is a root, not a sandbox. |
| BUG-007 | DSH still has no ACP mode upstream; Codex (adapter) and Antigravity (binary) are covered. |

## Fixed during this run

| ID | Area | Fix | Retest |
| --- | --- | --- | --- |
| BUG-002 | ACP spawn | Resolve shell only for bare names/`.cmd/.bat/.ps1`; spawn `.exe` directly; quote args with spaces | ACP-01 PASS |
| BUG-003 | Store | Retry `EPERM/EBUSY/EACCES` renames 6Ã— with backoff (async + sync) | ACP-01 PASS |
| BUG-005 | Composio accounts | Fall back to unfiltered `/connected_accounts` when the user filter returns none | accounts 0 â†’ 13 |
| BUG-010 | QA harness | Never print any part of a secret | clean report |
| BUG-007 | ACP | Added all 44 agents from the official registry as provider presets; verified the Codex adapter end-to-end | ACP-05 PASS |
| BUG-013 | Navigation | Map app-id aliases (`spaces`→`space`, `files`→`workspace`, `overview`→`desktop`) and fall back to desktop metadata for unknown surfaces | Deep D-19: 14/14 surfaces rendered |

Earlier red-team fixes (details in [`redteam-report.md`](redteam-report.md)): mail relay signature, per-IP mail rate limit, domain proof-of-content, manifest `nodeId` binding, blob scoping, CSP sandbox + origin check, junction-safe folder publish, blob GC, remote-resolve claim poisoning, `neuro://` traversal, plugin `codeGeneration` (partial mitigation only).

## Coverage notes / not yet covered

- **Not testable in this environment:** ACP prompts for Codex/DSH/Antigravity (no ACP entrypoint), OpenCode real prompt (no credentials), a two-machine mail exchange over a real LAN, real provider keys (OpenAI/Anthropic/Gemini), marketplace downloads from the network.
- **UI depth:** the selftest drives navigation and key actions, but not every button on every surface; there is no visual-diff or accessibility pass yet.
- **Concurrency:** ACP streaming exposed a Windows file-lock race; long-running multi-session agent runs should be stress-tested (10+ sessions, cancellation, app quit mid-stream).

## Suggested order of work

1. **BUG-001 plugin isolation** â€” `utilityProcess` with an IPC allowlist (or `isolated-vm`); treat plugins as trusted until then.
2. **BUG-004 Composio search** â€” remote `search` endpoint + on-demand toolkit sync instead of a local 46k catalog; expose â€œsync toolkitâ€ in the UI.
3. **BUG-006/007 ACP** â€” surface `authMethods`, add per-provider model selection and a fast â€œagent not authenticatedâ€ error; add adapters for Codex `app-server` and DSH headless.
4. **BUG-003 stress** â€” add a session-store write queue test (many chunks, cancel, restart).
5. **BUG-008/009/011/012** â€” UI polish and receipt/telemetry for relayed mail.


## UI / theme pass

| Issue | Fix |
| --- | --- |
| Photo-wallpaper overlay was applied globally (.app__bg, .desktop, .lockscreen), darkening every theme and turning Ubuntu light into flat grey. | Scoped to :root[data-wallpaper^=photo:] with a light variant; themed gradients render again. |
| ACP provider cards had blank icons (brand bot has no mark, BrandIcon returned null). | Provider grids fall back to Icon name=plug when hasBrand() is false. |
| Provider picker collapsed to one oversized column (1fr min-content + long ACP install strings). | repeat(2, minmax(0,1fr)) + min-width:0; verified 293px + 293px columns. |
| “Add provider” skipped the preset list and opened DeepSeek directly. | It opens the picker now; 23 cards render in a light theme. |
| Light-theme dock/taskbar glyphs were washed out on pale bars. | Light dock tiles + stronger glyph contrast; desktop tiles use color-mix accent backgrounds. |
| Provider cards had faint borders in light themes. | Explicit light-theme surfaces, borders and logo tiles. |

## Chat & composer pass

| Issue | Fix |
| --- | --- |
| Ollama models that do not support tools returned HTTP 400 for the whole turn, leaving an empty bubble. | The OpenAI-compatible adapter detects “does not support tools” and retries the turn without a tools payload; Ollama base URLs without /v1 are normalized; streaming has a 180s hard timeout. OLL-01: first token ~6.1s. |
| Agent failures were only toasts; the assistant bubble stayed empty with a caret. | Error events now fill the message with ⚠️ + message and render an inline error block. |
| Composer looked like a control panel: workspace/auto-approve chips, send/newline hints, crowded provider/model pills. | ChatGPT-style composer: paperclip left, compact provider + model selectors, circular send/stop button, chip row removed, larger radius and softer shadow. |
| Mail setup card inherited the 3-column mail grid and was clipped on the left. | .mail--setup is a single-column centred grid with padding and overflow; D-00 verifies left=505px, width=520px inside a 1480px viewport. |

## Spaces interaction pass

| Issue | Fix |
| --- | --- |
| Selecting a space looked like nothing happened: under 980 CSS px the master-detail layout stacked the detail panel below the grid, often outside the viewport, so the click only changed hidden state. | The layout keeps the detail panel beside the grid down to 980 px (300 px aside, 220 px cards) and turns it into a slide-over drawer below 760 px. The panel scrolls into view on selection. |
| A space card had no “open” action; double-click and the detail panel now open the space workspace (patching workspaceRoot when the space has a folder). | `openSpace()` + primary Open button + double-click + tooltip. |
