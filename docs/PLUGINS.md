# Plugins

Neuro OS is built to be extended. A plugin is a folder with a manifest and an
optional JavaScript module. It can add **tools** the agent can call, **themes**,
**provider presets**, **streaming adapters** for new model protocols, and
**commands** you can run from the UI.

Plugins run in the main process, in a Node `vm` context with an explicit,
permissioned API object. There is no build step, no SDK to install and no
network access at install time unless you install from a URL.

---

## 1. Install

Three supported sources — all available in **Marketplace → Extensions**:

| Source | What it does |
| --- | --- |
| **From folder** | Copies a directory containing `neuro.plugin.json` into `%APPDATA%/Neuro OS/plugins/<id>`. Best for local development. |
| **From .zip** | Extracts a package (zip or `.neuro`), then installs the folder inside. |
| **From URL** | Downloads a `.zip` over HTTPS, extracts and installs it. |

```text
plugins/
  hello-neuro/
    neuro.plugin.json   ← the contract
    main.js             ← optional handlers
    README.md
```

Install is idempotent per id: a plugin whose id is already installed must be
uninstalled first. Uninstall removes the folder, its tools and its themes.
Disabling (the toggle) unloads it but keeps the files.

---

## 2. Manifest

```jsonc
{
  "id": "hello-neuro",            // 2–49 chars: a-z 0-9 - _ .
  "name": "Hello Neuro",
  "version": "1.0.0",             // semver recommended
  "description": "Reference plugin.",
  "author": "You",
  "homepage": "https://…",        // optional
  "main": "main.js",              // optional entry file
  "permissions": ["fs", "ui"],
  "contributes": {
    "tools": [ /* see below */ ],
    "themes": [ /* … */ ],
    "providers": [ /* presets */ ],
    "adapters": [ /* streaming adapters */ ],
    "commands": [ { "id": "say_hello", "title": "Say hello" } ]
  }
}
```

The manifest is validated before anything runs. Unknown permissions, missing
tool schemas or malformed themes are rejected at install time with a readable
error.

### Tools

```jsonc
{
  "name": "project_stats",           // namespaced at runtime → hello-neuro.project_stats
  "title": "Project stats",
  "description": "Count files grouped by extension.",
  "category": "filesystem",          // filesystem | shell | network | ui | system | agent | knowledge | marketplace
  "danger": "low",                  // low | medium | high → default policy
  "handler": "projectStats",         // key in module.exports.tools
  "parameters": { "type": "object", "properties": { … }, "additionalProperties": false }
}
```

Parameters are JSON Schema. They are forwarded verbatim to every provider, so
the model sees your tool exactly like a built-in one. Tool policy still applies:
users can set `auto`, `ask` or `deny` per tool in **Settings → Tools**.

### Themes

```jsonc
{
  "id": "aurora-dark",
  "name": "Aurora Dark",
  "description": "Violet glass on deep space.",
  "design": "neuro",              // neuro | windows | ubuntu | ios
  "mode": "dark",                 // dark | light
  "surface": "standard",          // standard | white
  "accent": "violet",             // neuro | deepseek | violet | teal | amber
  "radius": 18,
  "wallpaper": "midnight",
  "colors": { "bg": "#0b0b14", "surface": "#1b1b2a", "accent": "#a78bfa", "text": "#f4f4ff" }
}
```

Installed themes appear in **Settings → Appearance → Installed themes** and are
applied through the same token system as the built-in gallery.

### Providers

A preset is a pre-filled provider form. Use this for any service that speaks an
OpenAI-compatible API.

```jsonc
{
  "id": "my-llm",
  "name": "My LLM",
  "description": "Self-hosted endpoint",
  "baseUrl": "https://llm.example.com/v1",
  "models": ["my-model", "my-model-mini"],
  "kind": "openai"
}
```

### Streaming adapters

For a new wire protocol, export an async generator. This is the same interface
the built-in adapters implement, just in JavaScript.

```jsonc
{
  "id": "echo",
  "name": "Echo (local)",
  "description": "Streams your message back.",
  "models": ["echo-1"]
}
```

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

Event types the host understands:

| Event | Payload |
| --- | --- |
| `text` | `{ delta }` |
| `reasoning` | `{ delta }` |
| `tool_call` | `{ call: { id, name, args } }` |
| `usage` | `{ usage: { input, output, total } }` |
| `done` | — |

The adapter is exposed in **Settings → Providers → Add provider** and is routed
by provider id `plugin:<pluginId>:<adapterId>`. Tool calling, streaming, chat
history and automations work exactly as with a built-in provider.

### Commands

```jsonc
{ "id": "say_hello", "title": "Say hello" }
```

```js
module.exports = {
  commands: {
    async say_hello() {
      neuro.ui?.toast('Hello', 'From a plugin');
      return 'done';
    },
  },
};
```

Run commands through `plugins.runCommand` (the UI exposes them in the plugin
details panel).

---

## 3. Runtime API

`main.js` is executed as:

```js
(function (module, exports, neuro) { /* your code */ })(module, module.exports, neuro)
```

Export handlers from `module.exports`. The `neuro` object is the only host
surface; anything not listed here is unavailable.

| API | Permission | Notes |
| --- | --- | --- |
| `neuro.log(...)` | — | Writes to the plugin log (visible in the plugin details). |
| `neuro.storage.get/set/delete/all()` | — | JSON storage scoped to the plugin (`storage.json`). |
| `neuro.fs.readFile/writeFile/list/exists/stat` | `fs` | Absolute paths. |
| `neuro.shell.exec(command)` | `shell` | PowerShell/bash; returns `{ stdout, stderr }`. |
| `neuro.net.fetch(url, init)` | `net` | Returns `{ status, ok, text }`. |
| `neuro.ui.toast(title, message)` | `ui` | |
| `neuro.ui.navigate(surface, params)` | `ui` | |
| `neuro.mail.send({ to, subject, body })` | `mail` | Uses the decentralized mail node. |
| `neuro.agents.run(prompt, agentId?)` | `agents` | Runs the agent loop headlessly and returns text. |

Tool handlers receive `(args, ctx)` where `ctx = { pluginId, workspaceRoot, log }`
and may return a string or `{ ok, output, data }`.

### Isolation

- Each plugin gets its own `vm` context with no `process`, no `require`, no
  `global`, and no ambient network. `fetch` is only provided through
  `neuro.net.fetch` when the permission is granted.
- Top-level execution is time-boxed to 5 seconds.
- Handler timeouts are the caller's responsibility: keep them fast and avoid
  unbounded loops.

### Load lifecycle

```text
install → validate manifest → copy → load (vm + register contributions)
toggle off → unregister tools, remove themes/adapters, keep files
toggle on  → load again
reload     → unload → load (hot update while developing)
uninstall  → unload → delete folder
```

Errors are captured per plugin: the record shows `error`, its tools are not
registered, and the logs panel explains why.

---

## 4. Security model (read this)

A plugin is **native code in the main process**. The `vm` context removes
ambient capabilities and the permission object gates the host API, but it is not
a security sandbox against a malicious plugin that finds a Node escape. Only
install plugins you trust, exactly like VS Code extensions or Chrome extensions.

Recommended practice:

1. Request the smallest permission set (`[]` is valid and common).
2. Never log secrets.
3. Keep tool handlers deterministic and side-effect scoped.
4. Pin versions and review diffs before updating.
5. For untrusted third-party code, run it in a separate ACP agent process instead
   of a plugin.

---

## 5. Examples in this repository

| Folder | Demonstrates |
| --- | --- |
| [`examples/plugins/hello-neuro`](../examples/plugins/hello-neuro) | Two tools (filesystem + text), one command, `fs`/`ui` permissions |
| [`examples/plugins/aurora-theme`](../examples/plugins/aurora-theme) | A theme-only plugin with dark + light presets |
| [`examples/plugins/local-echo`](../examples/plugins/local-echo) | A streaming provider adapter with zero dependencies |

Install any of them with **Marketplace → Extensions → From folder** and point at
the folder.

---

## 6. Packaging & publishing

```text
my-plugin.zip
└── my-plugin/
    ├── neuro.plugin.json
    ├── main.js
    └── README.md
```

Zip the parent folder (the installer also handles archives with a single nested
folder). Host the zip anywhere HTTPS-reachable and use **From URL**.

To list in the built-in marketplace catalog, add a `plugin` entry to
`resources/catalog/catalog.json`; catalog plugins may also declare command
templates (`entry.value`) which is the older, no-code mechanism.

### Compatibility

- `apiVersion` is `1`; additive API changes do not bump it.
- Contributions follow the same shapes as the core types in
  `src/shared/types.ts`.
- If a manifest references an unsupported `design`, the theme is rejected but
  the rest of the plugin still loads.

---

## 7. Debugging checklist

1. Plugin shows `error` → open **Logs** in the plugin card.
2. Tools missing → the manifest `handler` must match a key in
   `module.exports.tools`; check **Settings → Tools** for the namespaced name.
3. Provider not visible → it appears in **Settings → Providers → Add provider**
   under the plugin section.
4. Changes not applied → press **Reload** on the plugin card.
5. Agent cannot call the tool → check the tool policy and the agent's allowlist
   in **Settings → Agents**.
