# Deep automation QA

`npm run`-free runner: the app boots with `--deep`, finishes onboarding, then drives the **real IPC handlers** and the **real renderer** (DOM clicks + keyboard) through 26 checks. Every check creates real state (files, notes, spaces, notebooks, PTYs, mail messages, workflows, sites, plugins, providers) and asserts the side effects, then cleans up.

```powershell
npx electron-vite build
$env:NEURO_QA_COMPOSIO_KEY = '<your key>'   # optional, for the live Composio check
.\node_modules\electron\dist\electron.exe . --deep --user-data-dir="$env:TEMP\neuro-deep"
# writes deep-qa-report.md + deep-qa-report.json
```

Screenshots: `screenshots/deep/` (file explorer, all 14 surfaces, start menu, command palette).

## Result (latest run)

| | |
| --- | --- |
| Checks | **26** |
| Pass | **24** |
| Warn | **2** |
| Fail | **0** |
| Fixed during the run | 1 high (navigation crash) |

## Coverage

| Area | Checks |
| --- | --- |
| Files | unicode write/read, list+search, rename/overwrite/delete, 300 KB round-trip, workspace boundary probe |
| Notes | create, update, delete |
| Spaces | create, rename, remove |
| Notebooks | code cell + error cell, output and status |
| Terminal | PTY spawn, command output, resize, kill; two concurrent sessions with isolated buffers |
| Mail | identity, encrypted peer send + reply, read/delete, sent folder |
| Automation | save workflow, run, poll run steps, remove |
| Brain | remember/recall/ask/timeline/forget; recording toggle, batch capture, graph, profile |
| Neuro Web | publish HTML+asset, gateway fetch, traversal probe, unpublish; peer replication (another node publishes, this gateway serves) |
| Marketplace | install → toggle → uninstall a catalog skill |
| Plugins | install a local plugin, list, uninstall |
| Settings | theme/design, locale → RTL, restore |
| ACP | mock agent connect/prompt + chat turn streaming `MOCK_ACP_OK` |
| Composio | live key, catalog sync, search |
| UI | 14 surfaces rendered + captured, start menu open/close, command palette Ctrl+K/Escape |
| Chat | no-provider error handling |

## Warnings (open)

- **Workspace boundary (BUG-014):** `fs.read` can read outside the workspace root (`C:\Windows\win.ini`); confirm whether the file API should be OS-wide or confined.
- **Chat without a provider (BUG-015):** `chat.send` resolves instead of rejecting; the error arrives asynchronously.

## Fixed

- **BUG-013:** navigating to an app id that is not a surface key (`spaces`, `files`, `overview`) crashed the renderer with `SURFACES[surface].labelKey`. Navigation now normalizes aliases and every metadata lookup falls back to the desktop entry.

See [`BUGS.md`](../BUGS.md) for the full bug log and [`deep-qa-report.md`](../deep-qa-report.md) for the raw run.
