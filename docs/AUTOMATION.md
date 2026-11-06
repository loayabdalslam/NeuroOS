# Automation

Automation is a small n8n-style workflow engine built into the OS. A workflow is
a graph of nodes: a trigger starts it, and each node transforms an *item* that
flows along the edges. Agents, tools, HTTP, code, mail and agent compositions are
all available as nodes.

Open **Automation** from the desktop, the dock, or `Ctrl/⌘ K → Automation`.

---

## 1. Concepts

- **Item** — the payload moving through the graph: `{ text, json }`.
- **Node** — a typed step with config. Nodes are dragged on a canvas.
- **Edge** — a connection from an output port (`main`, `true`, `false`) to a
  node's input.
- **Run** — one execution, persisted with per-node status, duration and output.
- **Trigger** — the node(s) with no incoming edge; they receive the initial item.

Runs stream progress as events, so the canvas lights up node by node.

---

## 2. Node catalog

| Node | Category | Output |
| --- | --- | --- |
| `trigger.manual` | trigger | Passes the run input |
| `trigger.schedule` | trigger | Every N minutes, or daily at `HH:MM` |
| `trigger.mail` | trigger | Fires when this node receives mail (optional from/subject filters) |
| `trigger.fs` | trigger | Fires on workspace file changes (optional path filter) |
| `agent.run` | agent | Runs an agent headlessly and returns its text |
| `composition.run` | agent | Runs an agent composition and returns the final text |
| `tool.call` | action | Invokes any tool with JSON arguments |
| `http.request` | action | Any HTTP method, templated URL/headers/body |
| `transform.code` | action | JavaScript with `input` and `json` in scope |
| `condition.if` | logic | A JS expression; branches `true` / `false` |
| `delay.wait` | logic | Sleeps (max 60 s) |
| `mail.send` | action | Sends decentralized mail to a peer |
| `notify.toast` | action | Shows an in-app notification |

Tools invoked by `tool.call` still obey the per-tool policy. In background runs
(triggers), tools with policy `ask` are skipped rather than blocking forever.

---

## 3. Templating

Any config string can reference the incoming item:

```text
{{input}}          the item text
{{json.status}}    a field from item.json
{{now}}            ISO timestamp
{{workflow}}       workflow name
```

Example `agent.run` prompt:

```text
Summarise this email for a busy engineer. Reply in 3 bullets.

{{input}}
```

`tool.call` arguments are parsed as JSON after templating:

```json
{ "path": "{{json.file}}", "maxResults": 20 }
```

---

## 4. Branching

`condition.if` evaluates a JavaScript expression with `input`, `text` and `json`
in scope and activates either its `true` or `false` output dot. Connect each dot
to a different downstream node.

```js
json.text.toLowerCase().startsWith('urgent')
```

Only the matching branch runs; the other nodes are untouched.

---

## 5. Triggers

- **Manual** — the Run button.
- **Schedule** — checked every 20 seconds. `interval` uses minutes; `daily` uses
  a local `HH:MM` and runs at most once per day.
- **Mail** — subscribed to the decentralized mail node. The item text is
  `subject\n\nbody`.
- **File change** — subscribed to the workspace watcher.

Workflows must be **enabled** for trigger-driven runs. A workflow cannot run
twice concurrently; the second attempt is rejected until the first finishes.

---

## 6. Compositions

Compositions are agent pipelines: each step runs an agent with a prompt that can
see the original `{{input}}` and the `{{previous}}` step's output.

They can be run from the **Composer** app, from an automation
(`composition.run`), or by the agent (`composition.run` tool is not exposed by
default but the workflow node is). This is the integration point between
*agents* and *automation*: an automation gathers data, a composition reasons over
it with several specialists, and the result flows back into an action.

Example: **Daily research brief**

```text
trigger.schedule (09:00)
  → composition.run (Research → Draft → Review)
  → notify.toast
```

---

## 7. Execution model

1. Start nodes = trigger nodes (or nodes with no incoming edge).
2. Shift a node off the queue, record a step, execute it.
3. Follow edges from the port the node emitted (`main` by default).
4. Continue until the queue is empty.
5. Persist the run (status, per-node output, durations) and emit the final event.

Guards: 200 node executions max per run (cycles), per-node timeouts in the
executor, and cancellation via `automation.cancel`.

Errors stop the run and mark the failing step; completed steps keep their output
so you can see where it broke.

---

## 8. Debugging

- Run panel: node statuses in execution order plus the last log lines.
- Run history in the sidebar.
- Click a node to inspect its config; click an edge to delete it.
- Canvas: drag background to pan, ⌘/Ctrl + wheel to zoom, drag nodes to move.
- `automation.run` is also exposed as a tool, so you can ask the agent to run a
  workflow.

---

## 9. Seeded examples

Two workflows ship disabled:

1. **Hourly system brief** — schedule → agent → notification.
2. **Mail triage** — mail trigger → agent classifies → `condition.if` urgent →
   alert, otherwise a transform note.

Enable them from the list, or build from the empty canvas.

---

## 10. Limits

- The scheduler is a 20-second tick, not a real cron daemon; a missed run while
  the app is closed is not replayed.
- Runs are bounded (100 kept in history) and executed in the main process — long
  HTTP calls block that node, not the UI.
- There is no per-node retry policy yet; put a `condition.if` or a workflow-level
  retry around flaky steps.
- The canvas has no undo stack; edits autosave.
