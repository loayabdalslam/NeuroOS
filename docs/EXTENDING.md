# Extending Neuro OS

Every extension point below is a real, exercised seam in the codebase. None of them require touching
the kernel's public surface.

---

## 1. Add a tool

Tools are declared and implemented in one place: `src/main/services/tools.ts`.

```ts
define(
  'repo.todos',                       // unique name → what the model calls
  'Find TODOs',                       // title
  'Scan the workspace for TODO/FIXME comments and group them by file.',
  'filesystem',                       // category
  'low',                              // danger → default policy
  obj({ root: str('Root directory (optional).') }),
  async (args, rt) => {
    const hits = await rt.workspace.search(String(args.root || rt.cwd()), 'TODO');
    return { ok: true, output: hits.map((h) => `${h.path}:${h.line}`).join('\n'), data: hits };
  },
),
```

That's it:

- it appears in **Settings → Tools** with its own policy control,
- it is advertised to every provider (OpenAI/Anthropic/Gemini shapes are generated),
- agents whose `tools` allowlist excludes it will not see it.

If a tool needs new runtime dependencies, extend `ToolRuntime` and wire it in `kernel.ts`.

### Tool design rules

1. Write the description for a model, not a human: say *when* to use it.
2. Validate arguments defensively and throw human-readable errors — the model reads them.
3. Return a concise `output` and structured `data`; never dump megabytes.
4. Pick `danger` honestly: `high` means it can destroy data or escape the workspace.

---

## 2. Add a provider

If the endpoint is OpenAI-compatible, there is nothing to code: **Settings → Providers → Add**, set
the base URL and models. Or add a preset in `src/shared/providers.ts` so it ships in the picker.

For a new wire protocol, implement `ProviderAdapter` in `src/main/services/providers/adapters.ts`:

```ts
export class MyAdapter implements ProviderAdapter {
  constructor(private readonly provider: ProviderConfig) {}

  async *stream(req: LlmRequest, signal: AbortSignal): AsyncGenerator<LlmStreamEvent> {
    const res = await fetch(joinUrl(this.provider.baseUrl, 'chat'), {
      method: 'POST',
      headers: { authorization: `Bearer ${this.provider.apiKey}` },
      body: JSON.stringify({ /* … */ }),
      signal,
    });
    await assertOk(res, this.provider.name);
    for await (const data of sseEvents(res, signal)) {
      const event = JSON.parse(data);
      if (event.text) yield { type: 'text', delta: event.text };
      if (event.call) yield { type: 'tool_call', call: { id: event.call.id, name: event.call.name, args: event.call.args } };
    }
    yield { type: 'done' };
  }

  listModels() { /* … */ }
  probe() { /* … */ }
}
```

Register it in `createAdapter()` and add `'myproto'` to `ProviderKind` in `src/shared/types.ts`.

---

## 3. Add a surface (page)

1. Create `src/renderer/src/surfaces/MySurface.tsx` and export a component that takes
   `{ params }`.
2. Add the surface to `SurfaceKind` (`src/shared/types.ts`).
3. Add metadata (icon, label key, accent) in `src/renderer/src/surfaces/meta.ts`.
4. Render it in `SurfaceHost` inside `App.tsx`.

Navigation, tabs, taskbar pinning, the command palette and the dock pick it up automatically from
`SURFACE_ORDER`. Persist any durable state through a new IPC channel (see §5).

---

## 4. Add a language

`src/shared/i18n.ts`:

```ts
const sv: Dict = {
  'nav.desktop': 'Skrivbord',
  'common.search': 'Sök',
  // …
};
```

Add the locale to `DICTIONARIES`, add a `LanguageDef` with a vector flag id, and draw the flag in
`src/renderer/src/components/Flag.tsx`. `dir: 'rtl'` flips the entire interface.

Missing keys fall back to English, so partial packs are legal.

---

## 5. Add an IPC capability

```ts
// src/shared/ipc.ts
'notes.pin': { params: { id: ID; pinned: boolean }; result: Note[] };
```

1. Add it to `IpcMap` **and** `IPC_CHANNELS`.
2. Implement it in `src/main/ipcHandlers.ts` (`buildHandlers`). The handler is type-checked.
3. Call it from the renderer: `await invoke('notes.pin', { id, pinned: true })`.

For streaming output, add to `EventMap` + `EVENT_CHANNELS` and call `kernel.emit(channel, payload)`.

---

## 6. Add a theme design language

1. Add the id to `ThemeDesign` in `src/shared/types.ts`.
2. Add a preset (or two) in `src/shared/themes.ts` with its colours, radii, wallpaper and taskbar
   position.
3. Add a `:root[data-design='mydesign'] { … }` block in `tokens.css` overriding `--n-*` tokens
   (accent, surfaces, fonts, radii, shadows, glass) plus optional chrome rules in `shell.css`.

The gallery, onboarding, presets and persistence pick it up with no other changes.

---

## 7. Add a marketplace item

Append an object to `resources/catalog/catalog.json`:

```jsonc
{
  "id": "my-skill",
  "kind": "skill",                       // skill | plugin | agent | theme
  "name": "My Skill",
  "tagline": "One line.",
  "description": "What it does and when to use it.",
  "author": "You",
  "version": "1.0.0",
  "category": "Engineering",
  "tags": ["x"],
  "installs": 0,
  "rating": 5,
  "verified": false,
  "icon": "sparkles",
  "accent": "#4176e6",
  "content": "# My Skill\n\n## Procedure\n1. …",
  "permissions": ["filesystem"]
}
```

- `skill` → `content` is a SKILL.md the agent can read and follow.
- `plugin` → `tools[]` + `entry.value` (a PowerShell/bash command template; `{param}` is substituted
  from arguments, `{cwd}` from the workspace).
- `agent` → `content` is JSON with `systemPrompt`, `tools`, `temperature`, `maxSteps`.
- `theme` → install applies its accent.

---

## 8. Add an ACP agent

**Settings → Providers → Add provider → ACP Agent**, then:

- command: `npx`
- arguments: `-y <package> --acp`
- working directory: your workspace

Neuro spawns the process, negotiates ACP v1, bridges filesystem and terminal capabilities, mediates
permission requests through the tool policy layer, and streams agent output into the normal chat UI.

---

## 9. Add a keyboard shortcut

Global shortcuts live in one `useEffect` in `App.tsx`:

```ts
if (key === 'k') { /* command palette */ }
```

For surface-local keys use `useHotkey('ctrl+s', save, [save])` from `lib/hooks.ts`. Document it in
**Settings → Shortcuts**.

---

## 10. Build a plugin

Plugins are the supported way to ship extensions without touching core code. A minimal tool plugin:

```jsonc
// neuro.plugin.json
{
  "id": "my-tools",
  "name": "My Tools",
  "version": "1.0.0",
  "description": "Adds one tool.",
  "main": "main.js",
  "permissions": [],
  "contributes": {
    "tools": [{
      "name": "ping",
      "description": "Return pong.",
      "category": "agent",
      "danger": "low",
      "handler": "ping",
      "parameters": { "type": "object", "properties": {}, "additionalProperties": false }
    }]
  }
}
```

```js
module.exports = {
  tools: {
    async ping() {
      return { ok: true, output: 'pong' };
    },
  },
};
```

Install it from **Marketplace → Extensions → From folder**. The tool is then namespaced as
`my-tools.ping`, appears in Settings → Tools with its own policy, and is advertised to every
provider. Themes, provider presets, streaming adapters and commands use the same manifest.
Full reference: [PLUGINS.md](PLUGINS.md).

## 11. Add an automation node type

Four small edits, all local:

1. Add the id to `WorkflowNodeType` in `src/shared/types.ts`.
2. Add a `NodeTypeSpec` in `AutomationService.nodeTypes()` (label, icon, category, fields, outputs).
3. Add a `case` in `AutomationService.runNode()` returning `{ item, port }`.
4. Nothing else — the canvas, inspector, templating and run log pick it up automatically.

The same pattern works for a new trigger: add a spec with `category: 'trigger'` and call
`automation.run(id, 'my-trigger', payload)` from wherever the event originates.

## 12. Before you ship a change

```bash
npx tsc --noEmit -p tsconfig.node.json
npx tsc --noEmit -p tsconfig.web.json
npm run selftest        # screenshots + subsystem assertions
```

If you add a tool, provider or surface, add one assertion to the selftest so it cannot silently rot.
